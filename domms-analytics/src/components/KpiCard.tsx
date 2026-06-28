interface Props {
  label: string;
  value: string;
  hint?: string;
}

export default function KpiCard({ label, value, hint }: Props) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      {hint && <div className="k-hint">{hint}</div>}
    </div>
  );
}
