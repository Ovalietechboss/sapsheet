import type { Client } from '../stores/clientStore.supabase';
import type { Timesheet } from '../stores/timesheetStore.supabase';
import type { BillingPeriod, BillingPeriodClient } from '../stores/billingPeriodStore.supabase';

/**
 * Reconstruction de l'historique des factures DomiTemps déjà générées (avant le module Factures).
 *
 * Les factures générées dans Bilans n'étaient PAS persistées dans `invoices` : leur trace est
 * dans `billing_period_clients` (status generated/sent). On les reconstitue ici, en LECTURE SEULE
 * (aucune écriture), pour les proposer à l'import (validation PO puis création avec n° séquentiel).
 *
 * Règles (identiques à BilansTab) :
 *  - clients **classiques uniquement** (CESU = pointage, pas une facture) ;
 *  - montant = Σ round(durée × taux horaire) + frais (repas + transport + autres + IK≥0) ;
 *  - ancien n° = `FAC-AAAA-MM-NomClientNettoyé` ;
 *  - statut `generated`/`sent` retenu (pending/error ignorés).
 */
export interface ReconstructedInvoice {
  clientId: string;
  clientName: string;
  month: number;
  year: number;
  oldNumber: string;
  amount: number;
  date: number; // doc_generated_at (ms)
  source: 'domitemps';
}

const sanitizeTag = (name: string) =>
  name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '');

const round2 = (n: number) => Math.round(n * 100) / 100;

export function reconstructDomiTempsInvoiceHistory(params: {
  periods: ReadonlyArray<Pick<BillingPeriod, 'id' | 'month' | 'year'>>;
  periodClients: ReadonlyArray<Pick<BillingPeriodClient, 'period_id' | 'client_id' | 'status' | 'doc_generated_at'>>;
  clients: ReadonlyArray<Pick<Client, 'id' | 'name' | 'hourly_rate' | 'facturation_mode'>>;
  timesheets: ReadonlyArray<Pick<Timesheet, 'client_id' | 'date_arrival' | 'duration' | 'frais_repas' | 'frais_transport' | 'frais_autres' | 'ik_amount'>>;
  /** N'inclure que les périodes STRICTEMENT avant ce mois (exclut le mois courant et le futur). */
  before?: { month: number; year: number };
}): ReconstructedInvoice[] {
  const periodById = new Map(params.periods.map((p) => [p.id, p]));
  const clientById = new Map(params.clients.map((c) => [c.id, c]));
  const out: ReconstructedInvoice[] = [];

  for (const pc of params.periodClients) {
    if (pc.status !== 'generated' && pc.status !== 'sent') continue;
    const period = periodById.get(pc.period_id);
    const client = clientById.get(pc.client_id);
    if (!period || !client) continue;
    if (client.facturation_mode === 'CESU') continue; // CESU = pointage, pas une facture
    if (params.before && (period.year > params.before.year || (period.year === params.before.year && period.month >= params.before.month))) {
      continue; // exclut le mois courant (et le futur) : seules les factures AVANT ce mois sont importées
    }

    const cts = params.timesheets.filter((ts) => {
      if (ts.client_id !== client.id) return false;
      const d = new Date(ts.date_arrival);
      return d.getFullYear() === period.year && d.getMonth() + 1 === period.month;
    });

    const earnings = cts.reduce((s, ts) => s + round2(ts.duration * client.hourly_rate), 0);
    const frais = cts.reduce(
      (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + Math.max(0, ts.ik_amount || 0),
      0,
    );

    out.push({
      clientId: client.id,
      clientName: client.name,
      month: period.month,
      year: period.year,
      oldNumber: `FAC-${period.year}-${String(period.month).padStart(2, '0')}-${sanitizeTag(client.name)}`,
      amount: round2(earnings + frais),
      date: pc.doc_generated_at ?? new Date(period.year, period.month - 1, 1).getTime(),
      source: 'domitemps',
    });
  }

  return out.sort((a, b) => a.date - b.date);
}
