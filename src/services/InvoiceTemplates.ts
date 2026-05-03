import { Invoice } from '../stores/invoiceStore.supabase';
import { Client, ClientContact } from '../stores/clientStore.supabase';
import { Timesheet } from '../stores/timesheetStore.supabase';
import { Mandataire } from '../stores/mandataireStore.supabase';
import { isDureeDirecte } from '../utils/timesheetMode';

interface User {
  displayName: string;
  email: string;
  address?: string;
  phone?: string;
  cesuNumber?: string;
  siren?: string;
  siret?: string;
  businessName?: string;
  businessAddress?: string;
  iban?: string;
  bic?: string;
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const generateCESUTemplate = (
  invoice: Invoice & { month?: number; year?: number },
  client: Client,
  timesheets: Timesheet[],
  user: User,
  mandataire?: Mandataire,
  contacts?: ClientContact[]
): string => {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('fr-FR');

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const hourlyRate = client.hourly_rate;

  // Trier par date croissante
  const sorted = [...timesheets].sort((a, b) => a.date_arrival - b.date_arrival);

  const totalHours = sorted.reduce((sum, ts) => sum + ts.duration, 0);
  const totalSalaire = sorted.reduce((sum, ts) => sum + Math.round(ts.duration * hourlyRate * 100) / 100, 0);
  const totalRepas = sorted.reduce((sum, ts) => sum + (ts.frais_repas || 0), 0);
  const totalTransport = sorted.reduce((sum, ts) => sum + (ts.frais_transport || 0), 0);
  const totalAutres = sorted.reduce((sum, ts) => sum + (ts.frais_autres || 0), 0);
  const totalIK = sorted.reduce((sum, ts) => sum + (Math.max(0, ts.ik_amount || 0)), 0);
  const totalFrais = totalRepas + totalTransport + totalAutres + totalIK;

  const periodLabel = invoice.month && invoice.year
    ? `${MOIS_FR[invoice.month - 1]} ${invoice.year}`
    : formatDate(invoice.created_at);

  const tdBase = 'padding: 7px 8px; border: 1px solid #ddd; color: #000;';
  const timesheetsHTML = sorted.map(ts => {
    const salaire = Math.round(ts.duration * hourlyRate * 100) / 100;
    const ikJour = ts.ik_amount || 0;
    const fraisJour = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + ikJour;
    const isDuree = isDureeDirecte(ts);
    return `
    <tr>
      <td style="${tdBase}">${formatDate(ts.date_arrival)}</td>
      <td style="${tdBase} text-align: center;">${isDuree ? '—' : formatTime(ts.date_arrival)}</td>
      <td style="${tdBase} text-align: center;">${isDuree ? '—' : formatTime(ts.date_departure)}</td>
      <td style="${tdBase} text-align: right;">${ts.duration.toFixed(2)}h</td>
      <td style="${tdBase} text-align: right;">${salaire.toFixed(2)}€</td>
      <td style="${tdBase} text-align: right;">${ikJour > 0 ? ikJour.toFixed(2) + '€' : '-'}</td>
      <td style="${tdBase} text-align: right;">${(ts.frais_repas || 0) > 0 ? (ts.frais_repas || 0).toFixed(2) + '€' : '-'}</td>
      <td style="${tdBase} text-align: right;">${(ts.frais_transport || 0) > 0 ? (ts.frais_transport || 0).toFixed(2) + '€' : '-'}</td>
      <td style="${tdBase} text-align: right;">${(ts.frais_autres || 0) > 0 ? (ts.frais_autres || 0).toFixed(2) + '€' : '-'}</td>
      <td style="${tdBase} text-align: right; font-weight: bold;">${(salaire + fraisJour).toFixed(2)}€</td>
    </tr>
  `}).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 30px; }
    p, span, td, div { color: #000; }
    .header { border-bottom: 3px solid #34C759; padding-bottom: 16px; margin-bottom: 20px; overflow: hidden; }
    .header-left { float: left; width: 65%; }
    .header-left .badge { display: inline-block; background: #34C759; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-bottom: 6px; }
    .header-left h1 { font-size: 20px; color: #222; margin-bottom: 4px; }
    .header-left p { color: #666; font-size: 12px; }
    .header-right { float: right; text-align: right; width: 30%; font-size: 12px; color: #555; }
    .header-right strong { font-size: 13px; color: #34C759; }
    .info-grid { overflow: hidden; margin-bottom: 20px; }
    .info-box { width: 48%; float: left; margin-right: 2%; padding: 12px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #34C759; }
    .info-box:last-child { margin-right: 0; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; color: #34C759; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-box p { font-size: 12px; margin-bottom: 2px; color: #000; }
    .section-title { background: #f0f0f0; padding: 7px 10px; font-weight: bold; font-size: 12px; margin-bottom: 0; border-left: 4px solid #34C759; clear: both; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #34C759; color: white; padding: 8px 6px; text-align: left; font-size: 11px; }
    td { padding: 6px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .total-row td { background: #e8f8ed; font-weight: bold; border-top: 2px solid #34C759; padding: 8px 6px; }
    .recap { overflow: hidden; margin: 20px 0; }
    .recap-card { width: 23%; float: left; margin-right: 2%; padding: 12px; border-radius: 6px; text-align: center; }
    .recap-card:last-child { margin-right: 0; }
    .recap-card .label { font-size: 10px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px; }
    .recap-card .value { font-size: 18px; font-weight: bold; }
    .total-box { background: #34C759; color: white; padding: 16px 20px; border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
    .total-box .label { float: left; font-size: 13px; opacity: 0.9; line-height: 30px; }
    .total-box .amount { float: right; font-size: 24px; font-weight: bold; }
    .footer { border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; clear: both; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <div class="badge">POINTAGE CESU</div>
      <h1>Relevé mensuel — ${periodLabel}</h1>
      <p>Réf. : ${invoice.invoice_number} &nbsp;|&nbsp; Édité le ${formatDate(invoice.created_at)}</p>
    </div>
    <div class="header-right">
      <p>N° CESU Prestataire</p>
      <strong>${user.cesuNumber || 'N/A'}</strong>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Prestataire (Assistante)</h3>
      <p><strong>${user.displayName}</strong></p>
      ${user.address ? `<p>${user.address}</p>` : ''}
      ${user.phone ? `<p>${user.phone}</p>` : ''}
      <p>${user.email}</p>
    </div>
    <div class="info-box">
      <h3>Client (Employeur)</h3>
      <p><strong>${[client.titre, client.first_name, client.name].filter(Boolean).join(' ')}</strong></p>
      <p>${client.address}</p>
      ${mandataire ? `
        <p style="margin-top:6px;"><strong>Mandataire :</strong></p>
        <p>${[mandataire.titre, mandataire.first_name, mandataire.name].filter(Boolean).join(' ')}</p>
        <p style="font-size:11px;color:#000;">${mandataire.association_name}</p>
        <p style="font-size:11px;color:#000;">${mandataire.email}</p>
        ${mandataire.siren ? `<p style="font-size:11px;color:#000;">SIREN: ${mandataire.siren}</p>` : ''}
      ` : ''}
      ${contacts && contacts.length > 0 ? `
        <p style="margin-top:6px;"><strong>Copie à :</strong></p>
        ${contacts.map(c => `<p style="font-size:11px;color:#000;">${c.label} — ${c.email}</p>`).join('')}
      ` : ''}
    </div>
  </div>

  <div class="section-title">Détail des interventions — ${sorted.length} jour${sorted.length > 1 ? 's' : ''} travaillé${sorted.length > 1 ? 's' : ''}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th style="text-align:center;">Arrivée</th>
        <th style="text-align:center;">Départ</th>
        <th style="text-align:right;">Heures</th>
        <th style="text-align:right;">Salaire</th>
        <th style="text-align:right;">IK</th>
        <th style="text-align:right;">Repas</th>
        <th style="text-align:right;">Transport</th>
        <th style="text-align:right;">Autres</th>
        <th style="text-align:right;">Total jour</th>
      </tr>
    </thead>
    <tbody>
      ${timesheetsHTML}
      <tr class="total-row">
        <td colspan="3">TOTAUX DU MOIS</td>
        <td style="text-align:right;">${totalHours.toFixed(2)}h</td>
        <td style="text-align:right;">${totalSalaire.toFixed(2)}€</td>
        <td style="text-align:right;">${totalIK > 0 ? totalIK.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${totalRepas > 0 ? totalRepas.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${totalTransport > 0 ? totalTransport.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${totalAutres > 0 ? totalAutres.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${(Math.round((totalSalaire + totalFrais) * 100) / 100).toFixed(2)}€</td>
      </tr>
    </tbody>
  </table>

  <div class="recap">
    <div class="recap-card" style="background:#EBF9F0; color:#2d8a4e;">
      <div class="label">Heures</div>
      <div class="value">${totalHours.toFixed(1)}h</div>
    </div>
    <div class="recap-card" style="background:#E8F4FF; color:#1a6fb5;">
      <div class="label">Taux horaire</div>
      <div class="value">${hourlyRate.toFixed(2)}€</div>
    </div>
    <div class="recap-card" style="background:#FFF4E5; color:#b36b00;">
      <div class="label">Frais annexes</div>
      <div class="value">${totalFrais.toFixed(2)}€</div>
    </div>
    <div class="recap-card" style="background:#F0EBFF; color:#5b3db5;">
      <div class="label">Salaire net</div>
      <div class="value">${totalSalaire.toFixed(2)}€</div>
    </div>
  </div>

  <div class="total-box">
    <span class="label">MONTANT TOTAL À PERCEVOIR — ${periodLabel}</span>
    <span class="amount">${(Math.round((totalSalaire + totalFrais) * 100) / 100).toFixed(2)} €</span>
  </div>

  <div class="footer">
    <p>Paiement via CESU (Chèque Emploi Service Universel) &amp; CESU+</p>
    ${user.iban ? `<p style="margin-top:4px;">IBAN : ${user.iban}${user.bic ? ' &nbsp;|&nbsp; BIC : ' + user.bic : ''}</p>` : ''}
    <p style="margin-top:12px; text-align:center; color:#666; font-size:9px; font-style:italic;">Généré par DomiTemps — Au service de celles et ceux qui prennent soin des autres</p>
  </div>

</body>
</html>`;
};

export const generateClassicalTemplate = (
  invoice: Invoice,
  client: Client,
  timesheets: Timesheet[],
  user: User,
  mandataire?: Mandataire,
  contacts?: ClientContact[]
): string => {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('fr-FR');

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const hourlyRate = client.hourly_rate;
  const totalHours = timesheets.reduce((sum, ts) => sum + ts.duration, 0);
  const totalFrais = Math.round(timesheets.reduce(
    (sum, ts) => sum + Math.round(((ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0))) * 100) / 100,
    0
  ) * 100) / 100;

  // Grouper les timesheets par description de prestation
  const sorted = [...timesheets].sort((a, b) => a.date_arrival - b.date_arrival);
  const prestationMap = new Map<string, typeof sorted>();
  sorted.forEach((ts) => {
    const key = ts.description || 'Assistance à domicile';
    if (!prestationMap.has(key)) prestationMap.set(key, []);
    prestationMap.get(key)!.push(ts);
  });

  // Total IK
  const totalIK = timesheets.reduce((s, ts) => s + (Math.max(0, ts.ik_amount || 0)), 0);
  const totalIKcount = timesheets.filter((ts) => (Math.max(0, ts.ik_amount || 0)) > 0).length;

  const td = 'padding: 10px 12px; border-bottom: 1px solid #eee; color: #000; vertical-align: top;';

  // Lignes de prestations groupées
  const detailHTML = Array.from(prestationMap.entries()).map(([desc, tsList]) => {
    const totalH = tsList.reduce((s, ts) => s + ts.duration, 0);
    const datesDetail = tsList.map((ts) => {
      const d = new Date(ts.date_arrival);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const hh = Math.floor(ts.duration);
      const mm2 = Math.round((ts.duration - hh) * 60);
      return `${dd}/${mm}: ${hh}h${mm2 > 0 ? String(mm2).padStart(2, '0') : '00'}`;
    }).join('<br/>');
    return `
      <tr>
        <td style="${td}">Service</td>
        <td style="${td}"><strong>${desc}</strong><br/><span style="font-size:11px;color:#555;">${datesDetail}</span></td>
        <td style="${td} text-align: right;">${hourlyRate.toFixed(2)} €</td>
        <td style="${td} text-align: center;">${totalH % 1 === 0 ? totalH.toFixed(0) : totalH.toFixed(1)}</td>
        <td style="${td} text-align: right; font-weight: bold;">${tsList.reduce((s, ts) => s + Math.round(ts.duration * hourlyRate * 100) / 100, 0).toFixed(2)} €</td>
      </tr>`;
  }).join('');

  // Ligne IK si présent
  const ikHTML = totalIK > 0 ? `
    <tr>
      <td style="${td}">Service</td>
      <td style="${td}"><strong>Indemnités Kilométriques</strong></td>
      <td style="${td} text-align: right;">${(totalIK / (totalIKcount || 1)).toFixed(2)} €</td>
      <td style="${td} text-align: center;">${totalIKcount}</td>
      <td style="${td} text-align: right; font-weight: bold;">${totalIK.toFixed(2)} €</td>
    </tr>` : '';

  // Ligne autres frais (repas, transport, autres) regroupés
  const totalOtherFrais = Math.round(timesheets.reduce(
    (s, ts) => s + Math.round(((ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0)) * 100) / 100, 0
  ) * 100) / 100;
  const otherFraisHTML = totalOtherFrais > 0 ? `
    <tr>
      <td style="${td}">Frais</td>
      <td style="${td}"><strong>Frais annexes</strong><br/><span style="font-size:11px;color:#555;">Repas, transport, autres</span></td>
      <td style="${td} text-align: right;"></td>
      <td style="${td} text-align: center;"></td>
      <td style="${td} text-align: right; font-weight: bold;">${totalOtherFrais.toFixed(2)} €</td>
    </tr>` : '';

  const clientFullName = [client.titre, client.first_name, client.name].filter(Boolean).join(' ');
  const mandataireFullName = mandataire ? [mandataire.titre, mandataire.first_name, mandataire.name].filter(Boolean).join(' ') : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; padding: 40px; }
    p { margin: 0 0 3px; color: #000; }
    h1 { font-size: 26px; color: #333; margin-bottom: 4px; }
    h2 { font-size: 18px; color: #333; margin-bottom: 14px; }
    .header { margin-bottom: 30px; }
    .header .date { color: #666; font-size: 14px; }
    .cols { overflow: hidden; margin-bottom: 28px; }
    .col-left { float: left; width: 55%; }
    .col-right { float: right; width: 40%; }
    .col-right h2 { margin-bottom: 8px; }
    .info-table { width: 100%; font-size: 12px; }
    .info-table td { padding: 3px 8px; vertical-align: top; color: #000; }
    .info-table .label { color: #888; font-size: 11px; width: 120px; }
    .mandataire-box { margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; color: #000; }
    .mandataire-box strong, .mandataire-box span, .mandataire-box br + * { color: #000; }
    table.detail { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.detail th { background: #f5f5f5; color: #555; font-weight: 600; padding: 10px 12px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
    .total-line { overflow: hidden; margin-top: 6px; margin-bottom: 20px; }
    .total-tva { float: left; font-size: 11px; color: #888; line-height: 30px; }
    .total-amount { float: right; }
    .total-amount .label { font-size: 13px; color: #555; font-weight: bold; }
    .total-amount .value { font-size: 22px; font-weight: bold; color: #000; margin-left: 12px; }
    .conditions { margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; }
    .conditions h2 { font-size: 16px; margin-bottom: 10px; }
    .conditions p { font-size: 12px; margin-bottom: 4px; }
    .conditions .notes { margin-top: 8px; color: #555; }
    .domitemps { margin-top: 20px; text-align: center; color: #666; font-size: 9px; font-style: italic; }
  </style>
</head>
<body>

  <div class="header">
    <h1>Facture ${invoice.invoice_number}</h1>
    <p class="date">${formatDate(invoice.created_at)}</p>
  </div>

  <div class="cols">
    <div class="col-left">
      <h2>Émetteur</h2>
      <table class="info-table">
        ${user.businessName ? `<tr><td class="label">Société :</td><td><strong>${user.businessName}</strong></td></tr>` : ''}
        <tr><td class="label">Votre contact :</td><td><strong>${user.displayName}</strong></td></tr>
        <tr><td class="label">Adresse :</td><td>${user.address || ''}</td></tr>
        ${user.siret ? `<tr><td class="label">N° entreprise :</td><td>${user.siret}</td></tr>` : ''}
        ${user.siren ? `<tr><td class="label">SIREN :</td><td>${user.siren}</td></tr>` : ''}
        ${user.phone ? `<tr><td class="label">Téléphone :</td><td>${user.phone}</td></tr>` : ''}
        <tr><td class="label">Email :</td><td>${user.email}</td></tr>
      </table>
      ${mandataire ? `
        <div class="mandataire-box">
          <span style="color:#000;font-weight:bold;">${mandataire.association_name}</span><br/>
          ${mandataireFullName ? `<span style="color:#000;">${mandataireFullName}</span><br/>` : ''}
          ${mandataire.email ? `<span style="color:#000;">${mandataire.email}</span>` : ''}
        </div>
      ` : ''}
    </div>
    <div class="col-right">
      <h2>Destinataire</h2>
      <p><strong>${clientFullName}</strong></p>
      <p>${client.address}</p>
      ${client.email ? `<p>${client.email}</p>` : ''}
      ${contacts && contacts.length > 0 ? `
        <p style="margin-top:8px;"><strong>Copie à :</strong></p>
        ${contacts.map(c => `<p>${c.label} — ${c.email}</p>`).join('')}
      ` : ''}
    </div>
  </div>

  <h2>Détail</h2>
  <table class="detail">
    <thead>
      <tr>
        <th style="width:70px;">Type</th>
        <th>Description</th>
        <th style="text-align:right; width:100px;">Prix unitaire HT</th>
        <th style="text-align:center; width:70px;">Quantité</th>
        <th style="text-align:right; width:90px;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${detailHTML}
      ${ikHTML}
      ${otherFraisHTML}
    </tbody>
  </table>

  <div class="total-line">
    <div class="total-tva">TVA non applicable, art. 293 B du CGI</div>
    <div class="total-amount">
      <span class="label">Total</span>
      <span class="value">${(Math.round((timesheets.reduce((s, ts) => s + Math.round(ts.duration * hourlyRate * 100) / 100, 0) + totalFrais) * 100) / 100).toFixed(2)} €</span>
    </div>
  </div>

  <div class="conditions">
    <h2>Conditions</h2>
    <p><strong>Conditions de règlement :</strong> À réception</p>
    <p><strong>Mode de règlement :</strong> Virement bancaire</p>
    <p class="notes">En votre aimable règlement par virement :</p>
    ${user.iban ? `<p class="notes">IBAN : ${user.iban}</p>` : ''}
    ${user.bic ? `<p class="notes">BIC : ${user.bic}</p>` : ''}
  </div>

  <p class="domitemps">Généré par DomiTemps — Au service de celles et ceux qui prennent soin des autres</p>

</body>
</html>`;
};

interface RecapRow {
  clientName: string;
  facturationMode: 'CESU' | 'CLASSICAL';
  timesheetCount: number;
  totalHours: number;
  totalEarnings: number;
  totalFrais: number;
  totalAmount: number;
}

interface RecapGroup {
  mandataire?: { titre?: string; first_name?: string; name: string; association_name: string };
  clients: RecapRow[];
}

export const generateRecapTemplate = (params: {
  month: number;
  year: number;
  groups: RecapGroup[];
  totals: { hours: number; earnings: number; frais: number; amount: number; clientCount: number };
  user: User;
}): string => {
  const { month, year, groups, totals, user } = params;
  const monthLabel = `${MOIS_FR[month - 1]} ${year}`;

  const tdBase = 'padding: 8px 10px; border-bottom: 1px solid #eee; color: #000;';
  const groupsHTML = groups.map((group) => {
    const activeRows = group.clients.filter((r) => r.timesheetCount > 0);
    if (activeRows.length === 0) return '';
    const mandataireRow = group.mandataire ? `
      <tr style="background:#F0EBFF;">
        <td colspan="6" style="padding:6px 10px; font-weight:bold; color:#5b3db5; font-size:11px;">
          ${[group.mandataire.titre, group.mandataire.first_name, group.mandataire.name].filter(Boolean).join(' ')} — ${group.mandataire.association_name}
        </td>
      </tr>
    ` : '';
    const rowsHTML = activeRows.map((row) => `
      <tr>
        <td style="${tdBase}">${row.clientName}</td>
        <td style="${tdBase} text-align:center;">${row.facturationMode === 'CESU' ? 'CESU' : 'CLASS.'}</td>
        <td style="${tdBase} text-align:right;">${row.totalHours.toFixed(2)}h</td>
        <td style="${tdBase} text-align:right;">${row.totalEarnings.toFixed(2)}€</td>
        <td style="${tdBase} text-align:right;">${row.totalFrais > 0 ? row.totalFrais.toFixed(2) + '€' : '-'}</td>
        <td style="${tdBase} text-align:right; font-weight:bold;">${row.totalAmount.toFixed(2)}€</td>
      </tr>
    `).join('');
    return mandataireRow + rowsHTML;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 30px; }
    p, span, td, div { color: #000; }
    .header { border-bottom: 3px solid #5b3db5; padding-bottom: 16px; margin-bottom: 20px; overflow: hidden; }
    .header-left { float: left; width: 65%; }
    .header-left .badge { display: inline-block; background: #5b3db5; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-bottom: 6px; }
    .header-left h1 { font-size: 22px; color: #222; margin-bottom: 4px; }
    .header-left p { color: #666; font-size: 12px; }
    .header-right { float: right; text-align: right; width: 30%; font-size: 12px; color: #555; }
    .info-box { padding: 12px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #5b3db5; margin-bottom: 20px; clear: both; }
    .info-box p { font-size: 12px; margin-bottom: 2px; color: #000; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #5b3db5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    .totals { background: #5b3db5; color: white; font-weight: bold; }
    .totals td { padding: 12px 10px; color: white; }
    .recap { overflow: hidden; margin: 20px 0; }
    .recap-card { width: 23%; float: left; margin-right: 2%; padding: 12px; border-radius: 6px; text-align: center; }
    .recap-card:last-child { margin-right: 0; }
    .recap-card .label { font-size: 10px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px; }
    .recap-card .value { font-size: 18px; font-weight: bold; }
    .footer { border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; clear: both; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="badge">RECAP MENSUEL</div>
      <h1>${monthLabel}</h1>
      <p>Édité le ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
    <div class="header-right">
      <p style="font-weight:bold; font-size:13px; color:#5b3db5;">${user.displayName}</p>
      ${user.cesuNumber ? `<p>N° CESU : ${user.cesuNumber}</p>` : ''}
      ${user.siren ? `<p>SIREN : ${user.siren}</p>` : ''}
    </div>
  </div>

  <div class="info-box">
    <p><strong>Synthèse de l'activité — ${totals.clientCount} client${totals.clientCount > 1 ? 's' : ''} · ${totals.hours.toFixed(2)}h travaillées</strong></p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th style="text-align:center;">Mode</th>
        <th style="text-align:right;">Heures</th>
        <th style="text-align:right;">Salaire</th>
        <th style="text-align:right;">Frais</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${groupsHTML}
      <tr class="totals">
        <td colspan="2">TOTAUX MOIS</td>
        <td style="text-align:right;">${totals.hours.toFixed(2)}h</td>
        <td style="text-align:right;">${totals.earnings.toFixed(2)}€</td>
        <td style="text-align:right;">${totals.frais.toFixed(2)}€</td>
        <td style="text-align:right; font-size:13px;">${totals.amount.toFixed(2)}€</td>
      </tr>
    </tbody>
  </table>

  <div class="recap">
    <div class="recap-card" style="background:#EBF9F0; color:#2d8a4e;">
      <div class="label">Heures</div>
      <div class="value">${totals.hours.toFixed(1)}h</div>
    </div>
    <div class="recap-card" style="background:#E8F4FF; color:#1a6fb5;">
      <div class="label">Clients</div>
      <div class="value">${totals.clientCount}</div>
    </div>
    <div class="recap-card" style="background:#FFF4E5; color:#b36b00;">
      <div class="label">Frais</div>
      <div class="value">${totals.frais.toFixed(0)}€</div>
    </div>
    <div class="recap-card" style="background:#F0EBFF; color:#5b3db5;">
      <div class="label">Total</div>
      <div class="value">${totals.amount.toFixed(0)}€</div>
    </div>
  </div>

  <div class="footer">
    <p>Document interne — non destiné à un client. Récapitulatif mensuel pour comptabilité personnelle et déclaration NOVA.</p>
    <p style="margin-top:8px; text-align:center; font-style:italic;">Généré par DomiTemps</p>
  </div>
</body>
</html>`;
};
