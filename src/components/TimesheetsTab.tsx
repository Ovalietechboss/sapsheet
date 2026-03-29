import React, { useState } from 'react';
import { useTimesheetStore, Timesheet } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' };

export default function TimesheetsTab() {
  const { timesheets, addTimesheet, updateTimesheet, deleteTimesheet } = useTimesheetStore();
  const { clients } = useClientStore();

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const DEFAULT_IK_RATE = 0.603;

  const emptyForm = () => ({
    client_id: '',
    date_arrival: todayStr(),
    time_arrival: '',
    date_departure: todayStr(),
    time_departure: '',
    frais_repas: 0,
    frais_transport: 0,
    frais_autres: 0,
    ik_km: 0,
    ik_rate: DEFAULT_IK_RATE,
    ik_amount: 0,
    notes: '',
  });

  const [formData, setFormData] = useState(emptyForm);

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setModalMode('create');
  };

  const openEdit = (ts: Timesheet) => {
    const arrival = new Date(ts.date_arrival);
    const departure = new Date(ts.date_departure);
    const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    setFormData({
      client_id: ts.client_id,
      date_arrival: dateStr(arrival),
      time_arrival: timeStr(arrival),
      date_departure: dateStr(departure),
      time_departure: timeStr(departure),
      frais_repas: ts.frais_repas || 0,
      frais_transport: ts.frais_transport || 0,
      frais_autres: ts.frais_autres || 0,
      ik_km: ts.ik_km || 0,
      ik_rate: ts.ik_rate || DEFAULT_IK_RATE,
      ik_amount: ts.ik_amount || 0,
      notes: ts.notes || '',
    });
    setEditingId(ts.id);
    setModalMode('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) { alert('Veuillez sélectionner un client'); return; }

    const arrival = new Date(`${formData.date_arrival}T${formData.time_arrival}`).getTime();
    const departure = new Date(`${formData.date_departure}T${formData.time_departure}`).getTime();
    const duration = (departure - arrival) / (1000 * 60 * 60);

    if (duration <= 0) { alert('L\'heure de départ doit être après l\'heure d\'arrivée'); return; }

    const data = {
      client_id: formData.client_id,
      date_arrival: arrival,
      date_departure: departure,
      duration,
      frais_repas: parseFloat(formData.frais_repas.toString()) || 0,
      frais_transport: parseFloat(formData.frais_transport.toString()) || 0,
      frais_autres: parseFloat(formData.frais_autres.toString()) || 0,
      ik_km: parseFloat(formData.ik_km.toString()) || 0,
      ik_rate: parseFloat(formData.ik_rate.toString()) || 0,
      ik_amount: parseFloat(formData.ik_amount.toString()) || 0,
      notes: formData.notes,
    };

    if (modalMode === 'edit' && editingId) {
      updateTimesheet(editingId, data);
    } else {
      addTimesheet(data);
    }

    setModalMode(null);
    setFormData(emptyForm());
  };

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('fr-FR');
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : 'Inconnu';
  };

  // Trier par date décroissante
  const sortedTimesheets = [...timesheets].sort((a, b) => b.date_arrival - a.date_arrival);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Pointages ({timesheets.length})</h2>
        <button
          onClick={openCreate}
          style={{ padding: '10px 20px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          + Nouveau pointage
        </button>
      </div>

      {/* Liste des pointages */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {sortedTimesheets.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px', background: '#f9f9f9', borderRadius: '10px' }}>
            Aucun pointage. Créez votre premier !
          </div>
        ) : sortedTimesheets.map((ts) => (
          <div
            key={ts.id}
            style={{ backgroundColor: 'white', padding: '18px', borderRadius: '10px', border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEdit(ts)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{getClientName(ts.client_id)}</h3>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                    backgroundColor: ts.status === 'validated' ? '#EBF9F0' : '#FFF4E5',
                    color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00',
                  }}>
                    {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                  </span>
                </div>
                <p style={{ color: '#666', marginBottom: '4px', fontSize: '14px' }}>
                  {formatDate(ts.date_arrival)} · {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)}
                </p>
                <p style={{ color: '#007AFF', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>
                  {ts.duration.toFixed(2)}h
                </p>
                {(ts.frais_repas > 0 || ts.frais_transport > 0 || ts.frais_autres > 0 || ts.ik_amount > 0) && (
                  <div style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
                    {ts.ik_amount > 0 && <span>IK: {ts.ik_km}km × {ts.ik_rate}€ = {ts.ik_amount.toFixed(2)}€ </span>}
                    {ts.frais_repas > 0 && <span>Repas: {ts.frais_repas}€ </span>}
                    {ts.frais_transport > 0 && <span>Transport: {ts.frais_transport}€ </span>}
                    {ts.frais_autres > 0 && <span>Autres: {ts.frais_autres}€</span>}
                  </div>
                )}
                {ts.notes && <p style={{ marginTop: '6px', fontStyle: 'italic', color: '#888', fontSize: '13px' }}>{ts.notes}</p>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openEdit(ts)}
                  style={{ padding: '7px 14px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  Modifier
                </button>
                <button onClick={() => { if (window.confirm('Supprimer ce pointage ?')) deleteTimesheet(ts.id); }}
                  style={{ padding: '7px 14px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal création / édition */}
      {modalMode && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setModalMode(null)}
        >
          <div
            style={{ backgroundColor: 'white', padding: '28px', borderRadius: '10px', width: '92%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>
              {modalMode === 'create' ? 'Nouveau pointage' : 'Modifier le pointage'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Client *</label>
                <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} required style={inputStyle}>
                  <option value="">— Sélectionner un client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.titre, c.first_name, c.name].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </div>

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

              {/* Indemnités kilométriques */}
              <div style={{ marginBottom: '14px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                <label style={{ ...labelStyle, marginBottom: '10px' }}>Indemnités kilométriques</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px', color: '#888' }}>Km parcourus</label>
                    <input type="number" step="0.1" value={formData.ik_km}
                      onChange={(e) => {
                        const km = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, ik_km: km, ik_amount: Math.round(km * formData.ik_rate * 100) / 100 });
                      }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px', color: '#888' }}>Tarif/km (€)</label>
                    <input type="number" step="0.001" value={formData.ik_rate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, ik_rate: rate, ik_amount: Math.round(formData.ik_km * rate * 100) / 100 });
                      }}
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

              {/* Autres frais */}
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
