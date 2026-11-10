import { InvoiceLine } from '../stores/invoiceStore.supabase';
import { Timesheet } from '../stores/timesheetStore.supabase';

/**
 * INSTANTANE d'une facture issue des pointages.
 *
 * Pourquoi : jusqu'ici une facture n'existait que comme une VUE sur les pointages
 * du mois. Elle etait recalculee a chaque affichage, donc modifier un pointage
 * reecrivait retroactivement une facture deja emise -- et meme deja payee. Le
 * 09/11/2026, une correction d'indemnites kilometriques a change le contenu d'une
 * facture encaissee le 14/10, sans que rien ne le signale.
 *
 * Desormais l'emission fige le detail dans `invoices.lines`. Le document redevient
 * une piece : ce qu'il montre est ce qui a ete facture, quoi qu'il arrive ensuite
 * aux pointages. Corriger une facture emise passe par un avoir, pas par une
 * retouche silencieuse.
 *
 * Le total de la facture est la somme de ces lignes -- jamais un calcul parallele,
 * pour qu'un montant stocke et son detail ne puissent pas diverger.
 */

/** Groupe les pointages comme le fait le document : par prestation, puis frais. */
export function buildInvoiceLines(
  timesheets: ReadonlyArray<Timesheet>,
  hourlyRate: number,
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const sorted = [...timesheets].sort((a, b) => a.date_arrival - b.date_arrival);

  // --- Prestations, regroupees par libelle (comme le gabarit) ---
  const parPrestation = new Map<string, Timesheet[]>();
  for (const ts of sorted) {
    const key = ts.description || 'Assistance à domicile';
    if (!parPrestation.has(key)) parPrestation.set(key, []);
    parPrestation.get(key)!.push(ts);
  }

  for (const [designation, lot] of parPrestation) {
    const heures = lot.reduce((s, ts) => s + ts.duration, 0);
    if (heures <= 0) continue;
    lines.push({
      designation,
      quantity: Math.round(heures * 100) / 100,
      unit_price: hourlyRate,
      detail: lot.map((ts) => {
        const d = new Date(ts.date_arrival);
        const jour = String(d.getDate()).padStart(2, '0');
        const mois = String(d.getMonth() + 1).padStart(2, '0');
        const h = Math.floor(ts.duration);
        const min = Math.round((ts.duration - h) * 60);
        return `${jour}/${mois}: ${h}h${String(min).padStart(2, '0')}`;
      }).join('\n'),
    });
  }

  // --- Indemnites kilometriques : UNE ligne, quantite 1, montant exact ---
  // Volontairement pas "nombre de trajets x prix moyen" : la moyenne introduirait
  // un ecart au centime entre le detail affiche et le total facture.
  const totalIK = Math.round(
    sorted.reduce((s, ts) => s + Math.max(0, ts.ik_amount || 0), 0) * 100,
  ) / 100;
  if (totalIK > 0) {
    const trajets = sorted.filter((ts) => Math.max(0, ts.ik_amount || 0) > 0).length;
    lines.push({
      designation: 'Indemnités Kilométriques',
      quantity: 1,
      unit_price: totalIK,
      detail: `${trajets} déplacement${trajets > 1 ? 's' : ''}`,
    });
  }

  // --- Frais annexes (repas, transport, autres) ---
  const totalFrais = Math.round(
    sorted.reduce(
      (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
      0,
    ) * 100,
  ) / 100;
  if (totalFrais > 0) {
    lines.push({
      designation: 'Frais annexes',
      quantity: 1,
      unit_price: totalFrais,
      detail: 'Repas, transport, autres',
    });
  }

  return lines;
}

/** Total d'une facture = somme de ses lignes. Seule definition admise. */
export function linesTotal(lines: ReadonlyArray<InvoiceLine>): number {
  return Math.round(
    lines.reduce((s, l) => s + Math.round(l.quantity * l.unit_price * 100) / 100, 0) * 100,
  ) / 100;
}
