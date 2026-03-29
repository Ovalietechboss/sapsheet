import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore, User } from '../stores/authStore';

interface DbUser {
  id: string;
  auth_id: string;
  email: string;
  display_name: string;
  type: string;
  role: string;
  created_at: number;
  updated_at: number;
}

interface UserStats {
  userId: string;
  clientCount: number;
  timesheetCount: number;
  timesheetThisMonth: number;
}

export default function AdminPage() {
  const { user, impersonate, stopImpersonating, isImpersonating, realAdmin, logout } = useAuthStore();
  const [users, setUsers] = useState<DbUser[]>([]);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users' | 'settings'>('dashboard');
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', display_name: '', type: 'assistant' as 'assistant' | 'employer' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: clientsData }, { data: tsData }] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, user_id'),
      supabase.from('timesheets').select('id, user_id, date_arrival'),
    ]);

    setUsers(usersData || []);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const userStats: UserStats[] = (usersData || []).map((u: DbUser) => ({
      userId: u.id,
      clientCount: (clientsData || []).filter((c: any) => c.user_id === u.id).length,
      timesheetCount: (tsData || []).filter((t: any) => t.user_id === u.id).length,
      timesheetThisMonth: (tsData || []).filter(
        (t: any) => t.user_id === u.id && t.date_arrival >= monthStart
      ).length,
    }));
    setStats(userStats);
    setLoading(false);
  };

  const getStats = (userId: string) => stats.find((s) => s.userId === userId);

  const totalTimesheetsMonth = useMemo(
    () => stats.reduce((s, st) => s + st.timesheetThisMonth, 0), [stats]
  );
  const totalClients = useMemo(
    () => stats.reduce((s, st) => s + st.clientCount, 0), [stats]
  );

  const handleImpersonate = async (targetId: string) => {
    setImpersonating(targetId);
    try {
      await impersonate(targetId);
      // Redirect to home — l'utilisateur voit maintenant l'app comme la cible
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      setImpersonating(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      // 1. Créer le compte auth Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: createForm.email,
        password: createForm.password,
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Création du compte auth échouée');

      // 2. Insérer dans la table users
      const now = Date.now();
      const { error: insertError } = await supabase.from('users').insert({
        id: `user_${now}`,
        auth_id: authData.user.id,
        email: createForm.email,
        display_name: createForm.display_name || createForm.email.split('@')[0],
        type: createForm.type,
        role: 'user',
        created_at: now,
        updated_at: now,
      });
      if (insertError) throw new Error(insertError.message);

      // 3. Rafraîchir la liste
      await loadData();
      setShowCreateUser(false);
      setCreateForm({ email: '', password: '', display_name: '', type: 'assistant' });
    } catch (err: any) {
      setCreateError(err.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (u: DbUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    await supabase.from('users').update({ role: newRole }).eq('id', u.id);
    await loadData();
  };

  const handleDeleteUser = async (u: DbUser) => {
    const st = getStats(u.id);
    const msg = st && (st.clientCount > 0 || st.timesheetCount > 0)
      ? `${u.display_name} a ${st.clientCount} client(s) et ${st.timesheetCount} pointage(s).\nTOUTES ses données seront supprimées.\n\nConfirmer la suppression ?`
      : `Supprimer le compte de ${u.display_name} (${u.email}) ?\n\nCette action est irréversible.`;
    if (!window.confirm(msg)) return;

    // Supprimer dans la table users (CASCADE supprime clients, timesheets, etc.)
    await supabase.from('users').delete().eq('id', u.id);
    await loadData();
  };

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <h1 style={{ color: '#ff3b30' }}>Accès refusé</h1>
        <p style={{ color: '#666' }}>Cette page est réservée aux administrateurs.</p>
        <a href="/" style={{ color: '#007AFF', fontWeight: '600' }}>Retour à l'accueil</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '220px', backgroundColor: '#1a1a2e', color: 'white', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>DomiTemps</h2>
          <span style={{ display: 'inline-block', background: '#ff3b30', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginTop: '6px', letterSpacing: '0.5px' }}>ADMIN</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'dashboard' as const, label: '📊 Dashboard', },
            { id: 'users' as const, label: '👥 Utilisateurs' },
            { id: 'settings' as const, label: '⚙️ Paramètres' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                padding: '11px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px',
                backgroundColor: activeSection === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeSection === item.id ? 'white' : 'rgba(255,255,255,0.6)',
                fontWeight: activeSection === item.id ? '600' : '400',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          <a href="/" style={{ display: 'block', padding: '10px 14px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '13px', borderRadius: '8px' }}>
            ← Retour à l'app
          </a>
          <button onClick={logout}
            style={{ width: '100%', padding: '10px', marginTop: '8px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', backgroundColor: '#f5f6fa' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '80px' }}>Chargement...</div>
        ) : (
          <>
            {/* ══════ DASHBOARD ══════ */}
            {activeSection === 'dashboard' && (
              <>
                <h1 style={{ margin: '0 0 24px', fontSize: '24px', color: '#1a1a2e' }}>Dashboard</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                  <DashCard label="Utilisateurs" value={String(users.length)} color="#007AFF" bg="#E8F4FF" />
                  <DashCard label="Clients (total)" value={String(totalClients)} color="#34C759" bg="#EBF9F0" />
                  <DashCard label="Pointages ce mois" value={String(totalTimesheetsMonth)} color="#FF9500" bg="#FFF4E5" />
                  <DashCard label="Admins" value={String(users.filter((u) => u.role === 'admin').length)} color="#AF52DE" bg="#F5EBFF" />
                </div>

                <h2 style={{ fontSize: '18px', color: '#333', marginBottom: '16px' }}>Activité par utilisateur</h2>
                <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9f9fb' }}>
                        <th style={thStyle}>Utilisateur</th>
                        <th style={thStyle}>Rôle</th>
                        <th style={thStyle}>Clients</th>
                        <th style={thStyle}>Pointages total</th>
                        <th style={thStyle}>Ce mois</th>
                        <th style={thStyle}>Inscrit le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const st = getStats(u.id);
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: '600' }}>{u.display_name}</div>
                              <div style={{ fontSize: '12px', color: '#888' }}>{u.email}</div>
                            </td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                                backgroundColor: u.role === 'admin' ? '#F5EBFF' : '#f0f0f0',
                                color: u.role === 'admin' ? '#AF52DE' : '#888',
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{st?.clientCount || 0}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{st?.timesheetCount || 0}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{st?.timesheetThisMonth || 0}</td>
                            <td style={{ ...tdStyle, color: '#888' }}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ══════ UTILISATEURS ══════ */}
            {activeSection === 'users' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a2e' }}>Gestion des utilisateurs</h1>
                  <button
                    onClick={() => { setShowCreateUser(true); setCreateError(''); }}
                    style={{ padding: '10px 20px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                  >
                    + Créer un utilisateur
                  </button>
                </div>
                <div style={{ display: 'grid', gap: '14px' }}>
                  {users.map((u) => {
                    const st = getStats(u.id);
                    const isMe = u.id === user.id;
                    return (
                      <div key={u.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>{u.display_name}</h3>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                              backgroundColor: u.role === 'admin' ? '#F5EBFF' : '#f0f0f0',
                              color: u.role === 'admin' ? '#AF52DE' : '#888',
                            }}>
                              {u.role}
                            </span>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                              backgroundColor: u.type === 'assistant' ? '#EBF9F0' : '#E8F4FF',
                              color: u.type === 'assistant' ? '#2d8a4e' : '#1a6fb5',
                            }}>
                              {u.type}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            {u.email} · {st?.clientCount || 0} clients · {st?.timesheetCount || 0} pointages
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {isMe ? (
                            <span style={{ padding: '6px 14px', backgroundColor: '#f0f0f0', borderRadius: '8px', fontSize: '13px', color: '#888', fontWeight: '600' }}>
                              Vous
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleImpersonate(u.id)}
                                disabled={impersonating === u.id}
                                style={{ padding: '8px 14px', backgroundColor: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                              >
                                {impersonating === u.id ? 'Connexion...' : 'Se connecter en tant que'}
                              </button>
                              <button
                                onClick={() => handleToggleRole(u)}
                                style={{ padding: '8px 14px', backgroundColor: u.role === 'admin' ? '#ff3b30' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                              >
                                {u.role === 'admin' ? 'Retirer admin' : 'Passer admin'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                style={{ padding: '8px 14px', backgroundColor: '#ff3b30', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ══════ PARAMÈTRES ══════ */}
            {activeSection === 'settings' && (
              <>
                <h1 style={{ margin: '0 0 24px', fontSize: '24px', color: '#1a1a2e' }}>Paramètres système</h1>
                <div style={{ display: 'grid', gap: '16px', maxWidth: '600px' }}>
                  <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Inscriptions publiques</h3>
                    <p style={{ color: '#666', fontSize: '13px', marginBottom: '12px' }}>
                      Contrôlé par la variable <code>VITE_ALLOW_SIGNUP</code> dans Vercel.<br />
                      Actuellement : <strong>{import.meta.env.VITE_ALLOW_SIGNUP === 'true' ? 'Ouvert' : 'Fermé'}</strong>
                    </p>
                    <p style={{ color: '#888', fontSize: '12px' }}>
                      Pour modifier : Vercel → Settings → Environment Variables → VITE_ALLOW_SIGNUP
                    </p>
                  </div>
                  <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Base de données</h3>
                    <p style={{ color: '#666', fontSize: '13px' }}>
                      Supabase URL : <code style={{ fontSize: '12px', color: '#007AFF' }}>{import.meta.env.VITE_SUPABASE_URL}</code>
                    </p>
                  </div>
                  <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Envoi email (à venir)</h3>
                    <p style={{ color: '#888', fontSize: '13px' }}>
                      L'intégration Resend sera configurable ici une fois activée.
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ══════ MODAL CRÉATION UTILISATEUR ══════ */}
      {showCreateUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={() => setShowCreateUser(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Créer un utilisateur</h2>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Prénom et nom *</label>
                <input type="text" value={createForm.display_name} onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })} required placeholder="Cathy Martin"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Email *</label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required placeholder="cathy@email.fr"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Mot de passe *</label>
                <input type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required placeholder="minimum 6 caractères"
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                <p style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>Visible ici pour que vous puissiez le communiquer à l'utilisateur</p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Type de compte</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['assistant', 'employer'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setCreateForm({ ...createForm, type: t })}
                      style={{
                        flex: 1, padding: '10px', border: `2px solid ${createForm.type === t ? '#007AFF' : '#ddd'}`,
                        borderRadius: '8px', backgroundColor: createForm.type === t ? '#EBF4FF' : 'white',
                        color: createForm.type === t ? '#007AFF' : '#555', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                      }}>
                      {t === 'assistant' ? 'Assistante' : 'Employeur'}
                    </button>
                  ))}
                </div>
              </div>
              {createError && (
                <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#CC0000', fontSize: '13px' }}>
                  {createError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowCreateUser(false)}
                  style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Annuler
                </button>
                <button type="submit" disabled={creating}
                  style={{ flex: 1, padding: '12px', background: creating ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
              <p style={{ color: '#888', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>
                L'utilisateur devra confirmer son email avant de pouvoir se connecter.
                Vous pouvez confirmer manuellement dans Supabase → Authentication → Users.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles table ──────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px',
  color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px',
};
const tdStyle: React.CSSProperties = { padding: '12px 16px' };

// ── Composant carte stat ──────────────────────────────────────────────────────
function DashCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
