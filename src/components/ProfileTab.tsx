import React, { useState } from 'react';
import { useAuthStore, User } from '../stores/authStore';

export default function ProfileTab() {
  const { user, updateUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>(user || {});
  const [isSaving, setIsSaving] = useState(false);

  if (!user) {
    return <p>Chargement du profil...</p>;
  }

  const handleChange = (field: keyof User, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convertir en snake_case pour Supabase (sans les timestamps)
      const supabaseData: any = {};
      
      if (formData.displayName !== undefined) supabaseData.display_name = formData.displayName;
      if (formData.email !== undefined) supabaseData.email = formData.email;
      if (formData.phone !== undefined) supabaseData.phone = formData.phone;
      if (formData.address !== undefined) supabaseData.address = formData.address;
      if (formData.cesuNumber !== undefined) supabaseData.cesu_number = formData.cesuNumber;
      if (formData.iban !== undefined) supabaseData.iban = formData.iban;
      if (formData.bic !== undefined) supabaseData.bic = formData.bic;
      if (formData.siren !== undefined) supabaseData.siren = formData.siren;
      if (formData.siret !== undefined) supabaseData.siret = formData.siret;
      if (formData.businessName !== undefined) supabaseData.business_name = formData.businessName;
      if (formData.businessAddress !== undefined) supabaseData.business_address = formData.businessAddress;

      await updateUser(supabaseData);
      setIsEditing(false);
      alert('Profil sauvegardé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde', error);
      alert('Erreur lors de la sauvegarde du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(user);
    setIsEditing(false);
  };

  if (!isEditing) {
    // Vue lecture
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2>Profil</h2>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Modifier
          </button>
        </div>

        <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Colonne gauche */}
            <div>
              <h3 style={{ marginBottom: '16px', color: '#333' }}>Informations générales</h3>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>NOM</p>
                <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{user.displayName || '—'}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>EMAIL</p>
                <p style={{ fontSize: '16px' }}>{user.email || '—'}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>TÉLÉPHONE</p>
                <p style={{ fontSize: '16px' }}>{user.phone || '—'}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>ADRESSE</p>
                <p style={{ fontSize: '16px' }}>{user.address || '—'}</p>
              </div>
            </div>

            {/* Colonne droite */}
            <div>
              <h3 style={{ marginBottom: '16px', color: '#333' }}>Informations professionnelles</h3>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>NUMÉRO CESU</p>
                <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{user.cesuNumber || '—'}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>IBAN</p>
                <p style={{ fontSize: '14px', fontFamily: 'monospace' }}>{user.iban || '—'}</p>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>BIC</p>
                <p style={{ fontSize: '14px', fontFamily: 'monospace' }}>{user.bic || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vue édition
  return (
    <div>
      <h2 style={{ marginBottom: '30px' }}>Modifier le profil</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '30px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Colonne gauche */}
          <div>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Informations générales</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Nom complet
              </label>
              <input
                type="text"
                value={formData.displayName || ''}
                onChange={(e) => handleChange('displayName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+33 6 12 34 56 78"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Adresse
              </label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* Colonne droite */}
          <div>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Informations professionnelles</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                Numéro CESU
              </label>
              <input
                type="text"
                value={formData.cesuNumber || ''}
                onChange={(e) => handleChange('cesuNumber', e.target.value)}
                placeholder="Ex: 12345678901"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                IBAN
              </label>
              <input
                type="text"
                value={formData.iban || ''}
                onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                placeholder="FR76 3000 4031 8200 0005 1709 487"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                BIC
              </label>
              <input
                type="text"
                value={formData.bic || ''}
                onChange={(e) => handleChange('bic', e.target.value.toUpperCase())}
                placeholder="BNPAFRPPXXX"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
