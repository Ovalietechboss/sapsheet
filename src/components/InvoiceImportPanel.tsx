import React, { useEffect, useMemo, useState } from 'react';
import { useInvoiceStore } from '../stores/invoiceStore.supabase';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useBillingPeriodStore } from '../stores/billingPeriodStore.supabase';
import { reconstructDomiTempsInvoiceHistory } from '../services/invoiceHistoryReconstruction';
import { consolidateInvoiceImport, findImportOverlaps, type ManualLegacyInvoice } from '../services/invoiceImport';

/**
 * Écran de reprise/import de l'historique 2026 :
 *  - Bloc A (auto) : factures DomiTemps déjà générées (reconstruites), mois courant exclu.
 *  - Bloc B (manuel) : factures facture.net saisies à la main.
 *  → consolidation triée par date, numérotation AAAA-NNN (ancien n°), validation PO, création idempotente.
 */
export default function InvoiceImportPanel() {
  const { invoices, addInvoice } = useInvoiceStore();
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { periods, periodClients, hydratePeriods } = useBillingPeriodStore();

  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState<ManualLegacyInvoice[]>([]);
  const [form, setForm] = useState({ oldNumber: '', date: '', clientId: '', amount: '', paid: false });
  const [creating, setCreating] = useState(false);

  const [{ year, cutoffMonth }] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), cutoffMonth: d.getMonth() + 1 };
  });

  useEffect(() => { hydratePeriods(); }, [hydratePeriods]);

  const domitemps = useMemo(
    () => reconstructDomiTempsInvoiceHistory({ periods, periodClients, clients, timesheets, before: { month: cutoffMonth, year } }),
    [periods, periodClients, clients, timesheets, cutoffMonth, year],
  );
  const consolidated = useMemo(
    () => consolidateInvoiceImport({ domitemps, manual, year, startSeq: 1 }),
    [domitemps, manual, year],
  );
  const overlaps = useMemo(() => findImportOverlaps(consolidated, invoices), [consolidated, invoices]);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR');

  const addManual = () => {
    if (!form.clientId || !form.date || !form.amount) { alert('Client, date et montant sont requis.'); return; }
    const client = clients.find((c) => c.id === form.clientId);
    setManual([...manual, {
      oldNumber: form.oldNumber.trim() || '(facture.net)',
      date: new Date(form.date).getTime(),
      clientId: form.clientId,
      clientName: client?.name || '',
      amount: parseFloat(form.amount),
      paid: form.paid,
    }]);
    setForm({ oldNumber: '', date: '', clientId: '', amount: '', paid: false });
  };

  const handleCreate = async () => {
    const toCreate = consolidated.filter(
      (c) => !invoices.some((i) => i.client_id === c.clientId && i.month === c.month && i.year === c.year),
    );
    if (toCreate.length === 0) { alert('Rien à créer (déjà importé).'); return; }
    if (!window.confirm(`Créer ${toCreate.length} facture(s) sur ${consolidated.length} ? Les doublons (déjà présents) sont ignorés.`)) return;
    setCreating(true);
    try {
      for (const c of toCreate) {
        await addInvoice({
          invoice_number: c.newNumber, client_id: c.clientId, status: c.status,
          total_amount: c.amount, month: c.month, year: c.year,
          generated_at: c.date, facturation_mode: 'CLASSICAL',
        });
      }
      alert(`${toCreate.length} facture(s) créée(s).`);
      setManual([]);
    } catch (e) {
      console.error('Import création échouée:', e);
      alert('Erreur lors de la création.');
    } finally {
      setCreating(false);
    }
  };

  const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd', fontSize: '12px', color: '#666' };
  const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' };

  return (
    <div style={{ border: '1px dashed #5856D6', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px', background: '#faf9ff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <strong>📥 Reprise / import historique {year} ({consolidated.length})</strong>
        <span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: '14px' }}>
          {/* Bloc A */}
          <p style={{ fontWeight: 600, margin: '6px 0' }}>A. Historique DomiTemps (auto) — {domitemps.length} factures (mois courant exclu)</p>
          {domitemps.length === 0 && <p style={{ color: '#999', fontSize: '13px' }}>Aucune (vérifie d'avoir ouvert l'onglet Bilans pour charger les périodes).</p>}

          {/* Bloc B */}
          <p style={{ fontWeight: 600, margin: '14px 0 6px' }}>B. Factures facture.net (saisie manuelle)</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <input style={{ ...inp, width: '130px' }} placeholder="N° facture.net" value={form.oldNumber} onChange={(e) => setForm({ ...form, oldNumber: e.target.value })} />
            <input style={inp} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select style={inp} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">— Client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input style={{ ...inp, width: '100px' }} type="number" placeholder="Montant €" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <label style={{ fontSize: '13px' }}><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> payée</label>
            <button onClick={addManual} style={{ padding: '6px 12px', background: '#5856D6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>+ Ajouter</button>
          </div>
          {manual.length > 0 && (
            <p style={{ fontSize: '12px', color: '#666' }}>{manual.length} facture(s) facture.net saisie(s).
              <button onClick={() => setManual([])} style={{ marginLeft: '8px', fontSize: '12px', cursor: 'pointer' }}>tout effacer</button>
            </p>
          )}

          {/* Alertes anti-doublon */}
          {overlaps.length > 0 && (
            <div style={{ background: '#fff3e0', border: '1px solid #fb8c00', borderRadius: '6px', padding: '8px 10px', margin: '10px 0', fontSize: '13px', color: '#e65100' }}>
              ⚠️ {overlaps.length} alerte(s) :<br />{overlaps.map((w, i) => <span key={i}>• {w}<br /></span>)}
            </div>
          )}

          {/* Aperçu consolidé */}
          <p style={{ fontWeight: 600, margin: '14px 0 6px' }}>Aperçu consolidé (trié par date) — à valider</p>
          <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead><tr><th style={th}>N°</th><th style={th}>Date</th><th style={th}>Client</th><th style={th}>Montant</th><th style={th}>Statut</th><th style={th}>Source</th></tr></thead>
              <tbody>
                {consolidated.map((c) => (
                  <tr key={c.seq}>
                    <td style={td}>{c.newNumber}</td>
                    <td style={td}>{fmtDate(c.date)}</td>
                    <td style={td}>{c.clientName}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.amount.toFixed(2)} €</td>
                    <td style={td}>{c.status === 'paid' ? 'Payée' : 'Envoyée'}</td>
                    <td style={td}>{c.source}</td>
                  </tr>
                ))}
                {consolidated.length === 0 && <tr><td style={td} colSpan={6}>Rien à importer pour l'instant.</td></tr>}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || consolidated.length === 0}
            style={{ marginTop: '12px', padding: '10px 20px', background: creating || consolidated.length === 0 ? '#ccc' : '#34C759', color: '#fff', border: 'none', borderRadius: '6px', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {creating ? 'Création…' : `✅ Valider et créer (${consolidated.length})`}
          </button>
          <p style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>Idempotent : une facture déjà présente (client + mois) n'est pas recréée.</p>
        </div>
      )}
    </div>
  );
}
