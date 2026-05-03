import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { generateCESUTemplate, generateClassicalTemplate } from '../services/InvoiceTemplates';
import { generateAndSharePDF } from '../utils/pdfGenerator';
import { isDureeDirecte } from '../utils/timesheetMode';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function ReportsTab() {
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { user } = useAuthStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [generating, setGenerating] = useState<string | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // ─── Données du mois ────────────────────────────────────
  const monthlyData = useMemo(() => {
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    const monthTimesheets = timesheets.filter((ts) => {
      const tsDate = new Date(ts.date_arrival);
      return tsDate >= startDate && tsDate <= endDate;
    });

    const totalHours = monthTimesheets.reduce((sum, ts) => sum + ts.duration, 0);
    const totalFrais = monthTimesheets.reduce(
      (sum, ts) => sum + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
      0,
    );

    // Regrouper par client
    const byClientMap: Record<string, {
      client: typeof clients[0];
      timesheets: typeof monthTimesheets;
      hours: number;
      frais: number;
      earnings: number;
    }> = {};

    monthTimesheets.forEach((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      if (!client) return;
      const earnings = ts.duration * (client.hourly_rate || 0);
      const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);

      if (!byClientMap[client.id]) {
        byClientMap[client.id] = { client, timesheets: [], hours: 0, frais: 0, earnings: 0 };
      }
      byClientMap[client.id].timesheets.push(ts);
      byClientMap[client.id].hours += ts.duration;
      byClientMap[client.id].frais += frais;
      byClientMap[client.id].earnings += earnings;
    });

    const totalEarnings = Object.values(byClientMap).reduce((s, c) => s + c.earnings, 0);

    return {
      monthTimesheets,
      totalHours,
      totalFrais,
      totalEarnings,
      byClient: Object.values(byClientMap),
    };
  }, [timesheets, clients, selectedYear, selectedMonth]);

  // ─── Export CSV ─────────────────────────────────────────
  const buildCSV = () => {
    const headers = ['Date', 'Client', 'Arrivée', 'Départ', 'Heures', 'Taux', 'Salaire', 'Frais Repas', 'Frais Transport', 'Frais Autres', 'Total'];
    const rows = monthlyData.monthTimesheets.map((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      const hourlyRate = client?.hourly_rate || 0;
      const earnings = ts.duration * hourlyRate;
      const total = earnings + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
      const isDuree = isDureeDirecte(ts);
      return [
        new Date(ts.date_arrival).toLocaleDateString('fr-FR'),
        client?.name || '',
        isDuree ? '' : new Date(ts.date_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isDuree ? '' : new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ts.duration.toFixed(2),
        hourlyRate.toFixed(2),
        earnings.toFixed(2),
        (ts.frais_repas || 0).toFixed(2),
        (ts.frais_transport || 0).toFixed(2),
        (ts.frais_autres || 0).toFixed(2),
        total.toFixed(2),
      ].join(';');
    });
    return [headers.join(';'), ...rows].join('\n');
  };

  const exportToCSV = async () => {
    const filename = `rapport_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.csv`;
    const csv = '\uFEFF' + buildCSV(); // BOM UTF-8 pour Excel

    if (Capacitor.isNativePlatform()) {
      // Android : écrire le fichier via Filesystem puis partager
      try {
        const base64 = btoa(unescape(encodeURIComponent(csv)));
        const result = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Export CSV',
          text: 'Rapport mensuel SAP Sheet',
          url: result.uri,
          dialogTitle: 'Partager le fichier CSV',
        });
      } catch (error: any) {
        alert(`Erreur export CSV : ${error?.message || 'Impossible de créer le fichier'}`);
      }
    } else {
      // Web : téléchargement direct via lien
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  // ─── Génération PDF par client ───────────────────────────
  const handleGenerateDocument = async (clientId: string) => {
    const entry = monthlyData.byClient.find((b) => b.client.id === clientId);
    if (!entry || !user) return;

    setGenerating(clientId);
    try {
      const { client, timesheets: clientTimesheets, hours, frais, earnings } = entry;
      const isCESU = client.facturation_mode === 'CESU';

      const invoiceData: any = {
        invoice_number: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${client.name.substring(0, 3).toUpperCase()}`,
        created_at: Date.now(),
        total_amount: earnings + frais,
        month: selectedMonth + 1,
        year: selectedYear,
      };

      const userForTemplate = {
        displayName: user.display_name,
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

      const mandataire = client.mandataire_id
        ? mandataires.find((m) => m.id === client.mandataire_id)
        : undefined;

      const html = isCESU
        ? generateCESUTemplate(invoiceData, client, clientTimesheets, userForTemplate, mandataire)
        : generateClassicalTemplate(invoiceData, client, clientTimesheets, userForTemplate, mandataire);

      const filename = isCESU
        ? `pointage_cesu_${client.name}_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.pdf`
        : `facture_${client.name}_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.pdf`;

      await generateAndSharePDF(html, filename);
    } catch (error) {
      console.error('Erreur génération document:', error);
      alert('Erreur lors de la génération du document');
    } finally {
      setGenerating(null);
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR');

  return (
    <div>
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Rapport mensuel</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportToCSV}
            disabled={monthlyData.monthTimesheets.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: monthlyData.monthTimesheets.length === 0 ? '#ccc' : '#34C759',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: monthlyData.monthTimesheets.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ── Cartes récap ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Heures totales', value: `${monthlyData.totalHours.toFixed(1)}h`, color: '#007AFF' },
          { label: 'Salaire', value: `${monthlyData.totalEarnings.toFixed(2)}€`, color: '#34C759' },
          { label: 'Frais', value: `${monthlyData.totalFrais.toFixed(2)}€`, color: '#FF9500' },
          { label: 'Total', value: `${(monthlyData.totalEarnings + monthlyData.totalFrais).toFixed(2)}€`, color: '#5856D6' },
        ].map((card) => (
          <div key={card.label} style={{ backgroundColor: card.color, color: 'white', padding: '18px', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', margin: '0 0 6px', opacity: 0.9 }}>{card.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 'bold', margin: 0 }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Génération des documents de fin de mois ── */}
      {monthlyData.byClient.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ marginBottom: '14px' }}>
            📄 Documents fin de mois — {MONTHS[selectedMonth]} {selectedYear}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {monthlyData.byClient.map(({ client, hours, frais, earnings }) => {
              const isCESU = client.facturation_mode === 'CESU';
              const color = isCESU ? '#34C759' : '#007AFF';
              const isGenerating = generating === client.id;

              return (
                <div
                  key={client.id}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e8e8e8',
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '16px' }}>{client.name}</span>
                      <span style={{
                        backgroundColor: isCESU ? '#EAFAF1' : '#EBF4FF',
                        color,
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: `1px solid ${color}`,
                      }}>
                        {isCESU ? 'CESU' : 'CLASSIQUE'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                      {hours.toFixed(1)}h · {earnings.toFixed(2)}€
                      {frais > 0 ? ` + ${frais.toFixed(2)}€ frais` : ''}
                      {' · '}
                      <strong style={{ color }}>Total : {(earnings + frais).toFixed(2)}€</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerateDocument(client.id)}
                    disabled={isGenerating}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: isGenerating ? '#ccc' : color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '14px',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isGenerating
                      ? '⏳ Génération...'
                      : isCESU
                      ? '📋 Pointage CESU'
                      : '🧾 Facture'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Liste chronologique ── */}
      <div>
        <h3 style={{ marginBottom: '14px' }}>
          Vue chronologique ({monthlyData.monthTimesheets.length} entrée{monthlyData.monthTimesheets.length > 1 ? 's' : ''})
        </h3>
        {monthlyData.monthTimesheets.length === 0 ? (
          <div style={{ backgroundColor: '#f5f5f5', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>
            Aucune feuille de temps pour {MONTHS[selectedMonth]} {selectedYear}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {[...monthlyData.monthTimesheets]
              .sort((a, b) => a.date_arrival - b.date_arrival)
              .map((ts) => {
                const client = clients.find((c) => c.id === ts.client_id);
                const hourlyRate = client?.hourly_rate || 0;
                const earnings = ts.duration * hourlyRate;
                const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
                const isCESU = client?.facturation_mode === 'CESU';

                return (
                  <div key={ts.id} style={{
                    backgroundColor: 'white',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ fontWeight: 'bold', margin: '0 0 3px' }}>
                        {client?.name}
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          fontWeight: '700',
                          color: isCESU ? '#34C759' : '#007AFF',
                        }}>
                          {isCESU ? 'CESU' : 'CLASSIQUE'}
                        </span>
                      </p>
                      <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                        {formatDate(ts.date_arrival)} · {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 'bold', color: '#007AFF', margin: '0 0 2px' }}>
                        {ts.duration.toFixed(2)}h
                      </p>
                      <p style={{ fontSize: '13px', color: '#34C759', fontWeight: 'bold', margin: 0 }}>
                        {earnings.toFixed(2)}€
                      </p>
                      {frais > 0 && (
                        <p style={{ fontSize: '11px', color: '#FF9500', margin: 0 }}>
                          +{frais.toFixed(2)}€ frais
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
