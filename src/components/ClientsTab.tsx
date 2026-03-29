import React, { useState } from 'react';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: 'bold',
};

const fieldStyle: React.CSSProperties = { marginBottom: '16px' };

// ── Formulaire de création rapide mandataire (inline dans le modal client) ────

interface MandataireFormData {
  titre: string;
  name: string;
  association_name: string;
  email: string;
  phone: string;
  siren: string;
  address: string;
}

const emptyMandataireForm = (): MandataireFormData => ({
  titre: '',
  name: '',
  association_name: '',
  email: '',
  phone: '',
  siren: '',
  address: '',
});

// ── Composant principal ───────────────────────────────────────────────────────

export default function ClientsTab() {
  const { clients, addClient, deleteClient } = useClientStore();
  const { mandataires, addMandataire } = useMandataireStore();

  const [showClientModal, setShowClientModal] = useState(false);
  const [showMandataireModal, setShowMandataireModal] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    address: '',
    facturation_mode: 'CESU' as 'CESU' | 'CLASSICAL',
    hourly_rate: 15.5,
    mandataire_id: '',
  });

  const [mandataireForm, setMandataireForm] = useState<MandataireFormData>(emptyMandataireForm());
  const [savingMandataire, setSavingMandataire] = useState(false);

  const resetClientForm = () =>
    setClientForm({ name: '', email: '', address: '', facturation_mode: 'CESU', hourly_rate: 15.5, mandataire_id: '' });

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addClient({
      name: clientForm.name,
      email: clientForm.email || undefined,
      address: clientForm.address,
      facturation_mode: clientForm.facturation_mode,
      hourly_rate: clientForm.hourly_rate,
      mandataire_id: clientForm.mandataire_id || undefined,
    });
    setShowClientModal(false);
    resetClientForm();
  };

  const handleCreateMandataire = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMandataire(true);
    try {
      const created = await addMandataire({
        titre: mandataireForm.titre || undefined,
        name: mandataireForm.name,
        association_name: mandataireForm.association_name,
        email: mandataireForm.email,
        phone: mandataireForm.phone || undefined,
        siren: mandataireForm.siren || undefined,
        address: mandataireForm.address || undefined,
      });
      // Sélectionner automatiquement le mandataire créé
      setClientForm((f) => ({ ...f, mandataire_id: created.id }));
      setMandataireForm(emptyMandataireForm());
      setShowMandataireModal(false);
    } finally {
      setSavingMandataire(false);
    }
  };

  const getMandataire = (id?: string): Mandataire | undefined =>
    id ? mandataires.find((m) => m.id === id) : undefined;

  const renderClientCard = (client: typeof clients[0], borderColor: string) => {
    const mandataire = getMandataire(client.mandataire_id);
    return (
      <div
        key={client.id}
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `2px solid ${borderColor}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ marginBottom: '8px', fontSize: '18px' }}>{client.name}</h4>
            <p style={{ color: '#666', marginBottom: '4px' }}>📍 {client.address}</p>
            {client.email && <p style={{ color: '#666', marginBottom: '4px' }}>✉️ {client.email}</p>}
            <p style={{ color: '#666', marginBottom: '4px' }}>💰 {client.hourly_rate}€/heure</p>
            {mandataire && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px', color: '#555' }}>
                  MANDATAIRE
                </p>
                <p style={{ color: '#333', marginBottom: '2px' }}>
                  {mandataire.titre ? `${mandataire.titre} ` : ''}{mandataire.name}
                </p>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '2px' }}>{mandataire.association_name}</p>
                <p style={{ color: '#666', fontSize: '13px', marginBottom: '2px' }}>✉️ {mandataire.email}</p>
                {mandataire.phone && <p style={{ color: '#666', fontSize: '13px' }}>📞 {mandataire.phone}</p>}
                {mandataire.siren && <p style={{ color: '#999', fontSize: '12px' }}>SIREN: {mandataire.siren}</p>}
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
            Supprimer
          </button>
        </div>
      </div>
    );
  };

  const cesuClients = clients.filter((c) => c.facturation_mode === 'CESU');
  const classicalClients = clients.filter((c) => c.facturation_mode === 'CLASSICAL');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Clients ({clients.length})</h2>
        <button
          onClick={() => setShowClientModal(true)}
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
          + Nouveau client
        </button>
      </div>

      {/* CESU Clients */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ backgroundColor: '#34C759', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>CESU</span>
          {cesuClients.length} client{cesuClients.length !== 1 ? 's' : ''}
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {cesuClients.map((c) => renderClientCard(c, '#34C759'))}
          {cesuClients.length === 0 && <p style={{ color: '#999' }}>Aucun client CESU</p>}
        </div>
      </div>

      {/* Classical Clients */}
      <div>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ backgroundColor: '#007AFF', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>CLASSIQUE</span>
          {classicalClients.length} client{classicalClients.length !== 1 ? 's' : ''}
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {classicalClients.map((c) => renderClientCard(c, '#007AFF'))}
          {classicalClients.length === 0 && <p style={{ color: '#999' }}>Aucun client classique</p>}
        </div>
      </div>

      {/* ── Modal création client ──────────────────────────────────────────── */}
      {showClientModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setShowClientModal(false)}
        >
          <div
            style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Nouveau client</h2>
            <form onSubmit={handleClientSubmit}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nom</label>
                <input type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required placeholder="Ex: Mme Marie Dupont" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Email (optionnel — si pas de mandataire)</label>
                <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="Ex: marie@email.fr" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Adresse</label>
                <input type="text" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} required placeholder="Ex: 12 rue des Lilas, 75001 Paris" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Mode de facturation</label>
                <select value={clientForm.facturation_mode} onChange={(e) => setClientForm({ ...clientForm, facturation_mode: e.target.value as 'CESU' | 'CLASSICAL' })} style={inputStyle}>
                  <option value="CESU">CESU</option>
                  <option value="CLASSICAL">Classique</option>
                </select>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Taux horaire (€)</label>
                <input type="number" step="0.01" value={clientForm.hourly_rate} onChange={(e) => setClientForm({ ...clientForm, hourly_rate: parseFloat(e.target.value) })} required style={inputStyle} />
              </div>

              {/* Sélection mandataire */}
              <div style={{ ...fieldStyle, paddingTop: '16px', borderTop: '2px solid #eee' }}>
                <label style={labelStyle}>Mandataire (optionnel)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={clientForm.mandataire_id}
                    onChange={(e) => setClientForm({ ...clientForm, mandataire_id: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">— Aucun mandataire —</option>
                    {mandataires.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titre ? `${m.titre} ` : ''}{m.name} — {m.association_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowMandataireModal(true)}
                    style={{ padding: '10px 14px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}
                  >
                    + Nouveau
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => { setShowClientModal(false); resetClientForm(); }} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Annuler
                </button>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal création mandataire (rapide, depuis le formulaire client) ── */}
      {showMandataireModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}
          onClick={() => setShowMandataireModal(false)}
        >
          <div
            style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Nouveau mandataire</h2>
            <form onSubmit={handleCreateMandataire}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '100px' }}>
                  <label style={labelStyle}>Titre</label>
                  <select value={mandataireForm.titre} onChange={(e) => setMandataireForm({ ...mandataireForm, titre: e.target.value })} style={inputStyle}>
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Me">Me</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nom de la personne *</label>
                  <input type="text" value={mandataireForm.name} onChange={(e) => setMandataireForm({ ...mandataireForm, name: e.target.value })} required placeholder="Ex: Jean Martin" style={inputStyle} />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Association / Entreprise *</label>
                <input type="text" value={mandataireForm.association_name} onChange={(e) => setMandataireForm({ ...mandataireForm, association_name: e.target.value })} required placeholder="Ex: ADMR Paris" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={mandataireForm.email} onChange={(e) => setMandataireForm({ ...mandataireForm, email: e.target.value })} required placeholder="Ex: jean.martin@admr.fr" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Téléphone</label>
                <input type="tel" value={mandataireForm.phone} onChange={(e) => setMandataireForm({ ...mandataireForm, phone: e.target.value })} placeholder="Ex: 01 23 45 67 89" style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>SIREN de l'association</label>
                <input type="text" value={mandataireForm.siren} onChange={(e) => setMandataireForm({ ...mandataireForm, siren: e.target.value })} placeholder="Ex: 123456789" maxLength={9} style={inputStyle} />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Adresse</label>
                <input type="text" value={mandataireForm.address} onChange={(e) => setMandataireForm({ ...mandataireForm, address: e.target.value })} placeholder="Ex: 5 avenue de la République, 75011 Paris" style={inputStyle} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowMandataireModal(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Annuler
                </button>
                <button type="submit" disabled={savingMandataire} style={{ flex: 1, padding: '12px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {savingMandataire ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
