// Catalogue de rapports paramétrables (remplacement BIRT).
// Chaque rapport produit un ReportResult en bandes (groupes + sous-totaux).

import type { Indexed } from '../data/metrics';
import { clientLabel, fraisTotal } from '../data/metrics';
import type { Client, Invoice, Timesheet } from '../lib/types';
import {
  monthLabel,
  type ReportDefinition,
  type ReportGroup,
  type ReportParams,
  type ReportResult,
  type ReportRow,
} from './model';

// ----------------------------------------------------------------------------
// Filtres communs
// ----------------------------------------------------------------------------

function matchClient(c: Client | undefined, p: ReportParams): boolean {
  if (!c) return p.clientId === 'all' && p.mandataireId === 'all' && p.mode === 'all';
  if (p.clientId !== 'all' && c.id !== p.clientId) return false;
  if (p.mandataireId !== 'all' && c.mandataire_id !== p.mandataireId) return false;
  if (p.mode !== 'all' && c.facturation_mode !== p.mode) return false;
  return true;
}

function filterTimesheets(ds: Indexed, p: ReportParams): Timesheet[] {
  return ds.timesheets.filter((t) => {
    const d = new Date(t.date_arrival);
    if (p.year !== 'all' && d.getFullYear() !== p.year) return false;
    if (p.month !== 'all' && d.getMonth() + 1 !== p.month) return false;
    return matchClient(ds.clientById.get(t.client_id), p);
  });
}

function filterInvoices(ds: Indexed, p: ReportParams): Invoice[] {
  return ds.invoices.filter((i) => {
    if (p.year !== 'all' && i.year !== p.year) return false;
    if (p.month !== 'all' && i.month !== p.month) return false;
    return matchClient(ds.clientById.get(i.client_id), p);
  });
}

function round(n: number): number {
  return Math.round((n || 0) * 100) / 100;
}

function periodSubtitle(p: ReportParams): string {
  const parts: string[] = [];
  parts.push(p.year === 'all' ? 'Toutes années' : `Année ${p.year}`);
  if (p.month !== 'all') parts.push(monthLabel(p.month));
  if (p.mode !== 'all') parts.push(p.mode === 'CESU' ? 'CESU' : 'Classique');
  return parts.join(' · ');
}

// ----------------------------------------------------------------------------
// 1. Relevé d'activité — interventions groupées par client
// ----------------------------------------------------------------------------

const activityReport: ReportDefinition = {
  id: 'activity',
  name: "Relevé d'activité",
  description: "Interventions détaillées groupées par client, avec sous-totaux heures / frais / revenu.",
  params: ['year', 'month', 'clientId', 'mandataireId', 'mode'],
  run: (ds, p): ReportResult => {
    const ts = filterTimesheets(ds, p);
    const byClient = new Map<string, Timesheet[]>();
    ts.forEach((t) => {
      const arr = byClient.get(t.client_id) ?? [];
      arr.push(t);
      byClient.set(t.client_id, arr);
    });

    const groups: ReportGroup[] = [];
    let gHeures = 0;
    let gFrais = 0;
    let gRevenu = 0;

    for (const [clientId, rows] of byClient) {
      const client = ds.clientById.get(clientId);
      const rate = client?.hourly_rate || 0;
      let heures = 0;
      let frais = 0;
      let revenu = 0;
      const reportRows: ReportRow[] = rows
        .sort((a, b) => a.date_arrival - b.date_arrival)
        .map((t) => {
          const r = round((t.duration || 0) * rate);
          heures += t.duration || 0;
          frais += fraisTotal(t);
          revenu += r;
          return {
            date: t.date_arrival,
            duree: round(t.duration || 0),
            frais: round(fraisTotal(t)),
            revenu: r,
          };
        });
      gHeures += heures;
      gFrais += frais;
      gRevenu += revenu;
      groups.push({
        label: clientLabel(client, clientId),
        rows: reportRows,
        subtotals: { date: 'Sous-total', duree: round(heures), frais: round(frais), revenu: round(revenu) },
      });
    }

    groups.sort((a, b) => a.label.localeCompare(b.label));

    return {
      title: "Relevé d'activité",
      subtitle: periodSubtitle(p),
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'duree', label: 'Durée', format: 'hours' },
        { key: 'frais', label: 'Frais', format: 'eur' },
        { key: 'revenu', label: 'Revenu', format: 'eur' },
      ],
      groups,
      grandTotals: { date: 'TOTAL', duree: round(gHeures), frais: round(gFrais), revenu: round(gRevenu) },
      emptyMessage: 'Aucune intervention sur la période.',
    };
  },
};

// ----------------------------------------------------------------------------
// 2. Journal de facturation — factures groupées par statut
// ----------------------------------------------------------------------------

const STATUT_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
};

