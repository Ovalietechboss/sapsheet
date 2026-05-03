import React, { useMemo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuthStore } from '../stores/authStore';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore } from '../stores/mandataireStore.supabase';
import { useBillingPeriodStore } from '../stores/billingPeriodStore.supabase';
import { isDureeDirecte } from '../utils/timesheetMode';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface Props {
  onNavigate: (tab: string) => void;
}

export default function DashboardTab({ onNavigate }: Props) {
  const isMobile = useIsMobile();
  const { user } = useAuthStore();
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { getPeriod } = useBillingPeriodStore();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = `${JOURS[now.getDay()]} ${now.getDate()} ${MONTHS[currentMonth]}`;
  const firstName = user?.first_name || user?.display_name?.split(' ')[0] || '';
  const heure = now.getHours();
  const greeting = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';
  const currentPeriod = getPeriod(currentMonth + 1, currentYear);

  // ── Stats du mois en cours ──────────────────────────────────────────────

  const monthStats = useMemo(() => {
    const start = new Date(currentYear, currentMonth, 1).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
    const monthTs = timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end);
    const totalHours = monthTs.reduce((s, ts) => s + ts.duration, 0);
    const activeClientIds = new Set(monthTs.map((ts) => ts.client_id));
    const totalEarnings = monthTs.reduce((s, ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      return s + ts.duration * (client?.hourly_rate || 0);
    }, 0);
    const totalFrais = monthTs.reduce((s, ts) =>
      s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0), 0);
    const draftCount = monthTs.filter((ts) => ts.status === 'draft').length;

    return { count: monthTs.length, totalHours, activeClients: activeClientIds.size, totalEarnings, totalFrais, draftCount };
  }, [timesheets, clients, currentMonth, currentYear]);

  // ── Évolution 6 derniers mois ───────────────────────────────────────────

  const monthlyEvolution = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const start = new Date(y, m, 1).getTime();
      const end = new Date(y, m + 1, 0, 23, 59, 59).getTime();
      const mTs = timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end);
      const hours = mTs.reduce((s, ts) => s + ts.duration, 0);
      const revenue = mTs.reduce((s, ts) => {
        const client = clients.find((c) => c.id === ts.client_id);
        return s + ts.duration * (client?.hourly_rate || 0) + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0);
      }, 0);
      data.push({ label: MONTHS_SHORT[m], hours, revenue, isCurrent: i === 0 });
    }
    return data;
  }, [timesheets, clients, currentMonth, currentYear]);

  const maxHours = Math.max(...monthlyEvolution.map((m) => m.hours), 1);
  const maxRevenue = Math.max(...monthlyEvolution.map((m) => m.revenue), 1);

  // ── Top clients du mois ─────────────────────────────────────────────────

  const topClients = useMemo(() => {
    const start = new Date(currentYear, currentMonth, 1).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
    const map = new Map<string, { name: string; hours: number; revenue: number; mode: string }>();
    timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end).forEach((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      if (!client) return;
      const key = client.id;
      const existing = map.get(key) || { name: [client.titre, client.first_name, client.name].filter(Boolean).join(' '), hours: 0, revenue: 0, mode: client.facturation_mode };
      existing.hours += ts.duration;
      existing.revenue += ts.duration * client.hourly_rate + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [timesheets, clients, currentMonth, currentYear]);

  // ── Répartition CESU / Classique ────────────────────────────────────────

  const repartition = useMemo(() => {
    const cesuClients = clients.filter((c) => c.facturation_mode === 'CESU');
    const classClients = clients.filter((c) => c.facturation_mode === 'CLASSICAL');
    const start = new Date(currentYear, currentMonth, 1).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
    const monthTs = timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end);

    const cesuHours = monthTs.filter((ts) => cesuClients.some((c) => c.id === ts.client_id)).reduce((s, ts) => s + ts.duration, 0);
    const classHours = monthTs.filter((ts) => classClients.some((c) => c.id === ts.client_id)).reduce((s, ts) => s + ts.duration, 0);
    const total = cesuHours + classHours || 1;

    return {
      cesu: { count: cesuClients.length, hours: cesuHours, pct: Math.round((cesuHours / total) * 100) },
      classical: { count: classClients.length, hours: classHours, pct: Math.round((classHours / total) * 100) },
    };
  }, [clients, timesheets, currentMonth, currentYear]);

  // ── Alertes ─────────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (monthStats.draftCount > 0) list.push(`${monthStats.draftCount} pointage${monthStats.draftCount > 1 ? 's' : ''} non validé${monthStats.draftCount > 1 ? 's' : ''}`);
    const start = new Date(currentYear, currentMonth, 1).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();
    const activeIds = new Set(timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end).map((ts) => ts.client_id));
    const inactiveClients = clients.filter((c) => !activeIds.has(c.id));
    if (inactiveClients.length > 0) list.push(`${inactiveClients.length} client${inactiveClients.length > 1 ? 's' : ''} sans pointage ce mois`);
    return list;
  }, [monthStats, timesheets, clients, currentMonth, currentYear]);

  // ── Cumul annuel ────────────────────────────────────────────────────────

  const yearStats = useMemo(() => {
    const start = new Date(currentYear, 0, 1).getTime();
    const end = new Date(currentYear, 11, 31, 23, 59, 59).getTime();
    const yearTs = timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end);
    const hours = yearTs.reduce((s, ts) => s + ts.duration, 0);
    const revenue = yearTs.reduce((s, ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      return s + ts.duration * (client?.hourly_rate || 0) + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (ts.ik_amount || 0);
    }, 0);
    return { hours, revenue, count: yearTs.length };
  }, [timesheets, clients, currentYear]);

  // ── Derniers pointages ──────────────────────────────────────────────────

  const recentTimesheets = useMemo(() =>
    [...timesheets].sort((a, b) => b.date_arrival - a.date_arrival).slice(0, 5).map((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      return { ...ts, clientName: client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : 'Inconnu' };
    }), [timesheets, clients]);

  // ── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #007AFF 0%, #0055CC 100%)', borderRadius: '16px', padding: '28px', color: 'white', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-20px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold' }}>
              {(firstName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p style={{ fontSize: '13px', opacity: 0.85, margin: '0 0 2px' }}>{todayStr}</p>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{greeting}, {firstName}</h1>
          </div>
        </div>
      </div>

      {/* Stats du mois */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Heures" value={`${monthStats.totalHours.toFixed(1)}h`} bg="#EBF9F0" color="#2d8a4e" />
        <StatCard label="Clients actifs" value={String(monthStats.activeClients)} bg="#E8F4FF" color="#1a6fb5" />
        <StatCard label="Pointages" value={String(monthStats.count)} sub={`${monthStats.totalHours.toFixed(1)}h`} bg="#FFF4E5" color="#b36b00" />
        <StatCard label="Salaire" value={`${monthStats.totalEarnings.toFixed(0)}€`} bg="#F0EBFF" color="#5b3db5" />
        <StatCard label="Total" value={`${(monthStats.totalEarnings + monthStats.totalFrais).toFixed(0)}€`} bg="#007AFF" color="#fff" />
      </div>

      {/* Évolution 6 mois + Répartition (web only) */}
      {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Évolution */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#333' }}>Évolution (6 mois)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
            {monthlyEvolution.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', justifyContent: 'center', flex: 1 }}>
                  <div style={{ width: '45%', backgroundColor: m.isCurrent ? '#007AFF' : '#B0D4FF', borderRadius: '3px 3px 0 0', height: `${Math.max((m.hours / maxHours) * 100, 4)}%`, transition: 'height 0.3s' }} title={`${m.hours.toFixed(1)}h`} />
                  <div style={{ width: '45%', backgroundColor: m.isCurrent ? '#34C759' : '#B8E6C8', borderRadius: '3px 3px 0 0', height: `${Math.max((m.revenue / maxRevenue) * 100, 4)}%`, transition: 'height 0.3s' }} title={`${m.revenue.toFixed(0)}€`} />
                </div>
                <div style={{ fontSize: '11px', color: m.isCurrent ? '#007AFF' : '#888', fontWeight: m.isCurrent ? 'bold' : 'normal', marginTop: '6px' }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', fontSize: '11px', color: '#888' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#007AFF', borderRadius: 2, marginRight: 4 }} />Heures</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#34C759', borderRadius: 2, marginRight: 4 }} />Revenus</span>
          </div>
        </div>

        {/* Répartition CESU / Classique */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#333' }}>Répartition</h3>
          {/* Barre de répartition */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '24px', marginBottom: '16px' }}>
            <div style={{ width: `${repartition.cesu.pct}%`, backgroundColor: '#34C759', minWidth: repartition.cesu.hours > 0 ? '20px' : 0, transition: 'width 0.3s' }} />
            <div style={{ width: `${repartition.classical.pct}%`, backgroundColor: '#007AFF', minWidth: repartition.classical.hours > 0 ? '20px' : 0, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#34C759', borderRadius: 3 }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>CESU</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                <span style={{ fontWeight: 'bold', color: '#34C759' }}>{repartition.cesu.pct}%</span>
                <span style={{ color: '#888', marginLeft: '6px' }}>{repartition.cesu.hours.toFixed(1)}h · {repartition.cesu.count} client{repartition.cesu.count > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#007AFF', borderRadius: 3 }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Classique</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                <span style={{ fontWeight: 'bold', color: '#007AFF' }}>{repartition.classical.pct}%</span>
                <span style={{ color: '#888', marginLeft: '6px' }}>{repartition.classical.hours.toFixed(1)}h · {repartition.classical.count} client{repartition.classical.count > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* Top clients + Alertes (web only) */}
      {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', marginBottom: '20px' }}>
        {/* Top clients */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', color: '#333' }}>Top clients — {MONTHS[currentMonth]}</h3>
          {topClients.length === 0 ? (
            <p style={{ color: '#999', fontSize: '13px' }}>Aucun pointage ce mois</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topClients.map((c, i) => {
                const maxRev = topClients[0]?.revenue || 1;
                const barPct = (c.revenue / maxRev) * 100;
                const color = c.mode === 'CESU' ? '#34C759' : '#007AFF';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#333' }}>{c.name}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px', backgroundColor: c.mode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color }}>{c.mode === 'CESU' ? 'CESU' : 'CLASS.'}</span>
                      </div>
                      <span style={{ color: '#555' }}>{c.hours.toFixed(1)}h · <strong>{c.revenue.toFixed(0)}€</strong></span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertes */}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', color: '#333' }}>Alertes</h3>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <p style={{ color: '#34C759', fontWeight: '600', fontSize: '14px' }}>Tout est en ordre</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#FFF8E7', borderRadius: '8px', border: '1px solid #FFCC00' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <span style={{ fontSize: '13px', color: '#856400' }}>{a}</span>
                </div>
              ))}
            </div>
          )}
          {/* Bilan du mois */}
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: currentPeriod?.status === 'locked' ? '#EBF9F0' : '#f9f9f9', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Bilan {MONTHS[currentMonth]}</div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: currentPeriod?.status === 'locked' ? '#34C759' : '#FF9500' }}>
              {currentPeriod?.status === 'locked' ? 'Clôturé' : currentPeriod?.status === 'archived' ? 'Archivé' : 'Ouvert'}
            </div>
          </div>
        </div>
      </div>}

      {/* Cumul annuel (web only) */}
      {!isMobile && <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Année {currentYear}</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{yearStats.hours.toFixed(0)}h</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{yearStats.count} pointages</div>
        </div>
        <div style={{ width: '1px', backgroundColor: '#eee' }} />
        <div>
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Revenu annuel</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34C759' }}>{yearStats.revenue.toFixed(0)}€</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{clients.length} clients · {mandataires.length} mandataires</div>
        </div>
      </div>}

      {/* Derniers pointages */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#333' }}>Derniers pointages</h3>
          <button onClick={() => onNavigate('timesheets')} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Voir tout →</button>
        </div>
        {recentTimesheets.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '30px', background: '#f9f9f9', borderRadius: '10px' }}>Aucun pointage</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {recentTimesheets.map((ts) => {
              const date = new Date(ts.date_arrival);
              const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
              const isDuree = isDureeDirecte(ts);
              const startTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const endTime = new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid #eee' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>{ts.clientName}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{dateStr}{!isDuree && ` · ${startTime} → ${endTime}`}</div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#007AFF' }}>{ts.duration.toFixed(1)}h</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <QuickBtn label="Nouveau pointage" onClick={() => onNavigate('timesheets')} bg="#007AFF" />
        <QuickBtn label="Bilans du mois" onClick={() => onNavigate('bilans')} bg="#34C759" />
        <QuickBtn label="Mes clients" onClick={() => onNavigate('clients')} bg="#FF9500" />
      </div>

      {/* Aide + Footer */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '18px', textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ fontWeight: '600', fontSize: '14px', color: '#333', marginBottom: '10px' }}>Besoin d'aide ?</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <a href="https://wa.me/33676672672?text=Bonjour%2C%20j'ai%20une%20question%20sur%20DomiTemps" target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 18px', backgroundColor: '#25D366', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>WhatsApp</a>
          <a href="mailto:poumpoum6565@gmail.com?subject=DomiTemps%20-%20Aide&body=Bonjour%2C%0A%0A"
            style={{ padding: '8px 18px', backgroundColor: '#007AFF', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>Email</a>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '12px', color: '#bbb' }}>
        DomiTemps · Gestion de temps pour assistantes a domicile
        {user?.role === 'admin' && <span> · <a href="/admin" style={{ color: '#bbb', textDecoration: 'none' }}>admin</a></span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, bg, color }: { label: string; value: string; sub?: string; bg: string; color: string }) {
  return (
    <div style={{ background: bg, padding: '14px 10px', borderRadius: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color, opacity: 0.7, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function QuickBtn({ label, onClick, bg }: { label: string; onClick: () => void; bg: string }) {
  return (
    <button onClick={onClick} style={{ padding: '14px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
      {label}
    </button>
  );
}
