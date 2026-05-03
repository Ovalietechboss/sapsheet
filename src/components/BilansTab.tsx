import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore, ClientContact } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { useBillingPeriodStore, BillingPeriod, ClientDocStatus } from '../stores/billingPeriodStore.supabase';
import { generateCESUTemplate, generateClassicalTemplate, generateRecapTemplate } from '../services/InvoiceTemplates';
import { generateAndSharePDF } from '../utils/pdfGenerator';
import { isDureeDirecte } from '../utils/timesheetMode';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const STATUS_LABEL: Record<ClientDocStatus, string> = { pending: 'À générer', generated: 'Généré', sent: 'Envoyé', error: 'Erreur' };
const STATUS_COLOR: Record<ClientDocStatus, string> = { pending: '#FF9500', generated: '#007AFF', sent: '#34C759', error: '#FF3B30' };
const PERIOD_STATUS_LABEL = { open: 'Ouvert', locked: 'Clôturé', archived: 'Archivé' };
const PERIOD_STATUS_COLOR = { open: '#34C759', locked: '#FF9500', archived: '#888' };

type SubView = 'documents' | 'chronologie' | 'synthese';

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
  const { clients, getContactsForClient } = useClientStore();
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
  const [showNova, setShowNova] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; mode: 'CESU' | 'CLASSICAL' } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<{ mode: 'CESU' | 'CLASSICAL'; alreadyGen: number; pending: number } | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);

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
      const totalEarnings = cts.reduce((s, ts) => s + Math.round(ts.duration * client.hourly_rate * 100) / 100, 0);
      const totalFrais = cts.reduce(
        (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0)), 0
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

      const clientContacts = getContactsForClient(client.id);

      const html = isCESU
        ? generateCESUTemplate(invoiceData, client, cts, userProfile, row.mandataire, clientContacts)
        : generateClassicalTemplate(invoiceData, client, cts, userProfile, row.mandataire, clientContacts);

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

  // ── Génération en masse ────────────────────────────────────────────────────

  const handleGenerateBulk = async (mode: 'CESU' | 'CLASSICAL', force: boolean) => {
    if (isLocked || !user || !userProfile) return;
    const allClients = groups.flatMap((g) => g.clients);
    const targets = allClients.filter((r) =>
      r.facturationMode === mode &&
      r.timesheetCount > 0 &&
      (force || r.docStatus === 'pending')
    );
    if (targets.length === 0) return;
    setBulkProgress({ done: 0, total: targets.length, mode });
    for (let i = 0; i < targets.length; i++) {
      await handleGenerate(targets[i]);
      setBulkProgress({ done: i + 1, total: targets.length, mode });
    }
    setBulkProgress(null);
  };

  const handleExportRecap = async () => {
    if (totalClientsActive === 0 || !user || !userProfile) return;
    setGenerating('recap');
    try {
      const filename = `Recap_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const html = generateRecapTemplate({
        month: selectedMonth,
        year: selectedYear,
        groups,
        totals: {
          hours: totalHours,
          earnings: totalEarnings,
          frais: totalFrais,
          amount: totalMontant,
          clientCount: totalClientsActive,
        },
        user: userProfile,
      });
      await generateAndSharePDF(html, filename);
    } catch (err) {
      console.error('Export récap échoué:', err);
    } finally {
      setGenerating(null);
    }
  };

  const startBulk = (mode: 'CESU' | 'CLASSICAL') => {
    if (isLocked) return;
    const targets = groups.flatMap((g) => g.clients).filter(
      (r) => r.facturationMode === mode && r.timesheetCount > 0
    );
    if (targets.length === 0) {
      alert(`Aucun client ${mode === 'CESU' ? 'CESU' : 'classique'} avec des pointages ce mois.`);
      return;
    }
    const alreadyGen = targets.filter((r) => r.docStatus === 'generated' || r.docStatus === 'sent').length;
    if (alreadyGen > 0) {
      setConfirmBulk({ mode, alreadyGen, pending: targets.length - alreadyGen });
      return;
    }
    handleGenerateBulk(mode, false);
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const exportToCSV = async () => {
    const headers = ['Date', 'Client', 'Arrivée', 'Départ', 'Heures', 'Taux', 'Salaire', 'IK', 'Repas', 'Transport', 'Autres', 'Total'];
    const rows = monthTimesheets.map((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      const rate = client?.hourly_rate || 0;
      const earnings = ts.duration * rate;
      const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0));
      const isDuree = isDureeDirecte(ts);
      return [
        new Date(ts.date_arrival).toLocaleDateString('fr-FR'),
        client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : '',
        isDuree ? '' : new Date(ts.date_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isDuree ? '' : new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ts.duration.toFixed(2), rate.toFixed(2), earnings.toFixed(2),
        (Math.max(0, ts.ik_amount || 0)).toFixed(2),
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

  // ── Données NOVA (trimestriel) ─────────────────────────────────────────
  const novaData = useMemo(() => {
    // Déterminer le trimestre du mois sélectionné
    const quarter = Math.floor((selectedMonth - 1) / 3); // 0=T1, 1=T2, 2=T3, 3=T4
    const monthsInQuarter = [quarter * 3 + 1, quarter * 3 + 2, quarter * 3 + 3];
    const quarterLabel = `T${quarter + 1} ${selectedYear}`;

    const months = monthsInQuarter.map((m) => {
      const s = new Date(selectedYear, m - 1, 1).getTime();
      const e = new Date(selectedYear, m, 0, 23, 59, 59).getTime();
      const mTs = timesheets.filter((ts) => ts.date_arrival >= s && ts.date_arrival <= e);
      const hours = mTs.reduce((sum, ts) => sum + ts.duration, 0);
      const distinctClients = new Set(mTs.map((ts) => ts.client_id)).size;
      const ca = mTs.reduce((sum, ts) => {
        const client = clients.find((c) => c.id === ts.client_id);
        return sum + Math.round(ts.duration * (client?.hourly_rate || 0) * 100) / 100;
      }, 0);
      return {
        label: MONTHS[m - 1],
        hours: Math.ceil(hours),
        clients: distinctClients,
        ca,
      };
    });

    return { quarterLabel, months, monthsInQuarter };
  }, [timesheets, selectedMonth, selectedYear]);

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
          { id: 'synthese' as SubView, label: `Synthèse` },
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
        <button onClick={() => setShowNova(true)}
          style={{ padding: '8px 16px', backgroundColor: '#AF52DE', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'center', marginBottom: '4px', marginRight: '8px' }}>
          NOVA
        </button>
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
                      <div style={{ flex: 1, cursor: row.timesheetCount > 0 ? 'pointer' : 'default' }}
                        onClick={() => row.timesheetCount > 0 && setDetailClient(row)}
                        title={row.timesheetCount > 0 ? 'Voir le détail des pointages' : ''}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{row.clientName}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: isCESU ? '#EBF9F0' : '#E8F4FF', color, border: `1px solid ${color}` }}>
                            {isCESU ? 'CESU' : 'CLASSIQUE'}
                          </span>
                          {row.timesheetCount > 0 && <span style={{ fontSize: '10px', color: '#888' }}>↗ détail</span>}
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

          {/* Génération en masse */}
          {!isLocked && totalClientsActive > 0 && (() => {
            const all = groups.flatMap((g) => g.clients).filter((r) => r.timesheetCount > 0);
            const cesuCount = all.filter((r) => r.facturationMode === 'CESU').length;
            const classicCount = all.filter((r) => r.facturationMode === 'CLASSICAL').length;
            return (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {cesuCount > 0 && (
                  <button onClick={() => startBulk('CESU')} disabled={!!bulkProgress}
                    style={{ padding: '12px 24px', backgroundColor: bulkProgress ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    Générer tous les CESU ({cesuCount})
                  </button>
                )}
                {classicCount > 0 && (
                  <button onClick={() => startBulk('CLASSICAL')} disabled={!!bulkProgress}
                    style={{ padding: '12px 24px', backgroundColor: bulkProgress ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    Générer toutes les factures ({classicCount})
                  </button>
                )}
              </div>
            );
          })()}

          {/* Progression bulk */}
          {bulkProgress && (
            <div style={{ marginTop: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Génération {bulkProgress.mode === 'CESU' ? 'CESU' : 'factures'} en cours… <strong>{bulkProgress.done}/{bulkProgress.total}</strong>
            </div>
          )}

          {/* Bouton clôture */}
          {!isLocked && totalClientsActive > 0 && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button onClick={() => setConfirmLock(true)} disabled={!!bulkProgress}
                style={{ padding: '14px 36px', backgroundColor: bulkProgress ? '#ccc' : '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
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
            const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0));
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
                    {formatDate(ts.date_arrival)}
                    {!isDureeDirecte(ts) && ` · ${formatTime(ts.date_arrival)} → ${formatTime(ts.date_departure)}`}
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

      {/* ══════ VUE SYNTHESE ══════ */}
      {subView === 'synthese' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Synthèse {MONTHS[selectedMonth - 1]} {selectedYear}</h3>
            <button onClick={handleExportRecap} disabled={totalClientsActive === 0 || generating === 'recap'}
              style={{ padding: '10px 20px', backgroundColor: (totalClientsActive === 0 || generating === 'recap') ? '#ccc' : '#5b3db5', color: 'white', border: 'none', borderRadius: '8px', cursor: (totalClientsActive === 0 || generating === 'recap') ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {generating === 'recap' ? 'Export…' : 'Exporter récap PDF'}
            </button>
          </div>

          {totalClientsActive === 0 ? (
            <div style={{ background: '#f9f9f9', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>
              Aucun pointage pour {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Client</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Mode</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Heures</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Salaire</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Frais</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const activeRows = group.clients.filter((r) => r.timesheetCount > 0);
                    if (activeRows.length === 0) return null;
                    return (
                      <React.Fragment key={group.mandataire?.id || '__none__'}>
                        {group.mandataire && (
                          <tr style={{ background: '#E8F4FF' }}>
                            <td colSpan={6} style={{ padding: '8px 14px', fontWeight: 'bold', color: '#1a6fb5', fontSize: '12px' }}>
                              {[group.mandataire.titre, group.mandataire.first_name, group.mandataire.name].filter(Boolean).join(' ')} — {group.mandataire.association_name}
                            </td>
                          </tr>
                        )}
                        {activeRows.map((row) => (
                          <tr key={row.clientId} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                            onClick={() => setDetailClient(row)}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <td style={{ padding: '10px 14px', fontWeight: '500' }}>{row.clientName}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', backgroundColor: row.facturationMode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color: row.facturationMode === 'CESU' ? '#2d8a4e' : '#1a6fb5' }}>
                                {row.facturationMode === 'CESU' ? 'CESU' : 'CLASS.'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalHours.toFixed(2)}h</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalEarnings.toFixed(2)}€</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalFrais > 0 ? `${row.totalFrais.toFixed(2)}€` : '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>{row.totalAmount.toFixed(2)}€</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr style={{ backgroundColor: '#5b3db5', color: 'white', fontWeight: 'bold' }}>
                    <td colSpan={2} style={{ padding: '14px', fontSize: '14px' }}>TOTAUX — {totalClientsActive} client{totalClientsActive > 1 ? 's' : ''}</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalHours.toFixed(2)}h</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalEarnings.toFixed(2)}€</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalFrais.toFixed(2)}€</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '15px' }}>{totalMontant.toFixed(2)}€</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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

      {/* Modal détail pointages d'un client */}
      {detailClient && (() => {
        const clientTs = monthTimesheets.filter((ts) => ts.client_id === detailClient.clientId);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setDetailClient(null)}>
            <div style={{ background: 'white', padding: '24px 28px', borderRadius: '12px', width: '92%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '19px' }}>{detailClient.clientName}</h2>
                  <p style={{ margin: '2px 0 0', color: '#888', fontSize: '13px' }}>
                    {MONTHS[selectedMonth - 1]} {selectedYear} · {detailClient.timesheetCount} pointage{detailClient.timesheetCount > 1 ? 's' : ''} · {detailClient.totalHours.toFixed(2)}h · {detailClient.totalAmount.toFixed(2)}€
                  </p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: detailClient.facturationMode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color: detailClient.facturationMode === 'CESU' ? '#2d8a4e' : '#1a6fb5' }}>
                  {detailClient.facturationMode === 'CESU' ? 'CESU' : 'CLASSIQUE'}
                </span>
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gap: '6px' }}>
                {clientTs.map((ts) => {
                  const fraisJour = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + Math.max(0, ts.ik_amount || 0);
                  return (
                    <div key={ts.id} style={{ background: '#f9f9fb', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderLeft: ts.status === 'validated' ? '3px solid #34C759' : '3px solid #FF9500' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
                          {formatDate(ts.date_arrival)}
                          {!isDureeDirecte(ts) && <span style={{ color: '#666' }}> · {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)}</span>}
                        </div>
                        {ts.description && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{ts.description}</div>}
                        {fraisJour > 0 && (
                          <div style={{ fontSize: '11px', color: '#b36b00', marginTop: '2px' }}>
                            Frais : {fraisJour.toFixed(2)}€
                            {(ts.ik_amount || 0) > 0 && ` · IK ${(ts.ik_amount || 0).toFixed(2)}€`}
                            {(ts.frais_repas || 0) > 0 && ` · Repas ${ts.frais_repas.toFixed(2)}€`}
                            {(ts.frais_transport || 0) > 0 && ` · Transport ${ts.frais_transport.toFixed(2)}€`}
                            {(ts.frais_autres || 0) > 0 && ` · Autres ${ts.frais_autres.toFixed(2)}€`}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#007AFF' }}>{ts.duration.toFixed(2)}h</div>
                        <div style={{ fontSize: '10px', color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00', fontWeight: '600', textTransform: 'uppercase' }}>
                          {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailClient(null)}
                  style={{ padding: '10px 22px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmation régénération en masse */}
      {confirmBulk && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setConfirmBulk(null)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px' }}>
              {confirmBulk.mode === 'CESU' ? 'Régénérer les CESU ?' : 'Régénérer les factures ?'}
            </h2>
            <p style={{ color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
              <strong>{confirmBulk.alreadyGen}</strong> document{confirmBulk.alreadyGen > 1 ? 's' : ''} déjà généré{confirmBulk.alreadyGen > 1 ? 's' : ''}.
              {confirmBulk.pending > 0 && <> {confirmBulk.pending} en attente.</>}
            </p>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>Régénérer remplacera les fichiers déjà téléchargés.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmBulk(null)}
                style={{ flex: '1 1 100px', padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Annuler
              </button>
              {confirmBulk.pending > 0 && (
                <button onClick={() => { const m = confirmBulk.mode; setConfirmBulk(null); handleGenerateBulk(m, false); }}
                  style={{ flex: '1 1 100px', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Seulement les {confirmBulk.pending} en attente
                </button>
              )}
              <button onClick={() => { const m = confirmBulk.mode; setConfirmBulk(null); handleGenerateBulk(m, true); }}
                style={{ flex: '1 1 100px', padding: '12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Tout régénérer ({confirmBulk.alreadyGen + confirmBulk.pending})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL NOVA ══════ */}
      {showNova && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowNova(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '92%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Déclaration NOVA</h2>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>{novaData.quarterLabel} — Mode prestataire</p>
              </div>
              <span style={{ padding: '4px 12px', backgroundColor: '#AF52DE22', color: '#AF52DE', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #AF52DE44' }}>EMA</span>
            </div>

            <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
              Recopiez ces valeurs dans votre espace <strong>NOVA</strong> → Mes statistiques → Mes données d'activité → À saisir.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#888', borderBottom: '2px solid #ddd' }}></th>
                  {novaData.months.map((m) => (
                    <th key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#333', borderBottom: '2px solid #ddd' }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Intervenants</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#333', borderBottom: '1px solid #eee' }}>1</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Dont salarié</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#888', borderBottom: '1px solid #eee' }}>0</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#F0EBFF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Heures</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#5b3db5', borderBottom: '1px solid #eee' }}>{m.hours}</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#E8F4FF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Particuliers</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#1a6fb5', borderBottom: '1px solid #eee' }}>{m.clients}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px' }}>Masse salariale</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#888' }}>0</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#EBF9F0', borderTop: '2px solid #34C759' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', color: '#2d8a4e' }}>CA (hors frais/IK)</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#2d8a4e' }}>{m.ca.toFixed(2)}€</td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#856400' }}>
              Les heures sont arrondies à l'entier supérieur. Le CA correspond aux heures × taux horaire (hors frais annexes, transport et IK).
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowNova(false)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Fermer
              </button>
              <a href="https://nova.entreprises.gouv.fr/" target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, padding: '12px', background: '#AF52DE', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Ouvrir NOVA
              </a>
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
