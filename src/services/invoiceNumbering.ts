/**
 * Numérotation de facture — série ANNUELLE continue `YYYY-NNN` (arbitrage #4 du brief).
 *
 * Conformité : le prochain numéro = max(séquence existante de l'année) + 1,
 * et JAMAIS un simple compteur `count + 1` (qui réutiliserait un numéro déjà
 * émis après suppression d'une facture → doublon/rupture interdits).
 *
 * `startOffset` permet de démarrer au-delà du dernier numéro facture.net lors de
 * la bascule (transition documentée). À fixer par le PO avant mise en service.
 *
 * Les anciens numéros au format mensuel `YYYY-MM-NNN` (deux tirets) ne matchent
 * pas le format annuel `YYYY-NNN` (un tiret) → ils sont ignorés, l'historique
 * existant est préservé sans collision.
 *
 * ⚠ Les factures de REPRISE portent `YYYY-NNN (ancien numéro)` : `invoiceImport.ts`
 * leur attribue la série conforme et garde l'ancienne référence entre parenthèses.
 * Ce sont de VRAIS numéros du registre. Le motif ancré sur la fin les ignorait, donc
 * la série repartait à 001 et entrait en collision (incident 2026-11-11 : `2026-002`
 * émise alors que `2026-002 (FAC-2026-03-PLET)` existait déjà). Le motif accepte
 * désormais un suffixe séparé par une espace, sans jamais matcher `YYYY-MM-NNN`
 * (où les chiffres sont suivis d'un tiret).
 */
/**
 * Dernier numero de facture emis sous l'ancien outil (facture.net) avant la bascule.
 * La serie de l'application demarre juste apres, pour qu'aucun numero ne soit reutilise.
 * 0 = on demarre a 001. A fixer par le PO avant mise en service.
 *
 * Volontairement ici et pas dans un ecran : les factures naissent a DEUX endroits
 * (onglet Factures pour les societes, onglet Bilans pour les pointages). Deux copies
 * de ce reglage finiraient par diverger et casser la continuite de la serie.
 */
export const INVOICE_NUMBER_START = 0;

export function nextInvoiceNumber(
  invoices: ReadonlyArray<{ invoice_number?: string | null }>,
  year: number,
  startOffset = 0,
): string {
  const re = new RegExp(`^${year}-(\\d+)(?:\\s|$)`);
  let max = startOffset;
  for (const inv of invoices) {
    const m = inv.invoice_number?.match(re);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Numérotation des AVOIRS — série annuelle dédiée `AV-AAAA-NNN`, gap-safe (max+1).
 * Distincte de la série factures pour ne pas perturber sa continuité.
 */
export function nextCreditNumber(
  invoices: ReadonlyArray<{ invoice_number?: string | null }>,
  year: number,
): string {
  const re = new RegExp(`^AV-${year}-(\\d+)$`);
  let max = 0;
  for (const inv of invoices) {
    const m = inv.invoice_number?.match(re);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }
  return `AV-${year}-${String(max + 1).padStart(3, '0')}`;
}
