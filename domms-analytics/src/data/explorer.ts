// Moteur d'exploration ad-hoc : croise une MESURE par une DIMENSION,
// à partir des timesheets (enrichis du client/mandataire) ou des invoices.

import type { Indexed, PeriodFilter } from './metrics';
import { filterInvoices, filterTimesheets, fraisTotal, clientLabel, monthKey } from './metrics';

export type MeasureKey =
  | 'heures'
  | 'revenu'
  | 'frais'
  | 'interventions'
  | 'caFacture'
  | 'nbFactures';

export type DimensionKey =
  | 'mois'
  | 'client'
  | 'mandataire'
  | 'mode'
  | 'statutFacture';

export interface MeasureDef {
  key: MeasureKey;
  label: string;
  source: 'timesheets' | 'invoices';
  unit: 'h' | '€' | 'nb';
}

export interface DimensionDef {
  key: DimensionKey;
  label: string;
  source: 'timesheets' | 'invoices' | 'both';
}

export const MEASURES: MeasureDef[] = [
  { key: 'heures', label: 'Heures travaillées', source: 'timesheets', unit: 'h' },
  { key: 'revenu', label: 'Revenu prestations', source: 'timesheets', unit: '€' },
  { key: 'frais', label: 'Frais annexes', source: 'timesheets', unit: '€' },
  { key: 'interventions', label: "Nb d'interventions", source: 'timesheets', unit: 'nb' },
  { key: 'caFacture', label: 'CA facturé', source: 'invoices', unit: '€' },
  { key: 'nbFactures', label: 'Nb de factures', source: 'invoices', unit: 'nb' },
];

export const DIMENSIONS: DimensionDef[] = [
  { key: 'mois', label: 'Mois', source: 'both' },
  { key: 'client', label: 'Client', source: 'both' },
  { key: 'mandataire', label: 'Mandataire', source: 'both' },
  { key: 'mode', label: 'Mode (CESU/Classique)', source: 'both' },
  { key: 'statutFacture', label: 'Statut facture', source: 'invoices' },
];

export interface ExploreRow {
  key: string;
  label: string;
  value: number;
}

const STATUT_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
};

/** Mesures disponibles pour une dimension donnée (compatibilité de source). */
export function measuresForDimension(dim: DimensionKey): MeasureDef[] {
  if (dim === 'statutFacture') return MEASURES.filter((m) => m.source === 'invoices');
  return MEASURES;
}

export function runExploration(
  ds: Indexed,
  period: PeriodFilter,
  measure: MeasureKey,
  dimension: DimensionKey
): ExploreRow[] {
  const def = MEASURES.find((m) => m.key === measure)!;
  const acc = new Map<string, ExploreRow>();
  const bump = (key: string, label: string, value: number) => {
    let row = acc.get(key);
    if (!row) {
      row = { key, label, value: 0 };
      acc.set(key, row);
    }
    row.value += value;
  };

  if (def.source === 'timesheets') {
    for (const t of filterTimesheets(ds, period)) {
      const client = ds.clientById.get(t.client_id);
      const rate = client?.hourly_rate || 0;
      let value = 0;
      if (measure === 'heures') value = t.duration || 0;
      else if (measure === 'revenu') value = (t.duration || 0) * rate;
      else if (measure === 'frais') value = fraisTotal(t);
      else if (measure === 'interventions') value = 1;

      switch (dimension) {
        case 'mois':
          bump(monthKey(t.date_arrival), monthKey(t.date_arrival), value);
          break;
        case 'client':
          bump(t.client_id, clientLabel(client, t.client_id), value);
          break;
        case 'mandataire': {
          const mId = client?.mandataire_id || '∅';
          const m = ds.mandataires.find((x) => x.id === mId);
          bump(mId, m?.association_name || 'Sans mandataire', value);
          break;
        }
        case 'mode':
          bump(client?.facturation_mode || '?', client?.facturation_mode === 'CESU' ? 'CESU' : 'Classique', value);
          break;
        default:
          break;
      }
    }
  } else {
    for (const i of filterInvoices(ds, period)) {
      const client = ds.clientById.get(i.client_id);
      const value = measure === 'nbFactures' ? 1 : i.total_amount || 0;
      switch (dimension) {
        case 'mois':
          bump(`${i.year}-${String(i.month).padStart(2, '0')}`, `${i.year}-${String(i.month).padStart(2, '0')}`, value);
          break;
        case 'client':
          bump(i.client_id, clientLabel(client, i.client_id), value);
          break;
        case 'mandataire': {
          const mId = client?.mandataire_id || '∅';
          const m = ds.mandataires.find((x) => x.id === mId);
          bump(mId, m?.association_name || 'Sans mandataire', value);
          break;
        }
        case 'mode':
          bump(client?.facturation_mode || '?', client?.facturation_mode === 'CESU' ? 'CESU' : 'Classique', value);
          break;
        case 'statutFacture':
          bump(i.status, STATUT_LABEL[i.status] || i.status, value);
          break;
      }
    }
  }

  return [...acc.values()]
    .map((r) => ({ ...r, value: Math.round(r.value * 100) / 100 }))
    .sort((a, b) =>
      dimension === 'mois' ? a.key.localeCompare(b.key) : b.value - a.value
    );
}
