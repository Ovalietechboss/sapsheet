import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

const ALLOW_SIGNUP = import.meta.env.VITE_ALLOW_SIGNUP === 'true';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<'assistant' | 'employer'>('assistant');

  const { login, signup, isLoading, error, clearError } = useAuthStore();

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    clearError();
    setPassword('');
    setConfirmPassword('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    setForgotSent(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        useAuthStore.setState({ error: 'Les mots de passe ne correspondent pas' });
        return;
      }
      if (password.length < 6) {
        useAuthStore.setState({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        return;
      }
      try {
        await signup(email, password, type, displayName);
      } catch {
        // handled by store
      }
    } else {
      try {
        await login(email, password);
      } catch {
        // handled by store
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#333',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  return (
    <>
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f0f2f5',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px 36px',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          width: '100%',
          maxWidth: '420px',
        }}
      >
        {/* Titre */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>
            SAP Sheet
          </h1>
          <p style={{ color: '#666', marginTop: '6px', fontSize: '14px' }}>
            Gestion de feuilles de temps
          </p>
        </div>

        {/* Onglets — visibles seulement si les inscriptions sont ouvertes */}
        {ALLOW_SIGNUP && (
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f0f2f5',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '28px',
            }}
          >
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '9px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: mode === m ? 'white' : 'transparent',
                  color: mode === m ? '#007AFF' : '#888',
                  boxShadow: mode === m ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {m === 'login' ? 'Connexion' : 'Créer un compte'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Prénom et Nom</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Marie Dupont"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Mot de passe</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotEmail(''); }}
                  style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Minimum 6 caractères' : '••••••••'}
              required
              style={inputStyle}
            />
          </div>

          {mode === 'signup' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Type de compte</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['assistant', 'employer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `2px solid ${type === t ? '#007AFF' : '#ddd'}`,
                      borderRadius: '8px',
                      backgroundColor: type === t ? '#EBF4FF' : 'white',
                      color: type === t ? '#007AFF' : '#555',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'assistant' ? '👩‍⚕️ Assistante' : '🏠 Employeur'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                backgroundColor: '#FFF0F0',
                border: '1px solid #FFD0D0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#CC0000',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '13px',
              backgroundColor: isLoading ? '#99C9FF' : '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
            }}
          >
            {isLoading
              ? 'Chargement...'
              : mode === 'login'
              ? 'Se connecter'
              : 'Créer mon compte'}
          </button>
        </form>

        {ALLOW_SIGNUP && (
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#888' }}>
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#007AFF',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                fontSize: '13px',
              }}
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        )}
      </div>
    </div>

    {/* Modal mot de passe oublié */}
    {showForgotPassword && (
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
        onClick={() => setShowForgotPassword(false)}
      >
        <div
          style={{ backgroundColor: 'white', padding: '36px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {forgotSent ? (
            <>
              <h2 style={{ marginBottom: '12px', fontSize: '22px' }}>Email envoyé</h2>
              <p style={{ color: '#555', marginBottom: '24px', lineHeight: '1.5' }}>
                Un lien de réinitialisation a été envoyé à <strong>{forgotEmail}</strong>. Vérifiez vos emails (et vos spams).
              </p>
              <button
                onClick={() => setShowForgotPassword(false)}
                style={{ width: '100%', padding: '13px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}
              >
                Fermer
              </button>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Mot de passe oublié</h2>
              <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
                Entrez votre email, vous recevrez un lien pour créer un nouveau mot de passe.
              </p>
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoFocus
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    style={{ flex: 1, padding: '12px', backgroundColor: '#f0f2f5', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{ flex: 1, padding: '12px', backgroundColor: forgotLoading ? '#99C9FF' : '#007AFF', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: forgotLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {forgotLoading ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
