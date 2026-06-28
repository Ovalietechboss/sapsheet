import { useMemo, useState } from 'react';
import type { Indexed } from '../data/metrics';
import { clientLabel } from '../data/metrics';
import { REPORTS } from '../reports/definitions';
import {
  alignFor, formatDisplay, monthLabel,
  type ParamKey, type ReportParams,
} from '../reports/model';
import { exportReportPdf, exportReportExcel } from '../reports/renderReport';

interface Props {
  ds: Indexed;
}

export default function Reports({ ds }: Props) {
  const [reportId, setReportId] = useState<string>(REPORTS[0].id);
  const [params, setParams] = useState<ReportParams>({
    year: ds.years[0] ?? 'all',
    month: 'all',
    clientId: 'all',
    mandataireId: 'all',
    mode: 'all',
  });

  const def = REPORTS.find((r) => r.id === reportId)!;
  const result = useMemo(() => def.run(ds, params), [def, ds, params]);

  const shows = (k: ParamKey) => def.params.includes(k);
  const set = (patch: Partial<ReportParams>) => setParams((p) => ({ ...p, ...patch }));

  const fileBase = `domms-${def.id}-${params.year}${params.month !== 'all' ? '-' + params.month : ''}`;

  return (
    <>
      <div className="controls">
        <div className="control">
          <label>Rapport</label>
          <select value={reportId} onChange={(e) => setReportId(e.target.value)}>
            {REPORTS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {shows('year') && (
          <div className="control">
            <label>Année</label>
            <select
              value={String(params.year)}
              onChange={(e) => set({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
            >
              <option value="all">Toutes</option>
              {ds.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {shows('month') && (
          <div className="control">
            <label>Mois</label>
            <select
              value={String(params.month)}
              onChange={(e) => set({ month: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
            >
              <option value="all">Tous</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
        )}

        {shows('clientId') && (
          <div className="control">
            <label>Client</label>
            <select value={params.clientId} onChange={(e) => set({ clientId: e.target.value })}>
              <option value="all">Tous</option>
              {ds.clients
                .slice()
                .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b)))
                .map((c) => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
            </select>
          </div>
        )}

        {shows('mandataireId') && (
          <div className="control">
            <label>Mandataire</label>
            <select value={params.mandataireId} onChange={(e) => set({ mandataireId: e.target.value })}>
              <option value="all">Tous</option>
              {ds.mandataires.map((m) => (
                <option key={m.id} value={m.id}>{m.association_name}</option>
              ))}
            </select>
          </div>
        )}

        {shows('mode') && (
          <div className="control">
            <label>Mode</label>
            <select value={params.mode} onChange={(e) => set({ mode: e.target.value as ReportParams['mode'] })}>
              <option value="all">Tous</option>
              <option value="CESU">CESU</option>
              <option value="CLASSICAL">Classique</option>
            </select>
          </div>
        )}

        <div className="spacer" />
        <button className="action ghost" onClick={() => exportReportExcel(result, fileBase)}>Export Excel</button>
        <button className="action" onClick={() => exportReportPdf(result, fileBase)}>Export PDF</button>
      </div>

      <div className="panel wide">
        <h3>{result.title} <span className="badge">{result.subtitle}</span></h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>{def.description}</p>

        {result.groups.every((g) => g.rows.length === 0) ? (
          <div className="state">{result.emptyMessage || 'Aucune donnée.'}</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} className={alignFor(c.format) === 'right' ? 'num' : ''}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.groups.map((g, gi) => (
                <GroupBlock key={gi} group={g} columns={result.columns} />
              ))}
              {result.grandTotals && (
                <tr style={{ background: 'var(--brand-soft)' }}>
                  {result.columns.map((c) => (
                    <td key={c.key} className={alignFor(c.format) === 'right' ? 'num' : ''}>
                      <strong>{formatDisplay(result.grandTotals![c.key], c.format)}</strong>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function GroupBlock({
  group,
  columns,
}: {
  group: import('../reports/model').ReportGroup;
  columns: import('../reports/model').ReportColumn[];
}) {
  if (group.rows.length === 0) return null;
  return (
    <>
      {group.label && (
        <tr>
          <td colSpan={columns.length} style={{ fontWeight: 700, color: 'var(--brand)', paddingTop: 14 }}>
            {group.label}
          </td>
        </tr>
      )}
      {group.rows.map((r, ri) => (
        <tr key={ri}>
          {columns.map((c) => (
            <td key={c.key} className={alignFor(c.format) === 'right' ? 'num' : ''}>
              {formatDisplay(r[c.key], c.format)}
            </td>
          ))}
        </tr>
      ))}
      {group.subtotals && (
        <tr style={{ background: '#f1f5f9' }}>
          {columns.map((c) => (
            <td key={c.key} className={alignFor(c.format) === 'right' ? 'num' : ''}>
              <strong>{formatDisplay(group.subtotals![c.key], c.format)}</strong>
            </td>
          ))}
        </tr>
      )}
    </>
  );
}
