/**
 * BilansTab — Interface de bilan fin de mois
 *
 * Logique d'envoi :
 *   - Client avec mandataire → email au mandataire
 *   - Client sans mandataire → email au client (client.email)
 *
 * Groupement : par mandataire (ou "Sans mandataire" pour les autres).
 * Un seul clic "Envoyer tout" par mandataire envoie un email avec tous les PDFs.
 */
import React, { useState, useMemo } from 'react';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { generateCESUTemplate, generateClassicalTemplate } from '../services/InvoiceTemplates';
import { generateAndSharePDF } from '../utils/pdfGenerator';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// Statuts possibles d'un document client pour le mois
type DocStatus = 'no_timesheets' | 'draft' | 'generated' | 'sent' | 'error';

interface ClientBilan {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  mandataire?: Mandataire;
  timesheetCount: number;
  totalHours: number;
  totalAmount: number;
  hasDraftTimesheets: boolean;
  status: DocStatus;
}

interface MandataireGroup {
  mandataire?: Mandataire;   // undefined = "Sans mandataire"
  clients: ClientBilan[];
  totalAmount: number;
  recipientEmail?: string;   // email de destination du groupe
}

const STATUS_LABEL: Record<DocStatus, string> = {
  no_timesheets: 'Aucun pointage',
  draft: 'À générer',
  generated: 'Généré',
  sent: 'Envoyé',
  error: 'Erreur',
};

const STATUS_COLOR: Record<DocStatus, string> = {
  no_timesheets: '#ccc',
  draft: '#FF9500',
  generated: '#007AFF',
  sent: '#34C759',
  error: '#FF3B30',
};

