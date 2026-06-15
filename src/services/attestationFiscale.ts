import type { User } from '../stores/authStore';
import type { Client } from '../stores/clientStore.supabase';
import type { Timesheet } from '../stores/timesheetStore.supabase';
import type { Invoice } from '../stores/invoiceStore.supabase';

/**
 * Attestation fiscale annuelle SAP (S8) — contenu défini par l'art. D7233-4 du Code du travail.
 * À transmettre à chaque client particulier avant le 31 mars N+1 (crédit d'impôt, art. 199 sexdecies CGI).
 *
 * Périmètre : clients PRESTATAIRE facturés (B2C). Les clients CESU (pointage, emploi direct)
 * sont gérés par l'URSSAF/CESU → hors de cette attestation.
 *
 * ⚠️ Limites connues (à lever) :
 *  - Le **n° de déclaration SAP** (D7233-4 §2°) n'existe pas encore au profil → passé en paramètre.
 *  - Le **mode de paiement** (CESU préfinancé vs personnel) n'est pas tracké → la déduction de la
 *    part personnellement financée n'est pas calculable ; on porte la **mention** réglementaire
 *    et `montantAcquitte` = somme des factures payées (à affiner si le mode de paiement est ajouté).
 */
export interface AttestationIntervention {
  date: number; // timestamp ms
  durationHours: number;
}

export interface AttestationData {
  year: number;
  org: { name: string; address: string; siren?: string; siret?: string };
  sapDeclarationNumber?: string; // D7233-4 §2°
  sapDeclarationDate?: string;
  beneficiary: { name: string; address: string };
  montantAcquitte: number; // D7233-4 §3° — somme des factures PAYÉES de l'année
  interventions: AttestationIntervention[]; // D7233-4 §4°
  totalHours: number;
  intervenant: string;
}

export interface BuildAttestationParams {
  user: Pick<User, 'display_name' | 'business_name' | 'business_address' | 'address' | 'siren' | 'siret'>;
  client: Pick<Client, 'titre' | 'first_name' | 'name' | 'address'>;
  clientId: string;
  year: number;
  timesheets: ReadonlyArray<Pick<Timesheet, 'client_id' | 'date_arrival' | 'duration'>>;
  invoices: ReadonlyArray<Pick<Invoice, 'client_id' | 'year' | 'status' | 'total_amount'>>;
  sapDeclarationNumber?: string;
  sapDeclarationDate?: string;
}

export function buildAttestationData(p: BuildAttestationParams): AttestationData {
  const interventions = p.timesheets
    .filter((t) => t.client_id === p.clientId && new Date(t.date_arrival).getFullYear() === p.year)
    .map((t) => ({ date: t.date_arrival, durationHours: t.duration }))
    .sort((a, b) => a.date - b.date);

  const totalHours = interventions.reduce((s, i) => s + i.durationHours, 0);

  const montantAcquitte = p.invoices
    .filter((i) => i.client_id === p.clientId && i.year === p.year && i.status === 'paid')
    .reduce((s, i) => s + i.total_amount, 0);

  const beneficiaryName = [p.client.titre, p.client.first_name, p.client.name].filter(Boolean).join(' ');

  return {
    year: p.year,
    org: {
      name: p.user.business_name || p.user.display_name,
      address: p.user.business_address || p.user.address || '',
      siren: p.user.siren,
      siret: p.user.siret,
    },
    sapDeclarationNumber: p.sapDeclarationNumber,
    sapDeclarationDate: p.sapDeclarationDate,
    beneficiary: { name: beneficiaryName, address: p.client.address },
    montantAcquitte,
    interventions,
    totalHours,
    intervenant: p.user.business_name || p.user.display_name,
  };
}

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR');
const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/** Rend l'attestation en HTML (pour PDF). Mentions conformes art. D7233-4. */
export function generateAttestationHtml(d: AttestationData): string {
  const rows = d.interventions
    .map((i) => `<tr><td>${fmtDate(i.date)}</td><td style="text-align:right">${i.durationHours.toLocaleString('fr-FR')} h</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;color:#000;font-size:13px;padding:24px;}
  h1{font-size:18px;} h2{font-size:14px;margin-top:18px;}
  table{width:100%;border-collapse:collapse;margin-top:6px;}
  td,th{border:1px solid #999;padding:4px 8px;}
  .muted{color:#555;font-size:11px;}
</style></head><body>
  <h1>Attestation fiscale annuelle ${d.year}</h1>
  <p class="muted">Délivrée en application de l'article D.7233-4 du Code du travail, pour bénéficier du crédit d'impôt (art. 199 sexdecies du CGI).</p>

  <h2>Organisme prestataire</h2>
  <p>${d.org.name}<br/>${d.org.address}
  ${d.org.siren ? `<br/>SIREN : ${d.org.siren}` : ''}${d.org.siret ? ` — SIRET : ${d.org.siret}` : ''}</p>
  <p>Déclaration services à la personne n° ${d.sapDeclarationNumber || '«&nbsp;à compléter&nbsp;»'}${d.sapDeclarationDate ? ` du ${d.sapDeclarationDate}` : ''}</p>

  <h2>Bénéficiaire</h2>
  <p>${d.beneficiary.name}<br/>${d.beneficiary.address}</p>

  <h2>Montant effectivement acquitté en ${d.year}</h2>
  <p style="font-size:16px"><strong>${fmtEur(d.montantAcquitte)}</strong></p>

  <h2>Récapitulatif des interventions (intervenant : ${d.intervenant})</h2>
  <table><thead><tr><th>Date</th><th style="text-align:right">Durée</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="2">Aucune intervention</td></tr>'}</tbody>
  <tfoot><tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${d.totalHours.toLocaleString('fr-FR')} h</strong></td></tr></tfoot>
  </table>

  <p class="muted" style="margin-top:18px">En cas de paiement en CESU préfinancé, seul le montant que vous avez personnellement financé ouvre droit à l'avantage fiscal&nbsp;; il vous appartient de l'identifier lors de votre déclaration de revenus. Attestation à conserver (justificatif en cas de contrôle).</p>
</body></html>`;
}
