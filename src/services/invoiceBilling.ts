/**
 * Regles de facturation d'un mois — extraites de l'ecran Bilans pour etre testables.
 *
 * Contexte (incident octobre 2026) : une facture emise en avance et deja PAYEE a ete
 * ecrasee lors de la generation de la facture de fin de mois, et son detail refacture
 * au client. Deux causes, toutes deux couvertes ici :
 *
 *   1. la facture du mois etait identifiee par (client, mois, annee), donc une seconde
 *      facture dans le mois ne pouvait pas exister : elle remplacait la premiere ;
 *   2. rien ne disait qu'un pointage etait deja facture, donc tout le mois etait
 *      systematiquement recompte.
 *
 * Les deux fonctions ci-dessous sont pures : elles ne lisent ni store ni reseau.
 */

/** Juste ce dont ces regles ont besoin — volontairement plus etroit que `Invoice`. */
export interface BillableInvoice {
  id: string;
  status: 'draft' | 'sent' | 'paid';
  sent_at?: number | null;
  paid_at?: number | null;
  credit_of?: string | null;
}

/** Idem pour les pointages. */
export interface BillableTimesheet {
  id: string;
  invoice_id?: string | null;
}

/**
 * La seule facture du mois qu'on s'autorise a reecrire : un brouillon jamais transmis
 * et jamais encaisse.
 *
 * Tout le reste — envoyee, payee, remise en main propre — est un document qui a quitte
 * l'application. On ne le modifie pas : on empile une nouvelle facture a cote, et une
 * correction passe par un avoir. C'est le garde-fou qui manquait en octobre 2026.
 *
 * Renvoie `null` s'il n'y en a pas : l'appelant doit alors CREER une facture.
 */
export function editableInvoiceOf<T extends BillableInvoice>(
  monthInvoices: ReadonlyArray<T>,
): T | null {
  return monthInvoices.find(
    (i) => !i.credit_of && i.status === 'draft' && !i.sent_at && !i.paid_at,
  ) ?? null;
}

/**
 * Ce que portera la prochaine facture : les pointages du mois qui ne sont encore
 * sur aucune facture.
 *
 * Exception volontaire : ceux deja imputes a la facture BROUILLON en cours. Regenerer
 * un brouillon doit reprendre ses propres lignes, sinon le second clic produirait une
 * facture vide. Les pointages d'une facture emise, eux, ne reviennent jamais.
 */
export function billableTimesheetsOf<T extends BillableTimesheet>(
  monthTimesheets: ReadonlyArray<T>,
  editableInvoice: BillableInvoice | null,
): T[] {
  return monthTimesheets.filter(
    (ts) => !ts.invoice_id || (editableInvoice !== null && ts.invoice_id === editableInvoice.id),
  );
}

/**
 * Etat d'un MOIS, et non d'un document.
 *
 * Depuis qu'un mois peut porter plusieurs factures, afficher l'etat de la plus
 * recente est un mensonge : un mois dont la facture d'avance etait partie mais
 * dont le solde n'existait pas s'annoncait « Envoye ». C'est ce qui a fait perdre
 * le fil en novembre 2026.
 *
 * Regle : le mois n'est « envoye » que lorsque plus rien n'attend -- aucune heure
 * a facturer, et aucune facture qui n'ait ete transmise.
 */
export function monthDocState(
  monthInvoices: ReadonlyArray<BillableInvoice & { sent_at?: number | null }>,
  nbTimesheetsAFacturer: number,
): 'pending' | 'generated' | 'sent' {
  if (monthInvoices.length === 0) return 'pending';
  if (nbTimesheetsAFacturer > 0) return 'generated';
  if (monthInvoices.some((i) => !i.sent_at)) return 'generated';
  return 'sent';
}
