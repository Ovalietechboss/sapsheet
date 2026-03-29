import React, { useState } from 'react';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';

export default function TimesheetsTab() {
  const { timesheets, addTimesheet, deleteTimesheet } = useTimesheetStore();
  const { clients } = useClientStore();
  const [showModal, setShowModal] = useState(false);
  
  console.log('[TimesheetsTab] Rendered. Timesheets:', timesheets.length, 'Clients:', clients.length);
  const todayStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const emptyForm = () => ({
    client_id: '',
    date_arrival: todayStr(),
    time_arrival: '',
    date_departure: todayStr(),
    time_departure: '',
    frais_repas: 0,
    frais_transport: 0,
    frais_autres: 0,
    notes: '',
  });

  const [formData, setFormData] = useState(emptyForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[TimesheetsTab.handleSubmit] Called with formData:', formData);
    
    if (!formData.client_id) {
      alert('Veuillez sélectionner un client');
      return;
    }
    
    const arrival = new Date(`${formData.date_arrival}T${formData.time_arrival}`).getTime();
    const departure = new Date(`${formData.date_departure}T${formData.time_departure}`).getTime();
    const duration = (departure - arrival) / (1000 * 60 * 60); // hours
    console.log('[TimesheetsTab.handleSubmit] Calling addTimesheet with:', { client_id: formData.client_id, arrival, departure, duration });

    addTimesheet({
      client_id: formData.client_id,
      date_arrival: arrival,
      date_departure: departure,
      duration,
      frais_repas: parseFloat(formData.frais_repas.toString()) || 0,
      frais_transport: parseFloat(formData.frais_transport.toString()) || 0,
      frais_autres: parseFloat(formData.frais_autres.toString()) || 0,
      notes: formData.notes,
    });

    setShowModal(false);
    setFormData(emptyForm());
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Timesheets ({timesheets.length})</h2>
        <button
          onClick={() => {
            console.log('[TimesheetsTab] Opening modal, clients:', clients.length);
            setShowModal(true);
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + New Timesheet
        </button>
      </div>

      {/* Timesheets List */}
      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px' }}>
        {timesheets.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No timesheets yet. Create your first one!</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {timesheets.map((timesheet) => (
              <div
                key={timesheet.id}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '8px' }}>{getClientName(timesheet.client_id)}</h3>
                    <p style={{ color: '#666', marginBottom: '4px' }}>
                      📅 {formatDate(timesheet.date_arrival)} • {formatTime(timesheet.date_arrival)} → {formatTime(timesheet.date_departure)}
                    </p>
                    <p style={{ color: '#666', marginBottom: '8px' }}>
                      ⏱️ Duration: {timesheet.duration.toFixed(2)}h
                    </p>
                    {(timesheet.frais_repas > 0 || timesheet.frais_transport > 0 || timesheet.frais_autres > 0) && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Frais annexes:</p>
                        {timesheet.frais_repas > 0 && <p style={{ color: '#666' }}>🍽️ Repas: {timesheet.frais_repas}€</p>}
                        {timesheet.frais_transport > 0 && <p style={{ color: '#666' }}>🚗 Transport: {timesheet.frais_transport}€</p>}
                        {timesheet.frais_autres > 0 && <p style={{ color: '#666' }}>💰 Autres: {timesheet.frais_autres}€</p>}
                      </div>
                    )}
                    {timesheet.notes && (
                      <p style={{ marginTop: '12px', fontStyle: 'italic', color: '#666' }}>
                        📝 {timesheet.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTimesheet(timesheet.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ff3b30',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>New Timesheet</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Date Arrival</label>
                  <input
                    type="date"
                    value={formData.date_arrival}
                    onChange={(e) => setFormData({ ...formData, date_arrival: e.target.value, date_departure: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Time Arrival</label>
                  <input
                    type="time"
                    value={formData.time_arrival}
                    onChange={(e) => setFormData({ ...formData, time_arrival: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Date Departure</label>
                  <input
                    type="date"
                    value={formData.date_departure}
                    onChange={(e) => setFormData({ ...formData, date_departure: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Time Departure</label>
                  <input
                    type="time"
                    value={formData.time_departure}
                    onChange={(e) => setFormData({ ...formData, time_departure: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Frais Repas (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.frais_repas}
                  onChange={(e) => setFormData({ ...formData, frais_repas: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Frais Transport (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.frais_transport}
                  onChange={(e) => setFormData({ ...formData, frais_transport: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Frais Autres (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.frais_autres}
                  onChange={(e) => setFormData({ ...formData, frais_autres: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => console.log('[TimesheetsTab] Create button clicked, formData:', formData)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#007AFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
