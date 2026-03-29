import React, { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore } from '../stores/mandataireStore.supabase';
import { useBillingPeriodStore } from '../stores/billingPeriodStore.supabase';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface Props {
  onNavigate: (tab: string) => void;
}

export default function DashboardTab({ onNavigate }: Props) {
  const { user } = useAuthStore();
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { getPeriod } = useBillingPeriodStore();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = `${JOURS[now.getDay()]} ${now.getDate()} ${MONTHS[currentMonth]}`;

  const firstName = user?.display_name?.split(' ')[0] || 'Bonjour';

  // Stats du mois en cours
  const monthStats = useMemo(() => {
    const start = new Date(currentYear, currentMonth, 1).getTime();
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).getTime();

    const monthTs = timesheets.filter(
      (ts) => ts.date_arrival >= start && ts.date_arrival <= end
    );
    const totalHours = monthTs.reduce((s, ts) => s + ts.duration, 0);
    const activeClients = new Set(monthTs.map((ts) => ts.client_id)).size;
    const totalEarnings = monthTs.reduce((s, ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      const salaire = ts.duration * (client?.hourly_rate || 0);
      const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
      return s + salaire + frais;
    }, 0);

    return { count: monthTs.length, totalHours, activeClients, totalEarnings };
  }, [timesheets, clients, currentMonth, currentYear]);

  // Derniers pointages (5 plus récents)
  const recentTimesheets = useMemo(() => {
    return [...timesheets]
      .sort((a, b) => b.date_arrival - a.date_arrival)
      .slice(0, 5)
      .map((ts) => {
        const client = clients.find((c) => c.id === ts.client_id);
        return { ...ts, clientName: client?.name || 'Inconnu' };
      });
  }, [timesheets, clients]);

  // Période du mois
  const currentPeriod = getPeriod(currentMonth + 1, currentYear);

  const heure = now.getHours();
  const greeting = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* ── Hero / Welcome ──────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #007AFF 0%, #0055CC 100%)',
        borderRadius: '16px',
        padding: '32px 28px',
        color: 'white',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-20px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', right: '60px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <p style={{ fontSize: '14px', opacity: 0.85, marginBottom: '6px' }}>{todayStr}</p>
        <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 4px' }}>
          {greeting}, {firstName}
        </h1>
        <p style={{ fontSize: '15px', opacity: 0.8, margin: 0 }}>
          {monthStats.count === 0
            ? `Aucun pointage ce mois — c'est le moment de commencer !`
            : `${monthStats.count} pointage${monthStats.count > 1 ? 's' : ''} ce mois · ${monthStats.totalHours.toFixed(1)}h travaillées`
          }
        </p>
      </div>

      {/* ── Stats du mois ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Heures" value={`${monthStats.totalHours.toFixed(1)}h`} bg="#EBF9F0" color="#2d8a4e" />
        <StatCard label="Clients actifs" value={String(monthStats.activeClients)} bg="#E8F4FF" color="#1a6fb5" />
        <StatCard label="Pointages" value={String(monthStats.count)} sub={`${monthStats.totalHours.toFixed(1)}h`} bg="#FFF4E5" color="#b36b00" />
        <StatCard label="À percevoir" value={`${monthStats.totalEarnings.toFixed(0)}€`} bg="#F0EBFF" color="#5b3db5" />
      </div>

      {/* ── Actions rapides ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '28px' }}>
        <QuickAction
          icon="📋"
          title="Nouveau pointage"
          subtitle="Ajouter une feuille de temps"
          onClick={() => onNavigate('timesheets')}
          bg="#007AFF"
        />
        <QuickAction
          icon="📅"
          title="Bilan du mois"
          subtitle={currentPeriod
            ? `${MONTHS[currentMonth]} — ${currentPeriod.status === 'locked' ? 'Clôturé' : 'En cours'}`
            : `${MONTHS[currentMonth]} — Pas encore ouvert`
          }
          onClick={() => onNavigate('bilans')}
          bg="#34C759"
        />
        <QuickAction
          icon="👥"
          title="Mes clients"
          subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''} · ${mandataires.length} mandataire${mandataires.length !== 1 ? 's' : ''}`}
          onClick={() => onNavigate('clients')}
          bg="#FF9500"
        />
        <QuickAction
          icon="📊"
          title="Rapports & export"
          subtitle="CSV, PDF, statistiques"
          onClick={() => onNavigate('reports')}
          bg="#AF52DE"
        />
      </div>

      {/* ── Derniers pointages ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Derniers pointages</h3>
          <button
            onClick={() => onNavigate('timesheets')}
            style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            Voir tout →
          </button>
        </div>
        {recentTimesheets.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '30px', background: '#f9f9f9', borderRadius: '10px' }}>
            Aucun pointage enregistré
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {recentTimesheets.map((ts) => {
              const date = new Date(ts.date_arrival);
              const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
              const startTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const endTime = new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: '10px', border: '1px solid #eee' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>{ts.clientName}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{dateStr} · {startTime} → {endTime}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#007AFF' }}>{ts.duration.toFixed(1)}h</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Besoin d'aide ──────────────────────────────────────────────── */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ fontWeight: '600', fontSize: '15px', color: '#333', marginBottom: '12px' }}>Besoin d'aide ?</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="https://wa.me/33676672672?text=Bonjour%2C%20j'ai%20une%20question%20sur%20SAP%20Sheet"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#25D366', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
          >
            WhatsApp
          </a>
          <a
            href="mailto:poumpoum6565@gmail.com?subject=SAP%20Sheet%20-%20Aide&body=Bonjour%2C%0A%0AJ'ai%20besoin%20d'aide%20avec%20SAP%20Sheet%20%3A%0A%0A"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#007AFF', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
          >
            Email
          </a>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '12px', color: '#bbb' }}>
        SAP Sheet · Gestion de temps pour assistantes a domicile
        {user?.role === 'admin' && (
          <span> · <a href="/admin" style={{ color: '#bbb', textDecoration: 'none' }}>admin</a></span>
        )}
      </div>
    </div>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, bg, color }: { label: string; value: string; sub?: string; bg: string; color: string }) {
  return (
    <div style={{ background: bg, padding: '14px 12px', borderRadius: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color, opacity: 0.7, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function QuickAction({ icon, title, subtitle, onClick, bg }: {
  icon: string; title: string; subtitle: string; onClick: () => void; bg: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px', background: 'white', border: '1px solid #eee',
        borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.boxShadow = 'none'; }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: '700', fontSize: '14px', color: '#222', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>{subtitle}</div>
      </div>
    </button>
  );
}
