import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [validSession, setValidSession] = useState(false);

  // Supabase redirige avec un jeton dans l'URL, qu'il échange lui-même contre une session.
  //
  // S'abonner seul ne suffit PAS : le client Supabase traite l'URL au chargement du module,
  // donc AVANT que React ne monte cette page. L'événement PASSWORD_RECOVERY était souvent
  // déjà émis quand on s'y abonnait, et la page affichait « lien invalide ou expiré » alors
  // que la session était parfaitement valide — l'utilisateur se retrouvait connecté sans
  // jamais pouvoir choisir son mot de passe. Constaté le 01/09/2026.
  //
  // On interroge donc d'abord la session existante, et on garde l'abonnement pour le cas
  // où l'échange se termine après le montage.
  useEffect(() => {
    let actif = true;
    supabase.auth.getSession().then(({ data }) => {
      if (actif && data.session) setValidSession(true);
    });
    const { data: abonnement } = supabase.auth.onAuthStateChange((event, session) => {
      if (!actif) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidSession(true);
      }
    });
    return () => {
      actif = false;
      abonnement.subscription.unsubscribe();
    };
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
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>DomiTemps</h1>
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

            {/* C'est ici qu'atterrit une personne invitee : le moment ou l'information sur
                l'installation est la plus utile. Un email de plus se serait perdu. */}
            <div style={{ marginTop: '26px', paddingTop: '22px', borderTop: '1px solid #eee' }}>
              <h3 style={{ fontSize: '15px', margin: '0 0 6px', color: '#1a1a2e' }}>
                Installer DomiTemps sur votre téléphone
              </h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 14px' }}>
                La marche à suivre dépend de votre téléphone.
              </p>

              <div style={{ background: '#f7f8fa', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px' }}>Sur iPhone</p>
                <p style={{ margin: 0, color: '#555', fontSize: '13px', lineHeight: 1.5 }}>
                  Ouvrez cette page dans <strong>Safari</strong>, touchez le bouton Partager
                  (le carré avec une flèche), puis <strong>« Sur l'écran d'accueil »</strong>.
                  Rien à télécharger, et les mises à jour se font toutes seules.
                </p>
              </div>

              {/* Sur Android, l'application est distribuee par le Play Store. On n'y propose
                  PAS l'installation en raccourci : la personne se retrouverait avec deux
                  icones DomiTemps, dont une figee a la version installee ce jour-la. */}
              <div style={{ background: '#f7f8fa', borderRadius: '10px', padding: '12px 14px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '13px' }}>Sur Android</p>
                <p style={{ margin: 0, color: '#555', fontSize: '13px', lineHeight: 1.5 }}>
                  L'application s'installe depuis le <strong>Play Store</strong>. Vous recevrez
                  séparément un lien d'invitation, à ouvrir depuis votre téléphone : sans lui,
                  l'application n'apparaîtra pas dans le Store.
                </p>
              </div>

              <p style={{ color: '#888', fontSize: '12px', margin: '12px 0 0', lineHeight: 1.5 }}>
                En attendant, vous pouvez utiliser DomiTemps directement dans votre navigateur —
                toutes les fonctions y sont disponibles.
              </p>
            </div>
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
