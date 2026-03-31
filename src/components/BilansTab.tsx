import React, { useState, useMemo, useEffect } from 'react';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { useBillingPeriodStore, BillingPeriod, ClientDocStatus } from '../stores/billingPeriodStore.supabase';
import { generateCESUTemplate, generateClassicalTemplate } from '../services/InvoiceTemplates';
import { generateAndSharePDF } from '../utils/pdfGenerator';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const STATUS_LABEL: Record<ClientDocStatus, string> = {
  pending: 'À générer',
  generated: 'Généré',
  sent: 'Envoyé',
  error: 'Erreur',
};

const STATUS_COLOR: Record<ClientDocStatus, string> = {
  pending: '#FF9500',
  generated: '#007AFF',
  sent: '#34C759',
  error: '#FF3B30',
};

const PERIOD_STATUS_LABEL = { open: 'Ouvert', locked: 'Clôturé', archived: 'Archivé' };
const PERIOD_STATUS_COLOR = { open: '#34C759', locked: '#FF9500', archived: '#888' };

interface ClientRow {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  mandataire?: Mandataire;
  timesheetCount: number;
  totalHours: number;
  totalAmount: number;
  hasDraftTimesheets: boolean;
  docStatus: ClientDocStatus;
  recipientEmail?: string;
}

interface MandataireGroup {
  mandataire?: Mandataire;
  clients: ClientRow[];
  totalAmount: number;
  recipientEmail?: string;
}

