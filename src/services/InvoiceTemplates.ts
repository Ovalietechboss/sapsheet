import { Invoice } from '../stores/invoiceStore.supabase';
import { Client } from '../stores/clientStore.supabase';
import { Timesheet } from '../stores/timesheetStore.supabase';

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

export const generateCESUTemplate = (
  invoice: Invoice,
  client: Client,
  timesheets: Timesheet[],
  user: User
): string => {
  const formatDate = (timestamp: number) => 
    new Date(timestamp).toLocaleDateString('fr-FR');
  
  const formatTime = (timestamp: number) => 
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const timesheetsHTML = timesheets.map(ts => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_departure)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${ts.duration.toFixed(2)}h</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${invoice.hourlyRate.toFixed(2)}€</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(ts.duration * invoice.hourlyRate).toFixed(2)}€</td>
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
          border-bottom: 3px solid #34C759;
          padding-bottom: 20px;
        }
        .badge {
          display: inline-block;
          background-color: #34C759;
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
          border-left: 4px solid #34C759;
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
          color: #34C759;
          font-size: 14px;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #34C759;
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
        <div class="badge">POINTAGE CESU</div>
          <h1 style="margin: 10px 0;">Pointage N° ${invoice.invoice_number}</h1>
          <p style="margin: 5px 0;">Date: ${formatDate(invoice.created_at)}</p>
        <p style="margin: 5px 0; font-weight: bold;">CESU N°: ${user.cesuNumber || 'N/A'}</p>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Prestataire (Assistante)</h3>
          <p><strong>${user.displayName}</strong></p>
          <p>${user.address || ''}</p>
          <p>${user.phone || ''}</p>
          <p>${user.email}</p>
        </div>
        <div class="info-box">
          <h3>Client (Employeur)</h3>
          <p><strong>${client.name}</strong></p>
          <p>${client.address}</p>
          ${client.mandataire ? `
            <p style="margin-top: 10px;"><strong>Mandataire:</strong></p>
            <p>${client.mandataire.name}</p>
            <p>${client.mandataire.email}</p>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Détail des heures travaillées</div>
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
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${invoice.totalHours.toFixed(2)}h</td>
              <td style="padding: 12px; border: 1px solid #ddd;"></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${(invoice.totalHours * invoice.hourlyRate).toFixed(2)}€</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${invoice.totalFrais > 0 ? `
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
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${invoice.totalFrais.toFixed(2)}€</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}

      <div style="text-align: right; margin-top: 30px; padding: 20px; background-color: #34C759; color: white; border-radius: 4px;">
        <h2 style="margin: 0;">MONTANT TOTAL: ${invoice.totalAmount.toFixed(2)}€</h2>
      </div>

      <div class="footer">
        <p><strong>Mentions légales:</strong></p>
        <p>TVA non applicable, art. 293 B du CGI</p>
        <p>Paiement via CESU (Chèque Emploi Service Universel)</p>
        ${user.iban ? `<p>IBAN: ${user.iban}</p>` : ''}
        ${user.bic ? `<p>BIC: ${user.bic}</p>` : ''}
      </div>
    </body>
    </html>
  `;
};

export const generateClassicalTemplate = (
  invoice: Invoice,
  client: Client,
  timesheets: Timesheet[],
  user: User
): string => {
  const formatDate = (timestamp: number) => 
    new Date(timestamp).toLocaleDateString('fr-FR');
  
  const formatTime = (timestamp: number) => 
    new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const timesheetsHTML = timesheets.map(ts => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_arrival)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(ts.date_departure)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${ts.duration.toFixed(2)}h</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${invoice.hourlyRate.toFixed(2)}€</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(ts.duration * invoice.hourlyRate).toFixed(2)}€</td>
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
          ${client.mandataire ? `
            <p style="margin-top: 10px;"><strong>Mandataire:</strong></p>
            <p>${client.mandataire.name}</p>
            <p>${client.mandataire.email}</p>
            <p><strong>SIREN:</strong> ${client.mandataire.siren}</p>
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
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${invoice.totalHours.toFixed(2)}h</td>
              <td style="padding: 12px; border: 1px solid #ddd;"></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${(invoice.totalHours * invoice.hourlyRate).toFixed(2)}€</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${invoice.totalFrais > 0 ? `
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
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${invoice.totalFrais.toFixed(2)}€</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}

      <div style="text-align: right; margin-top: 30px; padding: 20px; background-color: #007AFF; color: white; border-radius: 4px;">
        <h2 style="margin: 0;">MONTANT TOTAL: ${invoice.totalAmount.toFixed(2)}€</h2>
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