const invoiceJournal: ReportDefinition = {
  id: 'invoices',
  name: 'Journal de facturation',
  description: 'Factures groupées par statut, avec nombre et montant par statut et total général.',
  params: ['year', 'month', 'clientId', 'mandataireId', 'mode'],
  run: (ds, p): ReportResult => {
    const inv = filterInvoices(ds, p);
    const byStatus = new Map<string, Invoice[]>();
    inv.forEach((i) => {
      const arr = byStatus.get(i.status) ?? [];
      arr.push(i);
      byStatus.set(i.status, arr);
    });

    const groups: ReportGroup[] = [];
    let gMontant = 0;
    let gCount = 0;
    for (const status of ['draft', 'sent', 'paid']) {
      const rows = byStatus.get(status);
      if (!rows || rows.length === 0) continue;
      let montant = 0;
      const reportRows: ReportRow[] = rows
        .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
        .map((i) => {
          montant += i.total_amount || 0;
          return {
            numero: i.invoice_number,
            client: clientLabel(ds.clientById.get(i.client_id), i.client_id),
            periode: `${monthLabel(i.month)} ${i.year}`,
            montant: round(i.total_amount || 0),
          };
        });
      gMontant += montant;
      gCount += rows.length;
      groups.push({
        label: `${STATUT_LABEL[status] || status} (${rows.length})`,
        rows: reportRows,
        subtotals: { numero: 'Sous-total', client: '', periode: `${rows.length} facture(s)`, montant: round(montant) },
      });
    }

    return {
      title: 'Journal de facturation',
      subtitle: periodSubtitle(p),
      columns: [
        { key: 'numero', label: 'N° facture', format: 'text' },
        { key: 'client', label: 'Client', format: 'text' },
        { key: 'periode', label: 'Période', format: 'text' },
        { key: 'montant', label: 'Montant', format: 'eur' },
      ],
      groups,
      grandTotals: { numero: 'TOTAL', client: '', periode: `${gCount} facture(s)`, montant: round(gMontant) },
      emptyMessage: 'Aucune facture sur la période.',
    };
  },
};

// ----------------------------------------------------------------------------
// 3. Synthèse par mandataire — heures & revenu par client, groupés mandataire
// ----------------------------------------------------------------------------

const mandataireSummary: ReportDefinition = {
  id: 'mandataire',
  name: 'Synthèse par mandataire',
  description: 'Heures et revenu par client, regroupés par mandataire, avec sous-totaux.',
  params: ['year', 'month', 'mandataireId', 'mode'],
  run: (ds, p): ReportResult => {
    const ts = filterTimesheets(ds, p);
    // Agrège par client
    const perClient = new Map<string, { heures: number; revenu: number }>();
    ts.forEach((t) => {
      const rate = ds.clientById.get(t.client_id)?.hourly_rate || 0;
      const agg = perClient.get(t.client_id) ?? { heures: 0, revenu: 0 };
      agg.heures += t.duration || 0;
      agg.revenu += (t.duration || 0) * rate;
      perClient.set(t.client_id, agg);
    });

    // Regroupe les clients par mandataire
    const byMandataire = new Map<string, string[]>();
    for (const clientId of perClient.keys()) {
      const mId = ds.clientById.get(clientId)?.mandataire_id || '∅';
      const arr = byMandataire.get(mId) ?? [];
      arr.push(clientId);
      byMandataire.set(mId, arr);
    }

    const groups: ReportGroup[] = [];
    let gHeures = 0;
    let gRevenu = 0;
    for (const [mId, clientIds] of byMandataire) {
      const mandataire = ds.mandataires.find((m) => m.id === mId);
      let heures = 0;
      let revenu = 0;
      const rows: ReportRow[] = clientIds
        .map((cid) => {
          const agg = perClient.get(cid)!;
          heures += agg.heures;
          revenu += agg.revenu;
          return {
            client: clientLabel(ds.clientById.get(cid), cid),
            heures: round(agg.heures),
            revenu: round(agg.revenu),
          };
        })
        .sort((a, b) => Number(b.revenu) - Number(a.revenu));
      gHeures += heures;
      gRevenu += revenu;
      groups.push({
        label: mandataire?.association_name || 'Sans mandataire',
        rows,
        subtotals: { client: 'Sous-total', heures: round(heures), revenu: round(revenu) },
      });
    }

    groups.sort((a, b) => a.label.localeCompare(b.label));

    return {
      title: 'Synthèse par mandataire',
      subtitle: periodSubtitle(p),
      columns: [
        { key: 'client', label: 'Client', format: 'text' },
        { key: 'heures', label: 'Heures', format: 'hours' },
        { key: 'revenu', label: 'Revenu', format: 'eur' },
      ],
      groups,
      grandTotals: { client: 'TOTAL', heures: round(gHeures), revenu: round(gRevenu) },
      emptyMessage: 'Aucune activité sur la période.',
    };
  },
};

// ----------------------------------------------------------------------------
// 4. Détail des interventions — liste plate (sans groupe)
// ----------------------------------------------------------------------------

const interventionDetail: ReportDefinition = {
  id: 'detail',
  name: 'Détail des interventions',
  description: 'Liste chronologique de toutes les interventions filtrées, avec total général.',
  params: ['year', 'month', 'clientId', 'mandataireId', 'mode'],
  run: (ds, p): ReportResult => {
    const ts = filterTimesheets(ds, p).sort((a, b) => a.date_arrival - b.date_arrival);
    let gHeures = 0;
    let gFrais = 0;
    let gRevenu = 0;
    const rows: ReportRow[] = ts.map((t) => {
      const client = ds.clientById.get(t.client_id);
      const revenu = round((t.duration || 0) * (client?.hourly_rate || 0));
      gHeures += t.duration || 0;
      gFrais += fraisTotal(t);
      gRevenu += revenu;
      return {
        date: t.date_arrival,
        client: clientLabel(client, t.client_id),
        duree: round(t.duration || 0),
        frais: round(fraisTotal(t)),
        revenu,
      };
    });

    return {
      title: 'Détail des interventions',
      subtitle: periodSubtitle(p),
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'client', label: 'Client', format: 'text' },
        { key: 'duree', label: 'Durée', format: 'hours' },
        { key: 'frais', label: 'Frais', format: 'eur' },
        { key: 'revenu', label: 'Revenu', format: 'eur' },
      ],
      groups: [{ label: '', rows }],
      grandTotals: { date: 'TOTAL', client: '', duree: round(gHeures), frais: round(gFrais), revenu: round(gRevenu) },
      emptyMessage: 'Aucune intervention sur la période.',
    };
  },
};

export const REPORTS: ReportDefinition[] = [
  activityReport,
  invoiceJournal,
  mandataireSummary,
  interventionDetail,
];
