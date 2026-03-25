import React, { useState } from 'react';
import { useClientStore } from '../stores/clientStore.supabase';

export default function ClientsTab() {
  const { clients, addClient, deleteClient } = useClientStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    facturation_mode: 'CESU' as 'CESU' | 'CLASSICAL',
    hourly_rate: 15.5,
    mandataire_name: '',
    mandataire_email: '',
    mandataire_siren: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addClient({
      name: formData.name,
      address: formData.address,
      facturation_mode: formData.facturation_mode,
      hourly_rate: formData.hourly_rate,
      mandataire_name: formData.facturation_mode === 'CLASSICAL' ? formData.mandataire_name : undefined,
      mandataire_email: formData.facturation_mode === 'CLASSICAL' ? formData.mandataire_email : undefined,
      mandataire_siren: formData.facturation_mode === 'CLASSICAL' ? formData.mandataire_siren : undefined,
    });

    setShowModal(false);
    setFormData({
      name: '',
      address: '',
      facturation_mode: 'CESU',
      hourly_rate: 15.5,
      mandataire_name: '',
      mandataire_email: '',
      mandataire_siren: '',
    });
  };

  const cesuClients = clients.filter((c) => c.facturation_mode === 'CESU');
  const classicalClients = clients.filter((c) => c.facturation_mode === 'CLASSICAL');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Clients ({clients.length})</h2>
        <button
          onClick={() => setShowModal(true)}
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
          + New Client
        </button>
      </div>

      {/* CESU Clients */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            backgroundColor: '#34C759', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>CESU</span>
          {cesuClients.length} clients
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {cesuClients.map((client) => (
            <div
              key={client.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '2px solid #34C759',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '18px' }}>{client.name}</h4>
                  <p style={{ color: '#666', marginBottom: '4px' }}>📍 {client.address}</p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>💰 {client.hourly_rate}€/heure</p>
                  {client.mandataire_name && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Mandataire:</p>
                      <p style={{ color: '#666' }}>{client.mandataire_name}</p>
                      <p style={{ color: '#666' }}>{client.mandataire_email}</p>
                      <p style={{ color: '#666' }}>SIREN: {client.mandataire_siren}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteClient(client.id)}
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
      </div>

      {/* Classical Clients */}
      <div>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            backgroundColor: '#007AFF', 
            color: 'white', 
            padding: '4px 12px', 
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>CLASSICAL</span>
          {classicalClients.length} clients
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {classicalClients.map((client) => (
            <div
              key={client.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '2px solid #007AFF',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '18px' }}>{client.name}</h4>
                  <p style={{ color: '#666', marginBottom: '4px' }}>📍 {client.address}</p>
                  <p style={{ color: '#666', marginBottom: '4px' }}>💰 {client.hourly_rate}€/heure</p>
                  {client.mandataire_name && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>Mandataire:</p>
                      <p style={{ color: '#666' }}>{client.mandataire_name}</p>
                      <p style={{ color: '#666' }}>{client.mandataire_email}</p>
                      <p style={{ color: '#666' }}>SIREN: {client.mandataire_siren}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteClient(client.id)}
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
            <h2 style={{ marginBottom: '20px' }}>New Client</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Famille Dubois"
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  placeholder="Ex: 123 Rue de Paris, 75001 Paris"
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Facturation Mode</label>
                <select
                  value={formData.facturation_mode}
                  onChange={(e) => setFormData({ ...formData, facturation_mode: e.target.value as 'CESU' | 'CLASSICAL' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                >
                  <option value="CESU">CESU</option>
                  <option value="CLASSICAL">Classical</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Hourly Rate (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
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

              {formData.facturation_mode === 'CLASSICAL' && (
                <>
                  <div style={{ marginBottom: '16px', paddingTop: '16px', borderTop: '2px solid #007AFF' }}>
                    <h3 style={{ marginBottom: '12px', color: '#007AFF' }}>Mandataire Info</h3>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Mandataire Name</label>
                    <input
                      type="text"
                      value={formData.mandataire_name}
                      onChange={(e) => setFormData({ ...formData, mandataire_name: e.target.value })}
                      placeholder="Ex: Monsieur Y"
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
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Mandataire Email</label>
                    <input
                      type="email"
                      value={formData.mandataire_email}
                      onChange={(e) => setFormData({ ...formData, mandataire_email: e.target.value })}
                      placeholder="Ex: contact@mandataire.fr"
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
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>SIREN</label>
                    <input
                      type="text"
                      value={formData.mandataire_siren}
                      onChange={(e) => setFormData({ ...formData, mandataire_siren: e.target.value })}
                      placeholder="Ex: 123456789"
                      maxLength={9}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
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
