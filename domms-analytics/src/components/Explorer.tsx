import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Indexed, PeriodFilter } from '../data/metrics';
import {
  MEASURES, DIMENSIONS, measuresForDimension, runExploration,
  type MeasureKey, type DimensionKey,
} from '../data/explorer';
import PeriodControls from './PeriodControls';
import { exportPdf, exportExcel, type ReportPayload } from '../reports/export';

type ChartKind = 'bar' | 'line' | 'table';

interface Props {
  ds: Indexed;
}

export default function Explorer({ ds }: Props) {
  const [period, setPeriod] = useState<PeriodFilter>({ year: ds.years[0] ?? 'all' });
  const [dimension, setDimension] = useState<DimensionKey>('mois');
  const [measure, setMeasure] = useState<MeasureKey>('heures');
  const [chart, setChart] = useState<ChartKind>('bar');

  const allowedMeasures = measuresForDimension(dimension);
  const effectiveMeasure = allowedMeasures.some((m) => m.key === measure)
    ? measure
    : allowedMeasures[0].key;

  const rows = useMemo(
    () => runExploration(ds, period, effectiveMeasure, dimension),
    [ds, period, effectiveMeasure, dimension]
  );

  const measureDef = MEASURES.find((m) => m.key === effectiveMeasure)!;
  const dimDef = DIMENSIONS.find((d) => d.key === dimension)!;
  const total = rows.reduce((s, r) => s + r.value, 0);

  function payload(): ReportPayload {
    return {
      title: 'Domms — Exploration',
      subtitle: `${measureDef.label} par ${dimDef.label} — ${
        period.year === 'all' ? 'toutes années' : period.year
      }`,
      tables: [
        {
          title: `${measureDef.label} par ${dimDef.label}`,
          columns: [dimDef.label, measureDef.label],
          rows: rows.map((r) => [r.label, r.value]),
        },
      ],
    };
  }

  const fileBase = `domms-${effectiveMeasure}-par-${dimension}`;

  return (
    <>
      <PeriodControls years={ds.years} period={period} onChange={setPeriod}>
        <div className="control">
          <label>Dimension</label>
          <select value={dimension} onChange={(e) => setDimension(e.target.value as DimensionKey)}>
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="control">
          <label>Mesure</label>
          <select value={effectiveMeasure} onChange={(e) => setMeasure(e.target.value as MeasureKey)}>
            {allowedMeasures.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="control">
          <label>Affichage</label>
          <select value={chart} onChange={(e) => setChart(e.target.value as ChartKind)}>
            <option value="bar">Barres</option>
            <option value="line">Courbe</option>
            <option value="table">Table seule</option>
          </select>
        </div>
        <button className="action ghost" onClick={() => exportExcel(payload(), fileBase)}>Export Excel</button>
        <button className="action" onClick={() => exportPdf(payload(), fileBase)}>Export PDF</button>
      </PeriodControls>

      {rows.length === 0 ? (
        <div className="state">Aucune donnée pour cette sélection.</div>
      ) : (
        <div className="grid">
          {chart !== 'table' && (
            <div className="panel wide">
              <h3>
                {measureDef.label} par {dimDef.label}{' '}
                <span className="badge">total : {total.toLocaleString('fr-FR')} {measureDef.unit}</span>
              </h3>
              <ResponsiveContainer width="100%" height={340}>
                {chart === 'bar' ? (
                  <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={64} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name={measureDef.label} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={64} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" name={measureDef.label} stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel wide">
            <h3>Détail</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>{dimDef.label}</th>
                  <th className="num">{measureDef.label} ({measureDef.unit})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td className="num">{r.value.toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="num"><strong>{total.toLocaleString('fr-FR')}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