export default function BilansTab() {
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { user } = useAuthStore();
  const {
    periods, getOrCreatePeriod, getPeriod, getClientStatus,
    upsertClientStatus, lockPeriod, unlockPeriod, archivePeriod,
  } = useBillingPeriodStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-based
  const [generating, setGenerating] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 3 + i).reverse();

  // Période courante (peut ne pas exister encore en DB)
  const currentPeriod = getPeriod(selectedMonth, selectedYear);
  const isLocked = currentPeriod?.status === 'locked' || currentPeriod?.status === 'archived';
  const isArchived = currentPeriod?.status === 'archived';

  // Calcul des données du mois
  const { groups, totalClientsActive, totalMontant, warnings } = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1).getTime();
    const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).getTime();

    const rows: ClientRow[] = clients.map((client) => {
      const cts = timesheets.filter(
        (ts) => ts.client_id === client.id && ts.date_arrival >= start && ts.date_arrival <= end
      );
      const totalHours = cts.reduce((s, ts) => s + ts.duration, 0);
      const totalSalaire = totalHours * client.hourly_rate;
      const totalFrais = cts.reduce(
        (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0), 0
      );
      const mandataire = mandataires.find((m) => m.id === client.mandataire_id);
      const persisted = currentPeriod ? getClientStatus(currentPeriod.id, client.id) : null;
      const docStatus: ClientDocStatus = persisted?.status || 'pending';
      const recipientEmail = mandataire?.email || client.email;

      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        mandataire,
        timesheetCount: cts.length,
        totalHours,
        totalAmount: totalSalaire + totalFrais,
        hasDraftTimesheets: cts.some((ts) => ts.status === 'draft'),
        docStatus,
        recipientEmail,
      };
    });

    // Grouper par mandataire
    const map = new Map<string, MandataireGroup>();
    rows.forEach((row) => {
      const key = row.mandataire?.id || '__none__';
      if (!map.has(key)) {
        map.set(key, {
          mandataire: row.mandataire,
          clients: [],
          totalAmount: 0,
          recipientEmail: row.mandataire?.email || row.clientEmail,
        });
      }
      const g = map.get(key)!;
      g.clients.push(row);
      g.totalAmount += row.totalAmount;
    });

    const groups = Array.from(map.values()).sort((a, b) => {
      if (!a.mandataire) return 1;
      if (!b.mandataire) return -1;
      return a.mandataire.association_name.localeCompare(b.mandataire.association_name);
    });

    const activeRows = rows.filter((r) => r.timesheetCount > 0);
    const warnings: string[] = [];
    const notGenerated = activeRows.filter((r) => r.docStatus === 'pending');
    const draftTs = activeRows.filter((r) => r.hasDraftTimesheets);
    if (notGenerated.length > 0)
      warnings.push(`${notGenerated.length} client${notGenerated.length > 1 ? 's' : ''} sans document généré`);
    if (draftTs.length > 0)
      warnings.push(`${draftTs.length} client${draftTs.length > 1 ? 's' : ''} avec pointages non validés`);

    return {
      groups,
      totalClientsActive: activeRows.length,
      totalMontant: activeRows.reduce((s, r) => s + r.totalAmount, 0),
      warnings,
    };
  }, [timesheets, clients, mandataires, selectedYear, selectedMonth, currentPeriod, getClientStatus]);

  // Générer PDF pour un client
  const handleGenerate = async (row: ClientRow) => {
    if (!user || isLocked) return;
    setGenerating(row.clientId);
    try {
      const period = await getOrCreatePeriod(selectedMonth, selectedYear);
      const client = clients.find((c) => c.id === row.clientId)!;
      const start = new Date(selectedYear, selectedMonth - 1, 1).getTime();
      const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).getTime();
      const cts = timesheets.filter(
        (ts) => ts.client_id === client.id && ts.date_arrival >= start && ts.date_arrival <= end
      );

      const invoiceData: any = {
        invoice_number: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${client.name.substring(0, 3).toUpperCase()}`,
        created_at: Date.now(),
        total_amount: row.totalAmount,
        month: selectedMonth,
        year: selectedYear,
      };

      const userProfile = {
        displayName: user.display_name || user.email,
        email: user.email,
        address: user.address,
        phone: user.phone,
        cesuNumber: user.cesu_number,
        siren: user.siren,
        siret: user.siret,
        businessName: user.business_name,
        businessAddress: user.business_address,
        iban: user.iban,
        bic: user.bic,
      };

      const html = client.facturation_mode === 'CESU'
        ? generateCESUTemplate(invoiceData, client, cts, userProfile, row.mandataire)
        : generateClassicalTemplate(invoiceData, client, cts, userProfile, row.mandataire);

      const filename = `pointage_${client.name.replace(/\s+/g, '_')}_${MONTHS[selectedMonth - 1]}_${selectedYear}`;
      await generateAndSharePDF(html, filename);

      await upsertClientStatus(period.id, client.id, {
        status: 'generated',
        doc_generated_at: Date.now(),
        recipient_email: row.recipientEmail,
      });
    } catch (err) {
      console.error('Génération échouée:', err);
      if (currentPeriod) {
        await upsertClientStatus(currentPeriod.id, row.clientId, { status: 'error' });
      }
    } finally {
      setGenerating(null);
    }
  };

  // Clôturer le mois
  const handleLock = async () => {
    setLocking(true);
    try {
      const period = currentPeriod || await getOrCreatePeriod(selectedMonth, selectedYear);
      await lockPeriod(period.id);
      setConfirmLock(false);
    } finally {
      setLocking(false);
    }
  };

  // Mois passés avec des périodes enregistrées
  const pastPeriods = useMemo(() =>
    [...periods]
      .filter((p) => !(p.month === selectedMonth && p.year === selectedYear))
      .sort((a, b) => b.year - a.year || b.month - a.month),
    [periods, selectedMonth, selectedYear]
  );

  const navigateToPeriod = (p: BillingPeriod) => {
    setSelectedMonth(p.month);
    setSelectedYear(p.year);
    setShowHistory(false);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Bilan fin de mois</h2>
          {currentPeriod && (
            <span style={{
              padding: '3px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
              backgroundColor: PERIOD_STATUS_COLOR[currentPeriod.status] + '22',
              color: PERIOD_STATUS_COLOR[currentPeriod.status],
              border: `1px solid ${PERIOD_STATUS_COLOR[currentPeriod.status]}44`,
            }}>
              {PERIOD_STATUS_LABEL[currentPeriod.status]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: showHistory ? '#007AFF' : 'white', color: showHistory ? 'white' : '#333', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            Historique ({pastPeriods.length})
          </button>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Panneau historique */}
      {showHistory && (
        <div style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Mois clôturés / archivés</h3>
          {pastPeriods.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>Aucun mois enregistré</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {pastPeriods.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', borderRadius: '6px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{MONTHS[p.month - 1]} {p.year}</span>
                    <span style={{
                      padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                      backgroundColor: PERIOD_STATUS_COLOR[p.status] + '22',
                      color: PERIOD_STATUS_COLOR[p.status],
                    }}>
                      {PERIOD_STATUS_LABEL[p.status]}
                    </span>
                    {p.locked_at && (
                      <span style={{ fontSize: '12px', color: '#888' }}>
                        Clôturé le {new Date(p.locked_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigateToPeriod(p)}
                      style={{ padding: '6px 12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      Voir
                    </button>
                    {p.status === 'locked' && (
                      <button onClick={() => archivePeriod(p.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#888', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Archiver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bannière mois clôturé */}
      {isLocked && (
        <div style={{ background: isArchived ? '#f5f5f5' : '#FFF8E7', border: `1px solid ${isArchived ? '#ddd' : '#FF9500'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: isArchived ? '#888' : '#FF9500' }}>
            {isArchived ? 'Mois archivé — lecture seule' : 'Mois clôturé — aucune modification possible'}
          </span>
          {!isArchived && (
            <button onClick={() => unlockPeriod(currentPeriod!.id)}
              style={{ padding: '6px 14px', backgroundColor: 'white', color: '#FF9500', border: '1px solid #FF9500', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              Rouvrir
            </button>
          )}
        </div>
      )}

      {/* Résumé global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#EBF9F0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#2d8a4e', textTransform: 'uppercase', marginBottom: '4px' }}>Clients actifs</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d8a4e' }}>{totalClientsActive}</div>
        </div>
        <div style={{ background: '#E8F4FF', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#1a6fb5', textTransform: 'uppercase', marginBottom: '4px' }}>Mandataires</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a6fb5' }}>
            {groups.filter((g) => g.mandataire).length}
          </div>
        </div>
        <div style={{ background: '#F0EBFF', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#5b3db5', textTransform: 'uppercase', marginBottom: '4px' }}>Total</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#5b3db5' }}>{totalMontant.toFixed(2)}€</div>
        </div>
      </div>

      {/* Alertes */}
      {!isLocked && warnings.length > 0 && (
        <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', color: '#856400', marginBottom: '6px', fontSize: '13px' }}>⚠ Points d'attention avant clôture</div>
          {warnings.map((w, i) => (
            <div key={i} style={{ color: '#856400', fontSize: '13px' }}>• {w}</div>
          ))}
        </div>
      )}

      {/* Groupes par mandataire */}
      {groups.map((group, gi) => {
        const groupLabel = group.mandataire
          ? `${group.mandataire.titre ? group.mandataire.titre + ' ' : ''}${group.mandataire.name} — ${group.mandataire.association_name}`
          : 'Sans mandataire';
        const borderColor = group.mandataire ? '#007AFF' : '#ccc';
        const activeClients = group.clients.filter((c) => c.timesheetCount > 0);

        return (
          <div key={gi} style={{ marginBottom: '20px', border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: group.mandataire ? '#E8F4FF' : '#f5f5f5', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', color: group.mandataire ? '#1a6fb5' : '#666' }}>{groupLabel}</div>
                {group.recipientEmail && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>✉️ {group.recipientEmail}</div>}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{group.totalAmount.toFixed(2)}€</span>
            </div>

            {group.clients.map((row) => (
              <div key={row.clientId} style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', opacity: row.timesheetCount === 0 ? 0.45 : 1 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{row.clientName}</span>
                    {row.mandataire && (
                      <span style={{ fontSize: '11px', color: '#1a6fb5', backgroundColor: '#E8F4FF', padding: '1px 8px', borderRadius: '10px' }}>
                        {row.mandataire.titre ? row.mandataire.titre + ' ' : ''}{row.mandataire.first_name ? row.mandataire.first_name + ' ' : ''}{row.mandataire.name} — {row.mandataire.association_name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                    {row.timesheetCount === 0
                      ? 'Aucun pointage ce mois'
                      : `${row.timesheetCount} pointage${row.timesheetCount > 1 ? 's' : ''} · ${row.totalHours.toFixed(1)}h · ${row.totalAmount.toFixed(2)}€`}
                    {row.hasDraftTimesheets && row.timesheetCount > 0 && (
                      <span style={{ marginLeft: '8px', color: '#FF9500', fontWeight: 'bold' }}>⚠ non validés</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                    backgroundColor: STATUS_COLOR[row.docStatus] + '22',
                    color: STATUS_COLOR[row.docStatus],
                    border: `1px solid ${STATUS_COLOR[row.docStatus]}44`,
                  }}>
                    {STATUS_LABEL[row.docStatus]}
                  </span>
                  {row.timesheetCount > 0 && !isLocked && (
                    <button
                      disabled={generating === row.clientId}
                      onClick={() => handleGenerate(row)}
                      style={{ padding: '7px 14px', backgroundColor: generating === row.clientId ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: generating === row.clientId ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      {generating === row.clientId ? '...' : row.docStatus === 'pending' ? 'Générer' : 'Regénérer'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Bouton clôture */}
      {!isLocked && totalClientsActive > 0 && (
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <button
            onClick={() => setConfirmLock(true)}
            style={{ padding: '14px 36px', backgroundColor: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
          >
            Clôturer {MONTHS[selectedMonth - 1]} {selectedYear}
          </button>
          <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
            Les timesheets ne pourront plus être modifiés pour ce mois.
          </p>
        </div>
      )}

      {/* Modal confirmation clôture */}
      {confirmLock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setConfirmLock(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px' }}>Clôturer le mois ?</h2>
            <p style={{ color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
              Vous allez clôturer <strong>{MONTHS[selectedMonth - 1]} {selectedYear}</strong>.
            </p>
            {warnings.length > 0 && (
              <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px' }}>
                {warnings.map((w, i) => <div key={i} style={{ color: '#856400', fontSize: '13px' }}>⚠ {w}</div>)}
              </div>
            )}
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
              Vous pourrez rouvrir le mois à tout moment si nécessaire.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmLock(false)}
                style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Annuler
              </button>
              <button onClick={handleLock} disabled={locking}
                style={{ flex: 1, padding: '12px', background: locking ? '#ccc' : '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: locking ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {locking ? 'Clôture...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