export default function BilansTab() {
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { user } = useAuthStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  // clientId → statut local (persiste le temps de la session)
  const [statuses, setStatuses] = useState<Record<string, DocStatus>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // ── Calcul des bilans par client ────────────────────────────────────────────

  const groups = useMemo((): MandataireGroup[] => {
    const startDate = new Date(selectedYear, selectedMonth, 1).getTime();
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();

    const clientBilans: ClientBilan[] = clients.map((client) => {
      const clientTimesheets = timesheets.filter(
        (ts) =>
          ts.client_id === client.id &&
          ts.date_arrival >= startDate &&
          ts.date_arrival <= endDate
      );

      const totalHours = clientTimesheets.reduce((s, ts) => s + ts.duration, 0);
      const totalSalaire = totalHours * client.hourly_rate;
      const totalFrais = clientTimesheets.reduce(
        (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
        0
      );
      const hasDraftTimesheets = clientTimesheets.some((ts) => ts.status === 'draft');
      const mandataire = mandataires.find((m) => m.id === client.mandataire_id);

      let status: DocStatus = statuses[client.id] || 'draft';
      if (clientTimesheets.length === 0) status = 'no_timesheets';

      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        mandataire,
        timesheetCount: clientTimesheets.length,
        totalHours,
        totalAmount: totalSalaire + totalFrais,
        hasDraftTimesheets,
        status,
      };
    });

    // Grouper par mandataire
    const grouped = new Map<string, MandataireGroup>();

    clientBilans.forEach((cb) => {
      const key = cb.mandataire?.id || '__none__';
      if (!grouped.has(key)) {
        grouped.set(key, {
          mandataire: cb.mandataire,
          clients: [],
          totalAmount: 0,
          recipientEmail: cb.mandataire?.email || cb.clientEmail,
        });
      }
      const g = grouped.get(key)!;
      g.clients.push(cb);
      g.totalAmount += cb.totalAmount;
    });

    // Trier : mandataires d'abord, "Sans mandataire" à la fin
    return Array.from(grouped.values()).sort((a, b) => {
      if (!a.mandataire) return 1;
      if (!b.mandataire) return -1;
      return a.mandataire.association_name.localeCompare(b.mandataire.association_name);
    });
  }, [timesheets, clients, mandataires, selectedYear, selectedMonth, statuses]);

  // ── Génération PDF pour un client ──────────────────────────────────────────

  const handleGenerate = async (cb: ClientBilan) => {
    if (!user) return;
    setGenerating(cb.clientId);
    try {
      const client = clients.find((c) => c.id === cb.clientId)!;
      const clientTimesheets = timesheets.filter((ts) => {
        const startDate = new Date(selectedYear, selectedMonth, 1).getTime();
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();
        return ts.client_id === client.id && ts.date_arrival >= startDate && ts.date_arrival <= endDate;
      });

      const invoiceData: any = {
        invoice_number: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${client.name.substring(0, 3).toUpperCase()}`,
        created_at: Date.now(),
        total_amount: cb.totalAmount,
        month: selectedMonth + 1,
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

      const html =
        client.facturation_mode === 'CESU'
          ? generateCESUTemplate(invoiceData, client, clientTimesheets, userProfile, cb.mandataire)
          : generateClassicalTemplate(invoiceData, client, clientTimesheets, userProfile, cb.mandataire);

      const filename = `pointage_${client.name.replace(/\s+/g, '_')}_${MONTHS[selectedMonth]}_${selectedYear}`;
      await generateAndSharePDF(html, filename);

      setStatuses((prev) => ({ ...prev, [cb.clientId]: 'generated' }));
    } catch (err) {
      console.error('Génération PDF échouée:', err);
      setStatuses((prev) => ({ ...prev, [cb.clientId]: 'error' }));
    } finally {
      setGenerating(null);
    }
  };

  // ── Totaux globaux ──────────────────────────────────────────────────────────

  const totalClientsWithTimesheets = groups.flatMap((g) => g.clients).filter((c) => c.timesheetCount > 0).length;
  const totalMontant = groups.reduce((s, g) => s + g.totalAmount, 0);

  // ── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête + sélecteur de période */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Bilan fin de mois</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Résumé global */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: '#EBF9F0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#2d8a4e', textTransform: 'uppercase', marginBottom: '4px' }}>Clients actifs</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d8a4e' }}>{totalClientsWithTimesheets}</div>
        </div>
        <div style={{ background: '#E8F4FF', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#1a6fb5', textTransform: 'uppercase', marginBottom: '4px' }}>Mandataires</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a6fb5' }}>
            {groups.filter((g) => g.mandataire).length}
          </div>
        </div>
        <div style={{ background: '#F0EBFF', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#5b3db5', textTransform: 'uppercase', marginBottom: '4px' }}>Total à percevoir</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#5b3db5' }}>{totalMontant.toFixed(2)}€</div>
        </div>
      </div>

      {/* Groupes par mandataire */}
      {groups.map((group, gi) => {
        const groupLabel = group.mandataire
          ? `${group.mandataire.titre ? group.mandataire.titre + ' ' : ''}${group.mandataire.name} — ${group.mandataire.association_name}`
          : 'Sans mandataire';
        const borderColor = group.mandataire ? '#007AFF' : '#ccc';
        const activeClients = group.clients.filter((c) => c.timesheetCount > 0);

        return (
          <div
            key={gi}
            style={{ marginBottom: '24px', border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}
          >
            {/* Header du groupe */}
            <div style={{ background: group.mandataire ? '#E8F4FF' : '#f5f5f5', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', color: group.mandataire ? '#1a6fb5' : '#666' }}>
                  {groupLabel}
                </div>
                {group.recipientEmail && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    ✉️ {group.recipientEmail}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                  {group.totalAmount.toFixed(2)}€
                </span>
                {activeClients.length > 0 && group.recipientEmail && (
                  <button
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#34C759',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                    onClick={() => alert(`Envoi email à ${group.recipientEmail} — fonctionnalité à connecter avec Resend`)}
                  >
                    Envoyer tout ({activeClients.length})
                  </button>
                )}
              </div>
            </div>

            {/* Liste des clients du groupe */}
            {group.clients.map((cb) => (
              <div
                key={cb.clientId}
                style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', opacity: cb.timesheetCount === 0 ? 0.5 : 1 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{cb.clientName}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                    {cb.timesheetCount === 0
                      ? 'Aucun pointage ce mois'
                      : `${cb.timesheetCount} pointage${cb.timesheetCount > 1 ? 's' : ''} · ${cb.totalHours.toFixed(1)}h · ${cb.totalAmount.toFixed(2)}€`}
                    {cb.hasDraftTimesheets && cb.timesheetCount > 0 && (
                      <span style={{ marginLeft: '8px', color: '#FF9500', fontWeight: 'bold' }}>⚠ pointages non validés</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Badge statut */}
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: STATUS_COLOR[cb.status] + '22',
                    color: STATUS_COLOR[cb.status],
                    border: `1px solid ${STATUS_COLOR[cb.status]}44`,
                  }}>
                    {STATUS_LABEL[cb.status]}
                  </span>
                  {/* Bouton générer */}
                  {cb.timesheetCount > 0 && (
                    <button
                      disabled={generating === cb.clientId}
                      onClick={() => handleGenerate(cb)}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: generating === cb.clientId ? '#ccc' : '#007AFF',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: generating === cb.clientId ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                      }}
                    >
                      {generating === cb.clientId ? '...' : 'Générer PDF'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', marginTop: '60px', fontSize: '16px' }}>
          Aucun client à afficher
        </div>
      )}
    </div>
  );
}
