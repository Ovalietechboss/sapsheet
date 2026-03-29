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

  const handleToggleRole = async (u: DbUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    await supabase.from('users').update({ role: newRole }).eq('id', u.id);
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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>SAP Sheet</h2>
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
                <h1 style={{ margin: '0 0 24px', fontSize: '24px', color: '#1a1a2e' }}>Gestion des utilisateurs</h1>
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!isMe && (
                            <button
                              onClick={() => handleImpersonate(u.id)}
                              disabled={impersonating === u.id}
                              style={{ padding: '8px 14px', backgroundColor: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            >
                              {impersonating === u.id ? 'Connexion...' : 'Se connecter en tant que'}
                            </button>
                          )}
                          {!isMe && (
                            <button
                              onClick={() => handleToggleRole(u)}
                              style={{ padding: '8px 14px', backgroundColor: u.role === 'admin' ? '#ff3b30' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                            >
                              {u.role === 'admin' ? 'Retirer admin' : 'Passer admin'}
                            </button>
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
