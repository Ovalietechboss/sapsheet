import type { ReconstructedInvoice } from './invoiceHistoryReconstruction';

/**
 * Consolidation de l'import de reprise 2026 : historique DomiTemps (auto) + factures
 * facture.net (saisie manuelle), triés par date, avec numérotation séquentielle
 * `AAAA-NNN (ancien n°)`. Pur — ne crée rien (la création se fait après validation PO).
 */
export interface ManualLegacyInvoice {
  oldNumber: string; // n° facture.net d'origine
  date: number; // ms
  clientId: string;
  clientName: string;
  amount: number;
  paid: boolean;
}

export interface ConsolidatedInvoice {
  seq: number;
  newNumber: string; // "2026-001 (ancien n°)"
  clientId: string;
  clientName: string;
  month: number;
  year: number;
  amount: number;
  date: number;
  status: 'sent' | 'paid';
  oldNumber: string;
  source: 'domitemps' | 'facture.net';
}

const manualKey = (clientId: string, dateMs: number) => {
  const d = new Date(dateMs);
  return `${clientId}|${d.getMonth() + 1}|${d.getFullYear()}`;
};

/** Reconstructions DomiTemps écartées car couvertes par une facture.net (même client × mois). */
export function supersededByManual(
  domitemps: ReadonlyArray<ReconstructedInvoice>,
  manual: ReadonlyArray<ManualLegacyInvoice>,
): ReconstructedInvoice[] {
  const keys = new Set(manual.map((m) => manualKey(m.clientId, m.date)));
  return domitemps.filter((d) => keys.has(`${d.clientId}|${d.month}|${d.year}`));
}

export function consolidateInvoiceImport(params: {
  domitemps: ReadonlyArray<ReconstructedInvoice>;
  manual: ReadonlyArray<ManualLegacyInvoice>;
  year: number;
  startSeq?: number; // défaut 1
}): ConsolidatedInvoice[] {
  // facture.net prioritaire : on écarte la reconstruction DomiTemps d'un (client × mois)
  // déjà couvert par une facture.net saisie (= la vraie facture émise) → pas de doublon.
  const manualKeys = new Set(params.manual.map((m) => manualKey(m.clientId, m.date)));
  const domFiltered = params.domitemps.filter((d) => !manualKeys.has(`${d.clientId}|${d.month}|${d.year}`));

  const merged = [
    ...domFiltered.map((d) => ({
      clientId: d.clientId, clientName: d.clientName, month: d.month, year: d.year,
      amount: d.amount, date: d.date, oldNumber: d.oldNumber,
      status: 'sent' as const, source: 'domitemps' as const,
    })),
    ...params.manual.map((m) => {
      const dt = new Date(m.date);
      return {
        clientId: m.clientId, clientName: m.clientName,
        month: dt.getMonth() + 1, year: dt.getFullYear(),
        amount: m.amount, date: m.date, oldNumber: m.oldNumber,
        status: (m.paid ? 'paid' : 'sent') as 'sent' | 'paid',
        source: 'facture.net' as const,
      };
    }),
  ].sort((a, b) => a.date - b.date);

  const start = params.startSeq ?? 1;
  return merged.map((m, i) => {
    const seq = start + i;
    return { ...m, seq, newNumber: `${params.year}-${String(seq).padStart(3, '0')} (${m.oldNumber})` };
  });
}

/**
 * Détecte les recouvrements potentiels (même client + même mois entre les 2 sources, ou
 * déjà présent dans `invoices`). Sert à alerter le PO avant création (anti-doublon).
 */
export function findImportOverlaps(
  consolidated: ReadonlyArray<ConsolidatedInvoice>,
  existing: ReadonlyArray<{ client_id: string; month: number; year: number }>,
): string[] {
  const warns: string[] = [];
  const seen = new Map<string, ConsolidatedInvoice>();
  for (const c of consolidated) {
    const key = `${c.clientId}|${c.month}|${c.year}`;
    if (seen.has(key)) warns.push(`Doublon ${c.clientName} ${c.month}/${c.year} (${seen.get(key)!.source} ↔ ${c.source})`);
    else seen.set(key, c);
    if (existing.some((e) => e.client_id === c.clientId && e.month === c.month && e.year === c.year)) {
      warns.push(`Déjà dans Factures : ${c.clientName} ${c.month}/${c.year}`);
    }
  }
  return warns;
}
