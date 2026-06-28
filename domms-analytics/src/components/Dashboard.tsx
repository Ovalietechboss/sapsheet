import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { Indexed, PeriodFilter } from '../data/metrics';
import {
  computeKpis, monthlySeries, modeSplit, invoiceStatusSplit, topClients,
  eur, hours,
} from '../data/metrics';
import KpiCard from './KpiCard';
import PeriodControls from './PeriodControls';
import { exportPdf, exportExcel, type ReportPayload } from '../reports/export';

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

interface Props {
  ds: Indexed;
}

export default function Dashboard({ ds }: Props) {
  const [period, setPeriod] = useState<PeriodFilter>({
    year: ds.years[0] ?? 'all',
  });

  const kpis = useMemo(() => computeKpis(ds, period), [ds, period]);
  const series = useMemo(() => monthlySeries(ds, period), [ds, period]);
  const modes = useMemo(() => modeSplit(ds, period), [ds, period]);
  const statuses = useMemo(() => invoiceStatusSplit(ds, period), [ds, period]);
  const tops = useMemo(() => topClients(ds, period), [ds, period]);

  const periodLabel = period.year === 'all' ? 'toutes années' : String(period.year);

  function buildPayload(): ReportPayload {
    return {
      title: 'Domms — Tableau de bord',
      subtitle: `Période : ${periodLabel}`,
      tables: [
        {
          title: 'Indicateurs clés',
          columns: ['Indicateur', 'Valeur'],
          rows: [
            ['Heures travaillées', kpis.heures],
            ['Revenu prestations (€)', kpis.revenuPrestations],
            ['Frais annexes (€)', kpis.frais],
            ['Interventions', kpis.interventions],
            ['Clients actifs', kpis.clientsActifs],
            ['CA facturé (€)', kpis.caFacture],
            ['CA encaissé (€)', kpis.caEncaisse],
            ['CA en attente (€)', kpis.caEnAttente],
          ],
        },
        {
          title: 'Évolution mensuelle',
          columns: ['Mois', 'Heures', 'CA facturé (€)', 'Frais (€)'],
          rows: series.map((p) => [p.label, p.heures, p.ca, p.frais]),
        },
        {
          title: 'Top clients',
          columns: ['Client', 'Heures', 'Revenu (€)'],
          rows: tops.map((c) => [c.name, c.heures, c.revenu]),
        },
      ],
    };
  }

  const fileBase = `domms-dashboard-${periodLabel}`.replace(/\s+/g, '-');

  return (
    <>
      <PeriodControls years={ds.years} period={period} onChange={setPeriod}>
        <button className="action ghost" onClick={() => exportExcel(buildPayload(), fileBase)}>
          Export Excel
        </button>
        <button className="action" onClick={() => exportPdf(buildPayload(), fileBase)}>
          Export PDF
        </button>
      </PeriodControls>

      <div className="kpis">
        <KpiCard label="Heures travaillées" value={hours(kpis.heures)} hint={`${kpis.interventions} interventions`} />
        <KpiCard label="Revenu prestations" value={eur(kpis.revenuPrestations)} hint="durée × taux horaire" />
        <KpiCard label="CA facturé" value={eur(kpis.caFacture)} hint={`${kpis.nbFactures} factures`} />
        <KpiCard label="CA encaissé" value={eur(kpis.caEncaisse)} hint={`en attente : ${eur(kpis.caEnAttente)}`} />
        <KpiCard label="Frais annexes" value={eur(kpis.frais)} />
        <KpiCard label="Clients actifs" value={String(kpis.clientsActifs)} />
      </div>

      <div className="grid">
        <div className="panel wide">
          <h3>Évolution mensuelle — heures &amp; CA facturé</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="h" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="ca" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="h" type="monotone" dataKey="heures" name="Heures" stroke="#2563eb" strokeWidth={2} />
              <Line yAxisId="ca" type="monotone" dataKey="ca" name="CA facturé (€)" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Répartition CESU / Classique (heures)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={modes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {modes.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3>Statut des factures (€)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statuses} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statuses.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel wide">
          <h3>Top clients par revenu</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tops} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="revenu" name="Revenu (€)" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
