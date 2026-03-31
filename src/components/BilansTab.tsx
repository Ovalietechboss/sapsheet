import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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

const STATUS_LABEL: Record<ClientDocStatus, string> = { pending: 'À générer', generated: 'Généré', sent: 'Envoyé', error: 'Erreur' };
const STATUS_COLOR: Record<ClientDocStatus, string> = { pending: '#FF9500', generated: '#007AFF', sent: '#34C759', error: '#FF3B30' };
const PERIOD_STATUS_LABEL = { open: 'Ouvert', locked: 'Clôturé', archived: 'Archivé' };
const PERIOD_STATUS_COLOR = { open: '#34C759', locked: '#FF9500', archived: '#888' };

type SubView = 'documents' | 'chronologie';

interface ClientRow {
  clientId: string;
  clientName: string;
  facturationMode: 'CESU' | 'CLASSICAL';
  clientEmail?: string;
  mandataire?: Mandataire;
  timesheetCount: number;
  totalHours: number;
  totalEarnings: number;
  totalFrais: number;
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
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [generating, setGenerating] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [subView, setSubView] = useState<SubView>('documents');

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 3 + i).reverse();

  const currentPeriod = getPeriod(selectedMonth, selectedYear);
  const isLocked = currentPeriod?.status === 'locked' || currentPeriod?.status === 'archived';
  const isArchived = currentPeriod?.status === 'archived';

  // ── Données du mois ────────────────────────────────────────────────────────

  const start = new Date(selectedYear, selectedMonth - 1, 1).getTime();
  const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).getTime();

  const monthTimesheets = useMemo(
    () => timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end).sort((a, b) => a.date_arrival - b.date_arrival),
    [timesheets, start, end]
  );

  const { groups, totalClientsActive, totalHours, totalEarnings, totalFrais, totalMontant, warnings } = useMemo(() => {
    const rows: ClientRow[] = clients.map((client) => {
      const cts = monthTimesheets.filter((ts) => ts.client_id === client.id);
      const totalHours = cts.reduce((s, ts) => s + ts.duration, 0);
      const totalEarnings = totalHours * client.hourly_rate;
      const totalFrais = cts.reduce(
        (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0), 0
      );
      const mandataire = mandataires.find((m) => m.id === client.mandataire_id);
      const persisted = currentPeriod ? getClientStatus(currentPeriod.id, client.id) : null;

      return {
        clientId: client.id,
        clientName: [client.titre, client.first_name, client.name].filter(Boolean).join(' '),
        facturationMode: client.facturation_mode,
        clientEmail: client.email,
        mandataire,
        timesheetCount: cts.length,
        totalHours,
        totalEarnings,
        totalFrais,
        totalAmount: totalEarnings + totalFrais,
        hasDraftTimesheets: cts.some((ts) => ts.status === 'draft'),
        docStatus: (persisted?.status as ClientDocStatus) || 'pending',
        recipientEmail: mandataire?.email || client.email,
      };
    });

    // Grouper par mandataire
    const map = new Map<string, MandataireGroup>();
    rows.forEach((row) => {
      const key = row.mandataire?.id || '__none__';
      if (!map.has(key)) map.set(key, { mandataire: row.mandataire, clients: [], totalAmount: 0, recipientEmail: row.mandataire?.email || row.clientEmail });
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
    if (notGenerated.length > 0) warnings.push(`${notGenerated.length} client${notGenerated.length > 1 ? 's' : ''} sans document généré`);
    if (draftTs.length > 0) warnings.push(`${draftTs.length} client${draftTs.length > 1 ? 's' : ''} avec pointages non validés`);

    return {
      groups,
      totalClientsActive: activeRows.length,
      totalHours: activeRows.reduce((s, r) => s + r.totalHours, 0),
      totalEarnings: activeRows.reduce((s, r) => s + r.totalEarnings, 0),
      totalFrais: activeRows.reduce((s, r) => s + r.totalFrais, 0),
      totalMontant: activeRows.reduce((s, r) => s + r.totalAmount, 0),
      warnings,
    };
  }, [monthTimesheets, clients, mandataires, currentPeriod, getClientStatus]);

  // ── User profile pour templates ────────────────────────────────────────────

  const userProfile = user ? {
    displayName: user.display_name || user.email,
    email: user.email, address: user.address, phone: user.phone,
    cesuNumber: user.cesu_number, siren: user.siren, siret: user.siret,
    businessName: user.business_name, businessAddress: user.business_address,
    iban: user.iban, bic: user.bic,
  } : null;

  // ── Génération PDF ─────────────────────────────────────────────────────────

  const handleGenerate = async (row: ClientRow) => {
    if (!user || !userProfile || isLocked) return;
    setGenerating(row.clientId);
    try {
      const period = await getOrCreatePeriod(selectedMonth, selectedYear);
      const client = clients.find((c) => c.id === row.clientId)!;
      const cts = monthTimesheets.filter((ts) => ts.client_id === client.id);

      const isCESU = client.facturation_mode === 'CESU';
      const clientTag = client.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '');
      const invoiceNumber = isCESU
        ? `CESU-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${clientTag}`
        : `FAC-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${clientTag}`;

      const invoiceData: any = {
        invoice_number: invoiceNumber,
        created_at: Date.now(),
        total_amount: row.totalAmount,
        month: selectedMonth,
        year: selectedYear,
      };

      const html = isCESU
        ? generateCESUTemplate(invoiceData, client, cts, userProfile, row.mandataire)
        : generateClassicalTemplate(invoiceData, client, cts, userProfile, row.mandataire);

      const filename = `${invoiceNumber}`;
      await generateAndSharePDF(html, filename);

      await upsertClientStatus(period.id, client.id, {
        status: 'generated', doc_generated_at: Date.now(), recipient_email: row.recipientEmail,
      });
    } catch (err) {
      console.error('Génération échouée:', err);
      if (currentPeriod) await upsertClientStatus(currentPeriod.id, row.clientId, { status: 'error' });
    } finally {
      setGenerating(null);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const exportToCSV = async () => {
    const headers = ['Date', 'Client', 'Arrivée', 'Départ', 'Heures', 'Taux', 'Salaire', 'IK', 'Repas', 'Transport', 'Autres', 'Total'];
    const rows = monthTimesheets.map((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      const rate = client?.hourly_rate || 0;
      const earnings = ts.duration * rate;
      const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0);
      return [
        new Date(ts.date_arrival).toLocaleDateString('fr-FR'),
        client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : '',
        new Date(ts.date_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ts.duration.toFixed(2), rate.toFixed(2), earnings.toFixed(2),
        (ts.ik_amount || 0).toFixed(2),
        (ts.frais_repas || 0).toFixed(2), (ts.frais_transport || 0).toFixed(2), (ts.frais_autres || 0).toFixed(2),
        (earnings + frais).toFixed(2),
      ].join(';');
    });
    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const filename = `rapport_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = btoa(unescape(encodeURIComponent(csv)));
        const result = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
        await Share.share({ title: 'Export CSV', url: result.uri, dialogTitle: 'Partager le CSV' });
      } catch (error: any) {
        alert(`Erreur export : ${error?.message || 'Erreur'}`);
      }
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  // ── Clôture ────────────────────────────────────────────────────────────────

  const handleLock = async () => {
    setLocking(true);
    try {
      const period = currentPeriod || await getOrCreatePeriod(selectedMonth, selectedYear);
      await lockPeriod(period.id);
      setConfirmLock(false);
    } finally { setLocking(false); }
  };

  const pastPeriods = useMemo(() =>
    [...periods].filter((p) => !(p.month === selectedMonth && p.year === selectedYear))
      .sort((a, b) => b.year - a.year || b.month - a.month),
    [periods, selectedMonth, selectedYear]
  );

  const navigateToPeriod = (p: BillingPeriod) => { setSelectedMonth(p.month); setSelectedYear(p.year); setShowHistory(false); };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR');
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Bilan — {MONTHS[selectedMonth - 1]} {selectedYear}</h2>
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
          <button onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: showHistory ? '#007AFF' : 'white', color: showHistory ? 'white' : '#333', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
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

      {/* Historique */}
      {showHistory && (
        <div style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Mois passés</h3>
          {pastPeriods.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>Aucun mois enregistré</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {pastPeriods.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', borderRadius: '6px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{MONTHS[p.month - 1]} {p.year}</span>
                    <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: PERIOD_STATUS_COLOR[p.status] + '22', color: PERIOD_STATUS_COLOR[p.status] }}>
                      {PERIOD_STATUS_LABEL[p.status]}
                    </span>
                    {p.locked_at && <span style={{ fontSize: '12px', color: '#888' }}>Clôturé le {new Date(p.locked_at).toLocaleDateString('fr-FR')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigateToPeriod(p)} style={{ padding: '6px 12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Voir</button>
                    {p.status === 'locked' && <button onClick={() => archivePeriod(p.id)} style={{ padding: '6px 12px', backgroundColor: '#888', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Archiver</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bannière verrouillé */}
      {isLocked && (
        <div style={{ background: isArchived ? '#f5f5f5' : '#FFF8E7', border: `1px solid ${isArchived ? '#ddd' : '#FF9500'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: isArchived ? '#888' : '#FF9500' }}>
            {isArchived ? 'Mois archivé — lecture seule' : 'Mois clôturé — aucune modification possible'}
          </span>
          {!isArchived && <button onClick={() => unlockPeriod(currentPeriod!.id)} style={{ padding: '6px 14px', backgroundColor: 'white', color: '#FF9500', border: '1px solid #FF9500', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Rouvrir</button>}
        </div>
      )}

      {/* Résumé global — 5 cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Heures" value={`${totalHours.toFixed(1)}h`} bg="#EBF9F0" color="#2d8a4e" />
        <StatCard label="Clients actifs" value={String(totalClientsActive)} bg="#E8F4FF" color="#1a6fb5" />
        <StatCard label="Salaire" value={`${totalEarnings.toFixed(0)}€`} bg="#F0EBFF" color="#5b3db5" />
        <StatCard label="Frais" value={`${totalFrais.toFixed(0)}€`} bg="#FFF4E5" color="#b36b00" />
        <StatCard label="Total" value={`${totalMontant.toFixed(0)}€`} bg="#007AFF" color="#fff" />
      </div>

      {/* Alertes */}
      {!isLocked && warnings.length > 0 && (
        <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', color: '#856400', marginBottom: '6px', fontSize: '13px' }}>Points d'attention avant clôture</div>
          {warnings.map((w, i) => <div key={i} style={{ color: '#856400', fontSize: '13px' }}>• {w}</div>)}
        </div>
      )}

      {/* Sous-navigation : Documents | Chronologie | CSV */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        {([
          { id: 'documents' as SubView, label: `Documents (${totalClientsActive})` },
          { id: 'chronologie' as SubView, label: `Chronologie (${monthTimesheets.length})` },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setSubView(tab.id)}
            style={{
              padding: '10px 20px', border: 'none', borderBottom: subView === tab.id ? '3px solid #007AFF' : '3px solid transparent',
              backgroundColor: 'transparent', color: subView === tab.id ? '#007AFF' : '#888',
              fontWeight: subView === tab.id ? 'bold' : 'normal', fontSize: '14px', cursor: 'pointer', marginBottom: '-2px',
            }}>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={exportToCSV} disabled={monthTimesheets.length === 0}
          style={{ padding: '8px 16px', backgroundColor: monthTimesheets.length === 0 ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: monthTimesheets.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'center', marginBottom: '4px' }}>
          Export CSV
        </button>
      </div>

      {/* ══════ VUE DOCUMENTS — groupé par mandataire ══════ */}
      {subView === 'documents' && (
        <>
          {groups.map((group, gi) => {
            const groupLabel = group.mandataire
              ? `${[group.mandataire.titre, group.mandataire.first_name, group.mandataire.name].filter(Boolean).join(' ')} — ${group.mandataire.association_name}`
              : 'Sans mandataire';
            const borderColor = group.mandataire ? '#007AFF' : '#ccc';

            return (
              <div key={gi} style={{ marginBottom: '16px', border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: group.mandataire ? '#E8F4FF' : '#f5f5f5', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: group.mandataire ? '#1a6fb5' : '#666' }}>{groupLabel}</div>
                    {group.recipientEmail && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>✉️ {group.recipientEmail}</div>}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{group.totalAmount.toFixed(2)}€</span>
                </div>

                {group.clients.map((row) => {
                  const isCESU = row.facturationMode === 'CESU';
                  const color = isCESU ? '#34C759' : '#007AFF';
                  return (
                    <div key={row.clientId} style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', opacity: row.timesheetCount === 0 ? 0.45 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{row.clientName}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: isCESU ? '#EBF9F0' : '#E8F4FF', color, border: `1px solid ${color}` }}>
                            {isCESU ? 'CESU' : 'CLASSIQUE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {row.timesheetCount === 0 ? 'Aucun pointage ce mois' :
                            `${row.timesheetCount} pointage${row.timesheetCount > 1 ? 's' : ''} · ${row.totalHours.toFixed(1)}h · ${row.totalEarnings.toFixed(2)}€${row.totalFrais > 0 ? ` + ${row.totalFrais.toFixed(2)}€ frais` : ''}`
                          }
                          {row.hasDraftTimesheets && row.timesheetCount > 0 && <span style={{ marginLeft: '8px', color: '#FF9500', fontWeight: 'bold' }}>non validés</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                          backgroundColor: STATUS_COLOR[row.docStatus] + '22', color: STATUS_COLOR[row.docStatus],
                          border: `1px solid ${STATUS_COLOR[row.docStatus]}44`,
                        }}>
                          {STATUS_LABEL[row.docStatus]}
                        </span>
                        {row.timesheetCount > 0 && !isLocked && (
                          <button disabled={generating === row.clientId} onClick={() => handleGenerate(row)}
                            style={{ padding: '7px 14px', backgroundColor: generating === row.clientId ? '#ccc' : color, color: 'white', border: 'none', borderRadius: '6px', cursor: generating === row.clientId ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {generating === row.clientId ? '...' : isCESU ? (row.docStatus === 'pending' ? 'Pointage CESU' : 'Regénérer') : (row.docStatus === 'pending' ? 'Facture' : 'Regénérer')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Bouton clôture */}
          {!isLocked && totalClientsActive > 0 && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button onClick={() => setConfirmLock(true)}
                style={{ padding: '14px 36px', backgroundColor: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                Clôturer {MONTHS[selectedMonth - 1]} {selectedYear}
              </button>
              <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>Les pointages ne pourront plus être modifiés pour ce mois.</p>
            </div>
          )}
        </>
      )}

      {/* ══════ VUE CHRONOLOGIE ══════ */}
      {subView === 'chronologie' && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {monthTimesheets.length === 0 ? (
            <div style={{ backgroundColor: '#f9f9f9', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>
              Aucun pointage pour {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : monthTimesheets.map((ts) => {
            const client = clients.find((c) => c.id === ts.client_id);
            const rate = client?.hourly_rate || 0;
            const earnings = ts.duration * rate;
            const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0);
            const isCESU = client?.facturation_mode === 'CESU';
            const color = isCESU ? '#34C759' : '#007AFF';
            return (
              <div key={ts.id} style={{ backgroundColor: 'white', padding: '14px 16px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : 'Inconnu'}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: isCESU ? '#EBF9F0' : '#E8F4FF', color }}>
                      {isCESU ? 'CESU' : 'CLASS.'}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '10px',
                      backgroundColor: ts.status === 'validated' ? '#EBF9F0' : '#FFF4E5',
                      color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00',
                    }}>
                      {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {formatDate(ts.date_arrival)} · {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#007AFF' }}>{ts.duration.toFixed(1)}h</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {earnings.toFixed(2)}€{frais > 0 ? ` + ${frais.toFixed(2)}€` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal confirmation clôture */}
      {confirmLock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setConfirmLock(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px' }}>Clôturer le mois ?</h2>
            <p style={{ color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
              Vous allez clôturer <strong>{MONTHS[selectedMonth - 1]} {selectedYear}</strong>.
            </p>
            {warnings.length > 0 && (
              <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px' }}>
                {warnings.map((w, i) => <div key={i} style={{ color: '#856400', fontSize: '13px' }}>• {w}</div>)}
              </div>
            )}
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>Vous pourrez rouvrir le mois si nécessaire.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmLock(false)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button onClick={handleLock} disabled={locking} style={{ flex: 1, padding: '12px', background: locking ? '#ccc' : '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: locking ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {locking ? 'Clôture...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
  return (
    <div style={{ background: bg, padding: '14px 10px', borderRadius: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
