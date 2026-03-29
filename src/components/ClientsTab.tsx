import React, { useState } from 'react';
import { useClientStore, Client } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' };
const fieldStyle: React.CSSProperties = { marginBottom: '14px' };

// Helpers
const fullName = (titre?: string, firstName?: string, name?: string) =>
  [titre, firstName, name].filter(Boolean).join(' ');

const mandataireLabel = (m: Mandataire) =>
  `${fullName(m.titre, m.first_name, m.name)} — ${m.association_name}`;

// ═══════════════════════════════════════════════════════════════════════════
//  Composant principal
// ═══════════════════════════════════════════════════════════════════════════

export default function ClientsTab() {
  const { clients, addClient, updateClient, deleteClient } = useClientStore();
  const { mandataires, addMandataire, updateMandataire, deleteMandataire } = useMandataireStore();

  const [subTab, setSubTab] = useState<'clients' | 'mandataires'>('clients');

  // ── Modals ──────────────────────────────────────────────────────────────
  const [clientModal, setClientModal] = useState<'create' | 'edit' | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [mandataireModal, setMandataireModal] = useState<'create' | 'edit' | null>(null);
  const [editingMandataire, setEditingMandataire] = useState<Mandataire | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Formulaire client ───────────────────────────────────────────────────
  const emptyClientForm = () => ({
    titre: '', first_name: '', name: '', email: '', address: '',
    facturation_mode: 'CESU' as 'CESU' | 'CLASSICAL',
    hourly_rate: 15.5, mandataire_id: '',
  });
  const [clientForm, setClientForm] = useState(emptyClientForm());

  const openCreateClient = () => {
    setClientForm(emptyClientForm());
    setEditingClient(null);
    setClientModal('create');
  };

  const openEditClient = (c: Client) => {
    setClientForm({
      titre: c.titre || '', first_name: c.first_name || '', name: c.name,
      email: c.email || '', address: c.address,
      facturation_mode: c.facturation_mode, hourly_rate: c.hourly_rate,
      mandataire_id: c.mandataire_id || '',
    });
    setEditingClient(c);
    setClientModal('edit');
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        titre: clientForm.titre || undefined,
        first_name: clientForm.first_name || undefined,
        name: clientForm.name,
        email: clientForm.email || undefined,
        address: clientForm.address,
        facturation_mode: clientForm.facturation_mode,
        hourly_rate: clientForm.hourly_rate,
        mandataire_id: clientForm.mandataire_id || undefined,
      };
      if (clientModal === 'edit' && editingClient) {
        await updateClient(editingClient.id, data);
      } else {
        await addClient(data);
      }
      setClientModal(null);
    } finally {
      setSaving(false);
    }
  };

  // ── Formulaire mandataire ───────────────────────────────────────────────
  const emptyMandataireForm = () => ({
    titre: '', first_name: '', name: '', association_name: '',
    email: '', phone: '', siren: '', address: '',
  });
  const [mandataireForm, setMandataireForm] = useState(emptyMandataireForm());

  const openCreateMandataire = () => {
    setMandataireForm(emptyMandataireForm());
    setEditingMandataire(null);
    setMandataireModal('create');
  };

  const openEditMandataire = (m: Mandataire) => {
    setMandataireForm({
      titre: m.titre || '', first_name: m.first_name || '', name: m.name,
      association_name: m.association_name, email: m.email,
      phone: m.phone || '', siren: m.siren || '', address: m.address || '',
    });
    setEditingMandataire(m);
    setMandataireModal('edit');
  };

  const handleMandataireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        titre: mandataireForm.titre || undefined,
        first_name: mandataireForm.first_name || undefined,
        name: mandataireForm.name,
        association_name: mandataireForm.association_name,
        email: mandataireForm.email,
        phone: mandataireForm.phone || undefined,
        siren: mandataireForm.siren || undefined,
        address: mandataireForm.address || undefined,
      };
      if (mandataireModal === 'edit' && editingMandataire) {
        await updateMandataire(editingMandataire.id, data);
      } else {
        await addMandataire(data);
      }
      setMandataireModal(null);
    } finally {
      setSaving(false);
    }
  };

  // Clients liés à un mandataire
  const getClientsForMandataire = (mandataireId: string) =>
    clients.filter((c) => c.mandataire_id === mandataireId);

  const getMandataire = (id?: string) =>
    id ? mandataires.find((m) => m.id === id) : undefined;

  const cesuClients = clients.filter((c) => c.facturation_mode === 'CESU');
  const classicalClients = clients.filter((c) => c.facturation_mode === 'CLASSICAL');

  // ═══════════════════════════════════════════════════════════════════════
  //  Rendu
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* Sous-navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', backgroundColor: '#f0f2f5', borderRadius: '10px', padding: '4px' }}>
          {[
            { id: 'clients' as const, label: `Clients (${clients.length})` },
            { id: 'mandataires' as const, label: `Mandataires (${mandataires.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                padding: '9px 18px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                backgroundColor: subTab === tab.id ? 'white' : 'transparent',
                color: subTab === tab.id ? '#007AFF' : '#888',
                boxShadow: subTab === tab.id ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={subTab === 'clients' ? openCreateClient : openCreateMandataire}
          style={{ padding: '10px 20px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          + {subTab === 'clients' ? 'Nouveau client' : 'Nouveau mandataire'}
        </button>
      </div>

      {/* ══════════ SOUS-TAB CLIENTS ══════════ */}
      {subTab === 'clients' && (
        <>
          {/* CESU */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ backgroundColor: '#34C759', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>CESU</span>
              {cesuClients.length} client{cesuClients.length !== 1 ? 's' : ''}
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {cesuClients.map((c) => renderClientCard(c, '#34C759'))}
              {cesuClients.length === 0 && <p style={{ color: '#999' }}>Aucun client CESU</p>}
            </div>
          </div>
          {/* CLASSIQUE */}
          <div>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ backgroundColor: '#007AFF', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>CLASSIQUE</span>
              {classicalClients.length} client{classicalClients.length !== 1 ? 's' : ''}
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {classicalClients.map((c) => renderClientCard(c, '#007AFF'))}
              {classicalClients.length === 0 && <p style={{ color: '#999' }}>Aucun client classique</p>}
            </div>
          </div>
        </>
      )}

      {/* ══════════ SOUS-TAB MANDATAIRES ══════════ */}
      {subTab === 'mandataires' && (
        <div style={{ display: 'grid', gap: '14px' }}>
          {mandataires.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: '40px' }}>Aucun mandataire</p>}
          {mandataires.map((m) => {
            const linkedClients = getClientsForMandataire(m.id);
            return (
              <div key={m.id} style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', border: '1px solid #e0e0e0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '17px' }}>{fullName(m.titre, m.first_name, m.name)}</h4>
                    </div>
                    <p style={{ color: '#007AFF', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>{m.association_name}</p>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      <p style={{ marginBottom: '2px' }}>✉️ {m.email}</p>
                      {m.phone && <p style={{ marginBottom: '2px' }}>📞 {m.phone}</p>}
                      {m.siren && <p style={{ marginBottom: '2px' }}>SIREN: {m.siren}</p>}
                      {m.address && <p style={{ marginBottom: '2px' }}>📍 {m.address}</p>}
                    </div>
                    {linkedClients.length > 0 && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                        <p style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '4px' }}>
                          {linkedClients.length} CLIENT{linkedClients.length > 1 ? 'S' : ''} RATTACHÉ{linkedClients.length > 1 ? 'S' : ''}
                        </p>
                        {linkedClients.map((c) => (
                          <span key={c.id} style={{ display: 'inline-block', background: c.facturation_mode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color: c.facturation_mode === 'CESU' ? '#2d8a4e' : '#1a6fb5', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', marginRight: '6px', marginBottom: '4px' }}>
                            {fullName(c.titre, c.first_name, c.name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEditMandataire(m)} style={{ padding: '7px 14px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      Modifier
                    </button>
                    <button
                      onClick={() => { if (linkedClients.length > 0) { alert(`${linkedClients.length} client(s) rattaché(s) — détachez-les d'abord`); return; } deleteMandataire(m.id); }}
                      style={{ padding: '7px 14px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ MODAL CLIENT ══════════ */}
      {clientModal && renderModal(
        clientModal === 'create' ? 'Nouveau client' : 'Modifier le client',
        handleClientSubmit,
        () => setClientModal(null),
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '90px' }}>
              <label style={labelStyle}>Titre</label>
              <select value={clientForm.titre} onChange={(e) => setClientForm({ ...clientForm, titre: e.target.value })} style={inputStyle}>
                <option value="">—</option>
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prénom</label>
              <input type="text" value={clientForm.first_name} onChange={(e) => setClientForm({ ...clientForm, first_name: e.target.value })} placeholder="Marie" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nom *</label>
              <input type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required placeholder="Dupont" style={inputStyle} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="marie@email.fr" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Adresse *</label>
            <input type="text" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} required placeholder="12 rue des Lilas, 75001 Paris" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Mode de facturation</label>
            <select value={clientForm.facturation_mode} onChange={(e) => setClientForm({ ...clientForm, facturation_mode: e.target.value as 'CESU' | 'CLASSICAL' })} style={inputStyle}>
              <option value="CESU">CESU</option>
              <option value="CLASSICAL">Classique</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Taux horaire (€) *</label>
            <input type="number" step="0.01" value={clientForm.hourly_rate} onChange={(e) => setClientForm({ ...clientForm, hourly_rate: parseFloat(e.target.value) })} required style={inputStyle} />
          </div>
          <div style={{ ...fieldStyle, paddingTop: '12px', borderTop: '1px solid #eee' }}>
            <label style={labelStyle}>Mandataire</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={clientForm.mandataire_id} onChange={(e) => setClientForm({ ...clientForm, mandataire_id: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                <option value="">— Aucun —</option>
                {mandataires.map((m) => <option key={m.id} value={m.id}>{mandataireLabel(m)}</option>)}
              </select>
              <button type="button" onClick={() => { setMandataireModal('create'); setMandataireForm(emptyMandataireForm()); }}
                style={{ padding: '10px 12px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '13px' }}>
                +
              </button>
            </div>
          </div>
        </>,
        saving
      )}

      {/* ══════════ MODAL MANDATAIRE ══════════ */}
      {mandataireModal && renderModal(
        mandataireModal === 'create' ? 'Nouveau mandataire' : 'Modifier le mandataire',
        handleMandataireSubmit,
        () => setMandataireModal(null),
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '90px' }}>
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
              <label style={labelStyle}>Prénom</label>
              <input type="text" value={mandataireForm.first_name} onChange={(e) => setMandataireForm({ ...mandataireForm, first_name: e.target.value })} placeholder="Jean" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nom *</label>
              <input type="text" value={mandataireForm.name} onChange={(e) => setMandataireForm({ ...mandataireForm, name: e.target.value })} required placeholder="Martin" style={inputStyle} />
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Association / Entreprise *</label>
            <input type="text" value={mandataireForm.association_name} onChange={(e) => setMandataireForm({ ...mandataireForm, association_name: e.target.value })} required placeholder="ADMR Paris" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email *</label>
            <input type="email" value={mandataireForm.email} onChange={(e) => setMandataireForm({ ...mandataireForm, email: e.target.value })} required placeholder="jean.martin@admr.fr" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Téléphone</label>
            <input type="tel" value={mandataireForm.phone} onChange={(e) => setMandataireForm({ ...mandataireForm, phone: e.target.value })} placeholder="01 23 45 67 89" style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>SIREN</label>
            <input type="text" value={mandataireForm.siren} onChange={(e) => setMandataireForm({ ...mandataireForm, siren: e.target.value })} placeholder="123456789" maxLength={9} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Adresse</label>
            <input type="text" value={mandataireForm.address} onChange={(e) => setMandataireForm({ ...mandataireForm, address: e.target.value })} placeholder="5 avenue de la République, 75011 Paris" style={inputStyle} />
          </div>
        </>,
        saving,
        mandataireModal === 'create' ? '#34C759' : '#007AFF'
      )}
    </div>
  );

  // ── Carte client réutilisable ───────────────────────────────────────────
  function renderClientCard(client: Client, borderColor: string) {
    const mandataire = getMandataire(client.mandataire_id);
    return (
      <div key={client.id} style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.08)', border: `2px solid ${borderColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEditClient(client)}>
            <h4 style={{ marginBottom: '6px', fontSize: '17px' }}>{fullName(client.titre, client.first_name, client.name)}</h4>
            <p style={{ color: '#666', marginBottom: '3px', fontSize: '13px' }}>📍 {client.address}</p>
            {client.email && <p style={{ color: '#666', marginBottom: '3px', fontSize: '13px' }}>✉️ {client.email}</p>}
            <p style={{ color: '#666', marginBottom: '3px', fontSize: '13px' }}>💰 {client.hourly_rate}€/heure</p>
            {mandataire && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                <p style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', marginBottom: '4px' }}>MANDATAIRE</p>
                <p style={{ color: '#333', fontSize: '13px', marginBottom: '2px' }}>{fullName(mandataire.titre, mandataire.first_name, mandataire.name)}</p>
                <p style={{ color: '#666', fontSize: '12px' }}>{mandataire.association_name} · {mandataire.email}</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => openEditClient(client)} style={{ padding: '7px 14px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              Modifier
            </button>
            <button onClick={() => deleteClient(client.id)} style={{ padding: '7px 14px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              Supprimer
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ── Modal réutilisable ──────────────────────────────────────────────────────
function renderModal(
  title: string,
  onSubmit: (e: React.FormEvent) => void,
  onClose: () => void,
  children: React.ReactNode,
  saving: boolean,
  accentColor = '#007AFF',
) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '10px', width: '92%', maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>{title}</h2>
        <form onSubmit={onSubmit}>
          {children}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '12px', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: '12px', backgroundColor: saving ? '#ccc' : accentColor, color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
