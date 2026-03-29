import React, { useState, useRef } from 'react';
import { useAuthStore, User } from '../stores/authStore';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' };
const fieldStyle: React.CSSProperties = { marginBottom: '16px' };

export default function ProfileTab() {
  const { user, updateUser, loadUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return <p>Chargement du profil...</p>;

  const startEditing = () => {
    setFormData({
      first_name: user.first_name || '',
      display_name: user.display_name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      cesu_number: user.cesu_number || '',
      iban: user.iban || '',
      bic: user.bic || '',
      siren: user.siren || '',
      siret: user.siret || '',
      business_name: user.business_name || '',
      business_address: user.business_address || '',
      avatar_url: user.avatar_url || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUser(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur sauvegarde', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { alert('Image trop lourde (max 500 Ko)'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, avatar_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const initials = (user.first_name || user.display_name || 'U').charAt(0).toUpperCase();

  const Avatar = ({ url, size = 80 }: { url?: string; size?: number }) => (
    url ? (
      <img src={url} alt="Avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {initials}
      </div>
    )
  );

  // ── Vue lecture ──────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>Profil</h2>
          <button onClick={startEditing}
            style={{ padding: '10px 20px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            Modifier
          </button>
        </div>

        {/* En-tête profil avec avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid #eee' }}>
          <Avatar url={user.avatar_url} size={80} />
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '22px' }}>
              {user.first_name || user.display_name?.split(' ')[0] || 'Utilisateur'}
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '15px' }}>{user.display_name}</p>
            <p style={{ margin: '2px 0 0', color: '#888', fontSize: '13px' }}>{user.email}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Colonne gauche */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
            <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '15px' }}>Informations personnelles</h3>
            <InfoRow label="PRENOM" value={user.first_name} />
            <InfoRow label="NOM COMPLET" value={user.display_name} />
            <InfoRow label="TELEPHONE" value={user.phone} />
            <InfoRow label="ADRESSE" value={user.address} />
          </div>
          {/* Colonne droite */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
            <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '15px' }}>Informations professionnelles</h3>
            <InfoRow label="NUMERO CESU" value={user.cesu_number} bold />
            <InfoRow label="IBAN" value={user.iban} mono />
            <InfoRow label="BIC" value={user.bic} mono />
            <InfoRow label="SIREN" value={user.siren} />
            <InfoRow label="SIRET" value={user.siret} />
            <InfoRow label="NOM ENTREPRISE" value={user.business_name} />
            <InfoRow label="ADRESSE ENTREPRISE" value={user.business_address} />
          </div>
        </div>
      </div>
    );
  }

  // ── Vue édition ──────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>Modifier le profil</h2>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #eee' }}>
          <Avatar url={formData.avatar_url} size={80} />
          <div>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ padding: '8px 16px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
              Changer la photo
            </button>
            {formData.avatar_url && (
              <button type="button" onClick={() => setFormData({ ...formData, avatar_url: '' })}
                style={{ marginLeft: '8px', padding: '8px 16px', backgroundColor: '#f5f5f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Supprimer
              </button>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#888' }}>JPG ou PNG, max 500 Ko</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Colonne gauche */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
            <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '15px' }}>Informations personnelles</h3>
            <div style={fieldStyle}>
              <label style={labelStyle}>Prenom</label>
              <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="Cathy" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nom complet</label>
              <input type="text" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} placeholder="Cathy Lacoste" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Telephone</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+33 6 12 34 56 78" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Adresse</label>
              <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </div>

          {/* Colonne droite */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
            <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '15px' }}>Informations professionnelles</h3>
            <div style={fieldStyle}>
              <label style={labelStyle}>Numero CESU</label>
              <input type="text" value={formData.cesu_number} onChange={(e) => setFormData({ ...formData, cesu_number: e.target.value })} placeholder="12345678901" style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>IBAN</label>
              <input type="text" value={formData.iban} onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })} placeholder="FR76 3000 4031 ..." style={{ ...inputStyle, fontFamily: 'monospace' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>BIC</label>
              <input type="text" value={formData.bic} onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })} placeholder="BNPAFRPPXXX" style={{ ...inputStyle, fontFamily: 'monospace' }} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>SIREN</label>
              <input type="text" value={formData.siren} onChange={(e) => setFormData({ ...formData, siren: e.target.value })} maxLength={9} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>SIRET</label>
              <input type="text" value={formData.siret} onChange={(e) => setFormData({ ...formData, siret: e.target.value })} maxLength={14} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nom entreprise</label>
              <input type="text" value={formData.business_name} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Adresse entreprise</label>
              <input type="text" value={formData.business_address} onChange={(e) => setFormData({ ...formData, business_address: e.target.value })} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setIsEditing(false)}
            style={{ padding: '12px 24px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            Annuler
          </button>
          <button type="submit" disabled={isSaving}
            style={{ padding: '12px 24px', backgroundColor: isSaving ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoRow({ label, value, bold, mono }: { label: string; value?: string; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <p style={{ color: '#999', fontSize: '11px', marginBottom: '3px', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ fontSize: '15px', fontWeight: bold ? 'bold' : 'normal', fontFamily: mono ? 'monospace' : 'inherit', color: value ? '#333' : '#ccc' }}>
        {value || '—'}
      </p>
    </div>
  );
}
