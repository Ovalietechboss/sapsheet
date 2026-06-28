// Modèle de rapport « en bandes » (style BIRT) : colonnes typées, groupes avec
// sous-totaux et total général. Partagé entre l'aperçu écran et les exports.

import type { FacturationMode } from '../lib/types';

export type Align = 'left' | 'right';
export type ColFormat = 'text' | 'date' | 'hours' | 'eur' | 'int';

export interface ReportColumn {
  key: string;
  label: string;
  format: ColFormat;
  align?: Align;
}

export type CellValue = string | number;
export type ReportRow = Record<string, CellValue>;

export interface ReportGroup {
  label: string;
  rows: ReportRow[];
  subtotals?: ReportRow; // partiel : indexé par clé de colonne
}

export interface ReportResult {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  groups: ReportGroup[];
  grandTotals?: ReportRow;
  emptyMessage?: string;
}

/** Paramètres communs proposés aux rapports. */
export interface ReportParams {
  year: number | 'all';
  month: number | 'all'; // 1-12
  clientId: string | 'all';
  mandataireId: string | 'all';
  mode: FacturationMode | 'all';
}

export type ParamKey = keyof ReportParams;

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  /** Paramètres pertinents pour ce rapport (affichés dans l'UI). */
  params: ParamKey[];
  run: (ds: import('../data/metrics').Indexed, params: ReportParams) => ReportResult;
}

// ----------------------------------------------------------------------------
// Formatage des cellules
// ----------------------------------------------------------------------------

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

export function monthLabel(month: number): string {
  return MONTHS_FR[month - 1] ?? String(month);
}

/** Valeur formatée pour l'affichage écran et le PDF. */
export function formatDisplay(value: CellValue | undefined, format: ColFormat): string {
  if (value === undefined || value === null || value === '') return '';
  switch (format) {
    case 'date':
      return new Date(Number(value)).toLocaleDateString('fr-FR');
    case 'hours':
      return `${Number(value).toLocaleString('fr-FR')} h`;
    case 'eur':
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }).format(Number(value));
    case 'int':
      return Number(value).toLocaleString('fr-FR');
    default:
      return String(value);
  }
}

/** Valeur destinée à Excel (nombre brut quand c'est numérique). */
export function formatExcel(value: CellValue | undefined, format: ColFormat): CellValue {
  if (value === undefined || value === null || value === '') return '';
  if (format === 'date') return new Date(Number(value)).toLocaleDateString('fr-FR');
  if (format === 'text') return String(value);
  return Number(value);
}

export function alignFor(format: ColFormat): Align {
  return format === 'text' || format === 'date' ? 'left' : 'right';
}
