import type {
  Client,
  DommsDataset,
  Invoice,
  Timesheet,
} from '../lib/types';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

export function fraisTotal(ts: Timesheet): number {
  return (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
}

export function clientLabel(c: Client | undefined, fallback = '—'): string {
  if (!c) return fallback;
  return [c.first_name, c.name].filter(Boolean).join(' ').trim() || c.name || fallback;
}

/** Mois au format YYYY-MM à partir d'un epoch ms. */
export function monthKey(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function hours(n: number): string {
  return `${(Math.round((n || 0) * 100) / 100).toLocaleString('fr-FR')} h`;
}

// ----------------------------------------------------------------------------
// Indexation
// ----------------------------------------------------------------------------

export interface Indexed extends DommsDataset {
  clientById: Map<string, Client>;
  years: number[];
}

export function indexDataset(ds: DommsDataset): Indexed {
  const clientById = new Map(ds.clients.map((c) => [c.id, c]));
  const yearSet = new Set<number>();
  ds.timesheets.forEach((t) => yearSet.add(new Date(t.date_arrival).getFullYear()));
  ds.invoices.forEach((i) => yearSet.add(i.year));
  const years = [...yearSet].filter(Boolean).sort((a, b) => b - a);
  return { ...ds, clientById, years };
}

// ----------------------------------------------------------------------------
// Filtre période
// ----------------------------------------------------------------------------

export interface PeriodFilter {
  year: number | 'all';
}

export function filterTimesheets(ds: Indexed, period: PeriodFilter): Timesheet[] {
  if (period.year === 'all') return ds.timesheets;
  return ds.timesheets.filter(
    (t) => new Date(t.date_arrival).getFullYear() === period.year
  );
}

export function filterInvoices(ds: Indexed, period: PeriodFilter): Invoice[] {
  if (period.year === 'all') return ds.invoices;
  return ds.invoices.filter((i) => i.year === period.year);
}

// ----------------------------------------------------------------------------
// KPIs
// ----------------------------------------------------------------------------

export interface Kpis {
  heures: number;
  revenuPrestations: number; // duration × hourly_rate
  frais: number;
  interventions: number;
  clientsActifs: number;
  caFacture: number; // somme invoices
  caEncaisse: number; // status = paid
  caEnAttente: number; // status = sent
  nbFactures: number;
}

export function computeKpis(ds: Indexed, period: PeriodFilter): Kpis {
  const ts = filterTimesheets(ds, period);
  const inv = filterInvoices(ds, period);

  let heures = 0;
  let revenuPrestations = 0;
  let frais = 0;
  const clients = new Set<string>();
  ts.forEach((t) => {
    heures += t.duration || 0;
    frais += fraisTotal(t);
    clients.add(t.client_id);
    const rate = ds.clientById.get(t.client_id)?.hourly_rate || 0;
    revenuPrestations += (t.duration || 0) * rate;
  });

  let caFacture = 0;
  let caEncaisse = 0;
  let caEnAttente = 0;
  inv.forEach((i) => {
    caFacture += i.total_amount || 0;
    if (i.status === 'paid') caEncaisse += i.total_amount || 0;
    if (i.status === 'sent') caEnAttente += i.total_amount || 0;
  });

  return {
    heures: round(heures),
    revenuPrestations: round(revenuPrestations),
    frais: round(frais),
    interventions: ts.length,
    clientsActifs: clients.size,
    caFacture: round(caFacture),
    caEncaisse: round(caEncaisse),
    caEnAttente: round(caEnAttente),
    nbFactures: inv.length,
  };
}

// ----------------------------------------------------------------------------
// Séries pour graphiques
// ----------------------------------------------------------------------------

export interface MonthlyPoint {
  mois: string; // YYYY-MM
  label: string; // ex "mars 2026"
  heures: number;
  ca: number;
  frais: number;
}

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function labelFromKey(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_FR[Number(m) - 1]} ${y}`;
}

/** Évolution mensuelle (heures + CA facturé) sur la période. */
export function monthlySeries(ds: Indexed, period: PeriodFilter): MonthlyPoint[] {
  const ts = filterTimesheets(ds, period);
  const inv = filterInvoices(ds, period);
  const map = new Map<string, MonthlyPoint>();

  const ensure = (key: string): MonthlyPoint => {
    let p = map.get(key);
    if (!p) {
      p = { mois: key, label: labelFromKey(key), heures: 0, ca: 0, frais: 0 };
      map.set(key, p);
    }
    return p;
  };

  ts.forEach((t) => {
    const p = ensure(monthKey(t.date_arrival));
    p.heures += t.duration || 0;
    p.frais += fraisTotal(t);
  });
  inv.forEach((i) => {
    const key = `${i.year}-${String(i.month).padStart(2, '0')}`;
    ensure(key).ca += i.total_amount || 0;
  });

  return [...map.values()]
    .map((p) => ({ ...p, heures: round(p.heures), ca: round(p.ca), frais: round(p.frais) }))
    .sort((a, b) => a.mois.localeCompare(b.mois));
}

export interface Slice {
  name: string;
  value: number;
}

/** Répartition CESU vs Classique (par heures). */
export function modeSplit(ds: Indexed, period: PeriodFilter): Slice[] {
  const ts = filterTimesheets(ds, period);
  let cesu = 0;
  let classical = 0;
  ts.forEach((t) => {
    const mode = ds.clientById.get(t.client_id)?.facturation_mode;
    if (mode === 'CESU') cesu += t.duration || 0;
    else classical += t.duration || 0;
  });
  return [
    { name: 'CESU', value: round(cesu) },
    { name: 'Classique', value: round(classical) },
  ].filter((s) => s.value > 0);
}

/** Statut des factures (par montant). */
export function invoiceStatusSplit(ds: Indexed, period: PeriodFilter): Slice[] {
  const inv = filterInvoices(ds, period);
  const acc = { draft: 0, sent: 0, paid: 0 };
  inv.forEach((i) => {
    acc[i.status] = (acc[i.status] || 0) + (i.total_amount || 0);
  });
  return [
    { name: 'Brouillon', value: round(acc.draft) },
    { name: 'Envoyée', value: round(acc.sent) },
    { name: 'Payée', value: round(acc.paid) },
  ].filter((s) => s.value > 0);
}

export interface ClientRank {
  clientId: string;
  name: string;
  heures: number;
  revenu: number;
}

/** Top clients par revenu prestations. */
export function topClients(ds: Indexed, period: PeriodFilter, limit = 8): ClientRank[] {
  const ts = filterTimesheets(ds, period);
  const map = new Map<string, ClientRank>();
  ts.forEach((t) => {
    const c = ds.clientById.get(t.client_id);
    const rate = c?.hourly_rate || 0;
    let r = map.get(t.client_id);
    if (!r) {
      r = { clientId: t.client_id, name: clientLabel(c, t.client_id), heures: 0, revenu: 0 };
      map.set(t.client_id, r);
    }
    r.heures += t.duration || 0;
    r.revenu += (t.duration || 0) * rate;
  });
  return [...map.values()]
    .map((r) => ({ ...r, heures: round(r.heures), revenu: round(r.revenu) }))
    .sort((a, b) => b.revenu - a.revenu)
    .slice(0, limit);
}

function round(n: number): number {
  return Math.round((n || 0) * 100) / 100;
}
