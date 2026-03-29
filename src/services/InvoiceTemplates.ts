import { Invoice } from '../stores/invoiceStore.supabase';
import { Client } from '../stores/clientStore.supabase';
import { Timesheet } from '../stores/timesheetStore.supabase';
import { Mandataire } from '../stores/mandataireStore.supabase';

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
  mandataire?: Mandataire
): string => {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('fr-FR');

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const hourlyRate = client.hourly_rate;

  // Trier par date croissante
  const sorted = [...timesheets].sort((a, b) => a.date_arrival - b.date_arrival);

  const totalHours = sorted.reduce((sum, ts) => sum + ts.duration, 0);
  const totalSalaire = totalHours * hourlyRate;
  const totalRepas = sorted.reduce((sum, ts) => sum + (ts.frais_repas || 0), 0);
  const totalTransport = sorted.reduce((sum, ts) => sum + (ts.frais_transport || 0), 0);
  const totalAutres = sorted.reduce((sum, ts) => sum + (ts.frais_autres || 0), 0);
  const totalFrais = totalRepas + totalTransport + totalAutres;

  const periodLabel = invoice.month && invoice.year
    ? `${MOIS_FR[invoice.month - 1]} ${invoice.year}`
    : formatDate(invoice.created_at);

  const timesheetsHTML = sorted.map(ts => {
    const salaire = ts.duration * hourlyRate;
    const fraisJour = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
    return `
    <tr>
      <td style="padding: 7px 8px; border: 1px solid #ddd;">${formatDate(ts.date_arrival)}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: center;">${formatTime(ts.date_arrival)}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: center;">${formatTime(ts.date_departure)}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right;">${ts.duration.toFixed(2)}h</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right;">${salaire.toFixed(2)}€</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right;">${(ts.frais_repas || 0) > 0 ? (ts.frais_repas || 0).toFixed(2) + '€' : '-'}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right;">${(ts.frais_transport || 0) > 0 ? (ts.frais_transport || 0).toFixed(2) + '€' : '-'}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right;">${(ts.frais_autres || 0) > 0 ? (ts.frais_autres || 0).toFixed(2) + '€' : '-'}</td>
      <td style="padding: 7px 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${(salaire + fraisJour).toFixed(2)}€</td>
    </tr>
  `}).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 30px; }
    .header { border-bottom: 3px solid #34C759; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-left .badge { display: inline-block; background: #34C759; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-bottom: 6px; }
    .header-left h1 { font-size: 20px; color: #222; margin-bottom: 4px; }
    .header-left p { color: #666; font-size: 12px; }
    .header-right { text-align: right; font-size: 12px; color: #555; }
    .header-right strong { font-size: 13px; color: #34C759; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { padding: 12px; background: #f9f9f9; border-radius: 4px; border-left: 3px solid #34C759; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; color: #34C759; margin-bottom: 6px; letter-spacing: 0.5px; }
    .info-box p { font-size: 12px; margin-bottom: 2px; color: #444; }
    .section-title { background: #f0f0f0; padding: 7px 10px; font-weight: bold; font-size: 12px; margin-bottom: 0; border-left: 4px solid #34C759; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #34C759; color: white; padding: 8px 6px; text-align: left; font-size: 11px; }
    td { padding: 6px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .total-row td { background: #e8f8ed; font-weight: bold; border-top: 2px solid #34C759; padding: 8px 6px; }
    .recap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .recap-card { padding: 12px; border-radius: 6px; text-align: center; }
    .recap-card .label { font-size: 10px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px; }
    .recap-card .value { font-size: 18px; font-weight: bold; }
    .total-box { background: #34C759; color: white; padding: 16px 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .total-box .label { font-size: 13px; opacity: 0.9; }
    .total-box .amount { font-size: 24px; font-weight: bold; }
    .footer { border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; }
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
      <p><strong>${client.name}</strong></p>
      <p>${client.address}</p>
      ${mandataire ? `
        <p style="margin-top:6px;"><strong>Mandataire :</strong></p>
        <p>${mandataire.titre ? mandataire.titre + ' ' : ''}${mandataire.name}</p>
        <p style="font-size:11px;color:#666;">${mandataire.association_name}</p>
        <p style="font-size:11px;color:#666;">${mandataire.email}</p>
        ${mandataire.siren ? `<p style="font-size:11px;color:#999;">SIREN: ${mandataire.siren}</p>` : ''}
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
        <td style="text-align:right;">${totalRepas > 0 ? totalRepas.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${totalTransport > 0 ? totalTransport.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${totalAutres > 0 ? totalAutres.toFixed(2) + '€' : '-'}</td>
        <td style="text-align:right;">${invoice.total_amount.toFixed(2)}€</td>
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
    <span class="amount">${invoice.total_amount.toFixed(2)} €</span>
  </div>

  <div class="footer">
    <p>TVA non applicable, art. 293 B du CGI &nbsp;|&nbsp; Paiement via CESU (Chèque Emploi Service Universel)</p>
    ${user.iban ? `<p style="margin-top:4px;">IBAN : ${user.iban}${user.bic ? ' &nbsp;|&nbsp; BIC : ' + user.bic : ''}</p>` : ''}
  </div>

</body>
</html>`;
};

export const generateClassicalTemplate = (
  invoice: Invoice,
  client: Client,
  timesheets: Timesheet[],
  user: User,
  mandataire?: Mandataire
): string => {
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('fr-FR');

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const hourlyRate = client.hourly_rate;
  const totalHours = timesheets.reduce((sum, ts) => sum + ts.duration, 0);
  const totalFrais = timesheets.reduce(
    (sum, ts) => sum + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
    0
  );

  const timesheetsHTML = timesheets.map(ts => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_departure)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${ts.duration.toFixed(2)}h</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${hourlyRate.toFixed(2)}€</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(ts.duration * hourlyRate).toFixed(2)}€</td>
    </tr>
  `).join('');

  const fraisHTML = timesheets.filter(ts =>
    (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) > 0
  ).map(ts => {
    const items = [];
    if (ts.frais_repas) items.push(`Repas: ${ts.frais_repas.toFixed(2)}€`);
    if (ts.frais_transport) items.push(`Transport: ${ts.frais_transport.toFixed(2)}€`);
    if (ts.frais_autres) items.push(`Autres: ${ts.frais_autres.toFixed(2)}€`);
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(ts.date_arrival)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${items.join(', ')}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${((ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0)).toFixed(2)}€</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #007AFF;
          padding-bottom: 20px;
        }
        .badge {
          display: inline-block;
          background-color: #007AFF;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          background-color: #f5f5f5;
          padding: 10px;
          font-weight: bold;
          margin-bottom: 10px;
          border-left: 4px solid #007AFF;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 25px;
        }
        .info-box {
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .info-box h3 {
          margin-top: 0;
          color: #007AFF;
          font-size: 14px;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #007AFF;
          color: white;
          padding: 10px;
          text-align: left;
        }
        .total-row {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="badge">FACTURE CLASSIQUE</div>
          <h1 style="margin: 10px 0;">Facture N° ${invoice.invoice_number}</h1>
          <p style="margin: 5px 0;">Date: ${formatDate(invoice.created_at)}</p>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Prestataire</h3>
          <p><strong>${user.businessName || user.displayName}</strong></p>
          <p>${user.businessAddress || user.address || ''}</p>
          ${user.siren ? `<p><strong>SIREN:</strong> ${user.siren}</p>` : ''}
          ${user.siret ? `<p><strong>SIRET:</strong> ${user.siret}</p>` : ''}
          <p>${user.phone || ''}</p>
          <p>${user.email}</p>
        </div>
        <div class="info-box">
          <h3>Client</h3>
          <p><strong>${client.name}</strong></p>
          <p>${client.address}</p>
          ${client.email ? `<p>${client.email}</p>` : ''}
          ${mandataire ? `
            <p style="margin-top: 10px;"><strong>Mandataire :</strong></p>
            <p>${mandataire.titre ? mandataire.titre + ' ' : ''}${mandataire.name}</p>
            <p style="color:#666;">${mandataire.association_name}</p>
            <p>${mandataire.email}</p>
            ${mandataire.siren ? `<p><strong>SIREN:</strong> ${mandataire.siren}</p>` : ''}
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Détail des prestations</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Arrivée</th>
              <th>Départ</th>
              <th style="text-align: right;">Heures</th>
              <th style="text-align: right;">Taux horaire</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${timesheetsHTML}
            <tr class="total-row">
              <td colspan="3" style="padding: 12px; border: 1px solid #ddd;">TOTAL HEURES</td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${totalHours.toFixed(2)}h</td>
              <td style="padding: 12px; border: 1px solid #ddd;"></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${(totalHours * hourlyRate).toFixed(2)}€</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${totalFrais > 0 ? `
        <div class="section">
          <div class="section-title">Frais annexes</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style="text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${fraisHTML}
              <tr class="total-row">
                <td colspan="2" style="padding: 12px; border: 1px solid #ddd;">TOTAL FRAIS</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${totalFrais.toFixed(2)}€</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}

      <div style="text-align: right; margin-top: 30px; padding: 20px; background-color: #007AFF; color: white; border-radius: 4px;">
        <h2 style="margin: 0;">MONTANT TOTAL: ${invoice.total_amount.toFixed(2)}€</h2>
      </div>

      <div class="footer">
        <p><strong>Mentions légales:</strong></p>
        <p>TVA non applicable, art. 293 B du CGI</p>
        ${user.iban ? `<p><strong>IBAN:</strong> ${user.iban}</p>` : ''}
        ${user.bic ? `<p><strong>BIC:</strong> ${user.bic}</p>` : ''}
        <p style="margin-top: 15px;">Paiement à réception de facture</p>
      </div>
    </body>
    </html>
  `;
};
