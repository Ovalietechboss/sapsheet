import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [validSession, setValidSession] = useState(false);

  // Supabase redirige avec un token dans l'URL — il faut l'échanger contre une session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setStatus('error');
    } else {
      setStatus('success');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '40px 36px', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>SAP Sheet</h1>
        </div>

        {status === 'success' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h2 style={{ marginBottom: '8px' }}>Mot de passe modifié</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            </div>
            <a
              href="/"
              style={{ display: 'block', textAlign: 'center', padding: '13px', backgroundColor: '#007AFF', color: 'white', borderRadius: '10px', fontSize: '16px', fontWeight: '700', textDecoration: 'none' }}
            >
              Aller à la connexion
            </a>
          </>
        ) : !validSession ? (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <p>Lien invalide ou expiré.</p>
            <a href="/" style={{ color: '#007AFF', fontWeight: '600' }}>Retour à la connexion</a>
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Nouveau mot de passe</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Choisissez un nouveau mot de passe pour votre compte.</p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Nouveau mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 caractères" required style={inputStyle} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Confirmer le mot de passe</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required style={inputStyle} />
              </div>
              {(errorMsg || status === 'error') && (
                <div style={{ backgroundColor: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#CC0000', fontSize: '13px' }}>
                  {errorMsg || 'Une erreur est survenue'}
                </div>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ width: '100%', padding: '13px', backgroundColor: status === 'loading' ? '#99C9FF' : '#007AFF', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}
              >
                {status === 'loading' ? 'Mise à jour...' : 'Changer le mot de passe'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
