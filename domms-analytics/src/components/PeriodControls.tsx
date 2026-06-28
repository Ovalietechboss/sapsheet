import type { PeriodFilter } from '../data/metrics';

interface Props {
  years: number[];
  period: PeriodFilter;
  onChange: (p: PeriodFilter) => void;
  children?: React.ReactNode;
}

export default function PeriodControls({ years, period, onChange, children }: Props) {
  return (
    <div className="controls">
      <div className="control">
        <label htmlFor="year">Année</label>
        <select
          id="year"
          value={String(period.year)}
          onChange={(e) =>
            onChange({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })
          }
        >
          <option value="all">Toutes</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}
