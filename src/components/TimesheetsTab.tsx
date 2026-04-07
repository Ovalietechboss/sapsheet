import React, { useState, useMemo } from 'react';
import { useTimesheetStore, Timesheet } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useIsMobile } from '../hooks/useMediaQuery';
import ImportRapide from './ImportRapide';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' };

export default function TimesheetsTab() {
  const { timesheets, addTimesheet, updateTimesheet, deleteTimesheet } = useTimesheetStore();
  const { clients } = useClientStore();
  const isMobile = useIsMobile();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const DEFAULT_IK_RATE = 0.603;

  const emptyForm = () => ({
    client_id: '', date_arrival: todayStr(), time_arrival: '', date_departure: todayStr(), time_departure: '',
    direct_hours: '', // mode durée directe
    frais_repas: 0, frais_transport: 0, frais_autres: 0,
    ik_km: 0, ik_rate: DEFAULT_IK_RATE, ik_amount: 0, description: '', notes: '',
  });

  const [formData, setFormData] = useState(emptyForm);
  const [saisieMode, setSaisieMode] = useState<'horaires' | 'duree'>('duree');

  // ── Filtrer et grouper par jour ────────────────────────────────────────

  const { monthTimesheets, dayGroups, totalHours, activeClients } = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1).getTime();
    const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).getTime();
    const filtered = timesheets
      .filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end)
      .sort((a, b) => b.date_arrival - a.date_arrival);

    const totalHours = filtered.reduce((s, ts) => s + ts.duration, 0);
    const activeClients = new Set(filtered.map((ts) => ts.client_id)).size;

    // Grouper par jour
    const groups = new Map<string, Timesheet[]>();
    filtered.forEach((ts) => {
      const d = new Date(ts.date_arrival);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ts);
    });

    return { monthTimesheets: filtered, dayGroups: groups, totalHours, activeClients };
  }, [timesheets, selectedMonth, selectedYear]);

  // ── Navigation mois ────────────────────────────────────────────────────

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  const openCreate = () => { setFormData(emptyForm()); setEditingId(null); setModalMode('create'); };

  const openEdit = (ts: Timesheet) => {
    const arrival = new Date(ts.date_arrival);
    const departure = new Date(ts.date_departure);
    const ds = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const tms = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setFormData({
      client_id: ts.client_id, date_arrival: ds(arrival), time_arrival: tms(arrival),
      date_departure: ds(departure), time_departure: tms(departure),
      frais_repas: ts.frais_repas || 0, frais_transport: ts.frais_transport || 0, frais_autres: ts.frais_autres || 0,
      ik_km: ts.ik_km || 0, ik_rate: ts.ik_rate || DEFAULT_IK_RATE, ik_amount: ts.ik_amount || 0,
      direct_hours: '', description: ts.description || '', notes: ts.notes || '',
    });
    setEditingId(ts.id);
    setModalMode('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) { alert('Veuillez sélectionner un client'); return; }

    let arrival: number, departure: number, duration: number;

    if (saisieMode === 'duree') {
      const h = parseFloat(formData.direct_hours);
      if (!h || h <= 0) { alert('Veuillez saisir un nombre d\'heures valide'); return; }
      duration = Math.round(h * 100) / 100;
      // On place l'arrivée à 9h par défaut
      arrival = new Date(`${formData.date_arrival}T09:00`).getTime();
      departure = arrival + duration * 3600000;
    } else {
      if (!formData.time_arrival || !formData.time_departure) { alert('Veuillez saisir les heures'); return; }
      arrival = new Date(`${formData.date_arrival}T${formData.time_arrival}`).getTime();
      departure = new Date(`${formData.date_departure}T${formData.time_departure}`).getTime();
      duration = (departure - arrival) / (1000 * 60 * 60);
      if (duration <= 0) { alert('L\'heure de départ doit être après l\'heure d\'arrivée'); return; }
      duration = Math.round(duration * 100) / 100;
    }
    const pos = (v: any) => Math.max(0, parseFloat(String(v)) || 0);
    const data = {
      client_id: formData.client_id, date_arrival: arrival, date_departure: departure,
      duration,
      frais_repas: pos(formData.frais_repas), frais_transport: pos(formData.frais_transport), frais_autres: pos(formData.frais_autres),
      ik_km: pos(formData.ik_km), ik_rate: pos(formData.ik_rate), ik_amount: pos(formData.ik_amount),
      description: formData.description || undefined, notes: formData.notes,
    };
    if (modalMode === 'edit' && editingId) updateTimesheet(editingId, data);
    else addTimesheet(data);
    setModalMode(null);
    setFormData(emptyForm());
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : 'Inconnu';
  };

  const formatDayLabel = (dateKey: string) => {
    const d = new Date(dateKey + 'T12:00:00');
    return `${JOURS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div>
      {showImport ? (
        <ImportRapide onClose={() => setShowImport(false)} />
      ) : (
      <>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>Pointages</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && (
            <button onClick={() => setShowImport(true)}
              style={{ padding: '8px 16px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Saisie rapide
            </button>
          )}
          <button onClick={openCreate}
            style={{ padding: '8px 16px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            + Nouveau
          </button>
        </div>
      </div>

      {/* Navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '10px 16px' }}>
        <button onClick={prevMonth} style={{ padding: '6px 14px', backgroundColor: '#f0f2f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>◄</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>{MONTHS[selectedMonth - 1]} {selectedYear}</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
            {monthTimesheets.length} pointage{monthTimesheets.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h · {activeClients} client{activeClients !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={nextMonth} style={{ padding: '6px 14px', backgroundColor: '#f0f2f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>►</button>
      </div>

      {/* Liste groupée par jour */}
      {monthTimesheets.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '40px', background: '#f9f9f9', borderRadius: '10px' }}>
          Aucun pointage pour {MONTHS[selectedMonth - 1]} {selectedYear}
        </div>
      ) : (
        <div>
          {Array.from(dayGroups.entries()).map(([dateKey, dayTs]) => {
            const dayHours = dayTs.reduce((s, ts) => s + ts.duration, 0);
            return (
              <div key={dateKey} style={{ marginBottom: '16px' }}>
                {/* Séparateur jour */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#f0f2f5', borderRadius: '8px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#555' }}>{formatDayLabel(dateKey)}</span>
                  <span style={{ fontSize: '13px', color: '#007AFF', fontWeight: 'bold' }}>{dayHours.toFixed(1)}h</span>
                </div>
                {/* Pointages du jour */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  {dayTs.map((ts) => (
                    <div key={ts.id} style={{ backgroundColor: 'white', padding: isMobile ? '12px' : '14px 16px', borderRadius: '8px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, cursor: 'pointer', minWidth: '150px' }} onClick={() => openEdit(ts)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{getClientName(ts.client_id)}</span>
                          <span style={{
                            padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold',
                            backgroundColor: ts.status === 'validated' ? '#EBF9F0' : '#FFF4E5',
                            color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00',
                          }}>
                            {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)} · <strong style={{ color: '#007AFF' }}>{ts.duration.toFixed(1)}h</strong>
                          {ts.description && <span style={{ color: '#888' }}> · {ts.description}</span>}
                        </div>
                        {!isMobile && (ts.frais_repas > 0 || ts.frais_transport > 0 || ts.frais_autres > 0 || (ts.ik_amount || 0) > 0) && (
                          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                            {(ts.ik_amount || 0) > 0 && <span>IK: {(ts.ik_amount || 0).toFixed(2)}€ </span>}
                            {ts.frais_repas > 0 && <span>Repas: {ts.frais_repas}€ </span>}
                            {ts.frais_transport > 0 && <span>Transport: {ts.frais_transport}€ </span>}
                            {ts.frais_autres > 0 && <span>Autres: {ts.frais_autres}€</span>}
                          </div>
                        )}
                      </div>
                      {/* Boutons — compact sur mobile */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {ts.status !== 'validated' ? (
                          <button onClick={() => updateTimesheet(ts.id, { status: 'validated' })}
                            style={{ padding: isMobile ? '5px 8px' : '6px 12px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                            {isMobile ? '✓' : 'Valider'}
                          </button>
                        ) : (
                          <button onClick={() => updateTimesheet(ts.id, { status: 'draft' })}
                            style={{ padding: isMobile ? '5px 8px' : '6px 12px', backgroundColor: '#FF9500', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                            {isMobile ? '↩' : 'Brouillon'}
                          </button>
                        )}
                        {!isMobile && (
                          <button onClick={() => openEdit(ts)}
                            style={{ padding: '6px 12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                            Modifier
                          </button>
                        )}
                        <button onClick={() => { if (window.confirm('Supprimer ce pointage ?')) deleteTimesheet(ts.id); }}
                          style={{ padding: isMobile ? '5px 8px' : '6px 12px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                          {isMobile ? '✕' : 'Supprimer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Modal création / édition */}
      {modalMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setModalMode(null)}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '10px', width: '92%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>
              {modalMode === 'create' ? 'Nouveau pointage' : 'Modifier le pointage'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Client *</label>
                <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} required style={inputStyle}>
                  <option value="">— Sélectionner un client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{[c.titre, c.first_name, c.name].filter(Boolean).join(' ')}</option>
                  ))}
                </select>
              </div>
              {/* Toggle mode de saisie */}
              <div style={{ display: 'flex', backgroundColor: '#f0f2f5', borderRadius: '8px', padding: '3px', marginBottom: '14px' }}>
                {[
                  { id: 'duree' as const, label: 'Durée directe' },
                  { id: 'horaires' as const, label: 'Heures début/fin' },
                ].map((m) => (
                  <button key={m.id} type="button" onClick={() => setSaisieMode(m.id)}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                      backgroundColor: saisieMode === m.id ? 'white' : 'transparent',
                      color: saisieMode === m.id ? '#007AFF' : '#888',
                      boxShadow: saisieMode === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {saisieMode === 'horaires' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Date arrivée *</label>
                      <input type="date" value={formData.date_arrival}
                        onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value, date_departure: e.target.value })}
                        required style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Heure arrivée *</label>
                      <input type="time" value={formData.time_arrival}
                        onChange={(e) => setFormData({ ...formData, time_arrival: e.target.value })}
                        required style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Date départ *</label>
                      <input type="date" value={formData.date_departure}
                        onChange={(e) => setFormData({ ...formData, date_departure: e.target.value })}
                        required style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Heure départ *</label>
                      <input type="time" value={formData.time_departure}
                        onChange={(e) => setFormData({ ...formData, time_departure: e.target.value })}
                        required style={inputStyle} />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" value={formData.date_arrival}
                      onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value, date_departure: e.target.value })}
                      required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre d'heures *</label>
                    <input type="number" step="0.25" value={formData.direct_hours}
                      onChange={(e) => setFormData({ ...formData, direct_hours: e.target.value })}
                      placeholder="Ex: 2.5"
                      style={{ ...inputStyle, fontSize: '18px', fontWeight: 'bold', color: '#007AFF' }} />
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Prestation réalisée</label>
                <input type="text" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Assistance à domicile, Accompagnement courses..."
                  style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                <label style={{ ...labelStyle, marginBottom: '10px' }}>Indemnités kilométriques</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px', color: '#888' }}>Km parcourus</label>
                    <input type="number" step="0.1" value={formData.ik_km}
                      onChange={(e) => { const km = parseFloat(e.target.value) || 0; setFormData({ ...formData, ik_km: km, ik_amount: Math.round(km * formData.ik_rate * 100) / 100 }); }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px', color: '#888' }}>Tarif/km (€)</label>
                    <input type="number" step="0.001" value={formData.ik_rate}
                      onChange={(e) => { const rate = parseFloat(e.target.value) || 0; setFormData({ ...formData, ik_rate: rate, ik_amount: Math.round(formData.ik_km * rate * 100) / 100 }); }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px', color: '#888' }}>Montant IK (€)</label>
                    <input type="number" step="0.01" value={formData.ik_amount}
                      onChange={(e) => setFormData({ ...formData, ik_amount: parseFloat(e.target.value) || 0 })}
                      style={{ ...inputStyle, fontWeight: 'bold', color: '#007AFF' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Repas (€)</label>
                  <input type="number" step="0.01" value={formData.frais_repas}
                    onChange={(e) => setFormData({ ...formData, frais_repas: parseFloat(e.target.value) || 0 })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Transport (€)</label>
                  <input type="number" step="0.01" value={formData.frais_transport}
                    onChange={(e) => setFormData({ ...formData, frais_transport: parseFloat(e.target.value) || 0 })}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Autres (€)</label>
                  <input type="number" step="0.01" value={formData.frais_autres}
                    onChange={(e) => setFormData({ ...formData, frais_autres: parseFloat(e.target.value) || 0 })}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3} placeholder="Commentaire optionnel..."
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setModalMode(null)}
                  style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                  Annuler
                </button>
                <button type="submit"
                  style={{ flex: 1, padding: '12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
                  {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
