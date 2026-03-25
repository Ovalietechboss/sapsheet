// @ts-nocheck
import { APP_CONFIG } from '../config/constants';
import { Invoice } from '../stores/invoiceStore.supabase';
import { Timesheet } from '../stores/timesheetStore.supabase';
import { User } from '../stores/authStore';
import { Client } from '../stores/clientStore.supabase';

export class InvoiceService {
  /**
   * Calculate amounts from timesheets
   */
  static calculateAmounts(
    timesheets: Timesheet[],
    hourlyRate: number
  ): {
    totalHours: number;
    subtotalHT: number;
    totalFrais: number;
    totalTTC: number;
  } {
    const totalHours = timesheets.reduce((sum, ts) => sum + ts.durationHours, 0);
    const totalFrais = timesheets.reduce(
      (sum, ts) => sum + ts.fraisAnnexes.reduce((fsum, f) => fsum + f.montant, 0),
      0
    );
    const subtotalHT = totalHours * hourlyRate;
    const totalTTC = subtotalHT + totalFrais;

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      subtotalHT: Math.round(subtotalHT * 100) / 100,
      totalFrais: Math.round(totalFrais * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
    };
  }

  /**
   * Generate unique invoice number: YYYY-MM-001
   */
  static generateInvoiceNumber(existingInvoices: Invoice[]): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthInvoices = existingInvoices.filter((inv) =>
      inv.invoiceNumber.startsWith(yearMonth)
    );

    const nextNumber = monthInvoices.length + 1;
    return `${yearMonth}-${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Render CESU invoice HTML template
   */
  static renderCESUTemplate(invoice: Invoice, assistant: User, client: Client): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; }
            .header p { margin: 5px 0; }
            .info-section { margin-bottom: 20px; }
            .info-section h3 { margin-bottom: 10px; border-bottom: 1px solid #ccc; }
            .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f0f0f0; text-align: left; padding: 10px; border: 1px solid #ddd; }
            td { padding: 10px; border: 1px solid #ddd; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .legal { margin-top: 30px; padding: 15px; background-color: #f5f5f5; font-size: 12px; }
            .payment-info { margin-top: 20px; padding: 10px; background-color: #fff3cd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Facture CESU</h1>
            <p><strong>N° Facture:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> ${new Date(invoice.generatedAt || Date.now()).toLocaleDateString('fr-FR')}</p>
          </div>

          <div class="info-section">
            <h3>Assistante</h3>
            <div class="info-row">
              <span class="label">Nom:</span>
              <span>${assistant.displayName}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span>${assistant.email}</span>
            </div>
            <div class="info-row">
              <span class="label">N° CESU:</span>
              <span>${invoice.mandataire.name} - ${assistant.cesuNumber || 'N/A'}</span>
            </div>
          </div>

          <div class="info-section">
            <h3>Client</h3>
            <div class="info-row">
              <span class="label">Nom:</span>
              <span>${client.name}</span>
            </div>
            <div class="info-row">
              <span class="label">Adresse:</span>
              <span>${client.address}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${invoice.totalHoursWorked}h × ${invoice.hourlyRate}€/h</td>
                <td>${invoice.subtotalHT.toFixed(2)}€</td>
              </tr>
              ${
                invoice.totalFraisAnnexes > 0
                  ? `<tr><td>Frais annexes</td><td>${invoice.totalFraisAnnexes.toFixed(2)}€</td></tr>`
                  : ''
              }
              <tr class="total-row">
                <td>TOTAL TTC</td>
                <td>${invoice.totalTTC.toFixed(2)}€</td>
              </tr>
            </tbody>
          </table>

          <div class="legal">
            <p><strong>Mention légale:</strong> ${APP_CONFIG.LEGAL_MENTIONS.TVA}</p>
          </div>

          <div class="payment-info">
            <p><strong>${APP_CONFIG.LEGAL_MENTIONS.PAYMENT_TEXT}</strong></p>
            <p><strong>IBAN:</strong> ${invoice.paymentInfo.iban}</p>
            <p><strong>BIC:</strong> ${invoice.paymentInfo.bic}</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Render Classical invoice HTML template
   */
  static renderClassicalTemplate(
    invoice: Invoice,
    assistant: User,
    client: Client
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; }
            .mandataire-info { margin-bottom: 30px; padding: 10px; background-color: #f0f0f0; }
            .info-section { margin-bottom: 20px; }
            .info-section h3 { margin-bottom: 10px; border-bottom: 1px solid #ccc; }
            .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f0f0f0; text-align: left; padding: 10px; border: 1px solid #ddd; }
            td { padding: 10px; border: 1px solid #ddd; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            .legal { margin-top: 30px; padding: 15px; background-color: #f5f5f5; font-size: 12px; }
            .payment-info { margin-top: 20px; padding: 10px; background-color: #fff3cd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Facture</h1>
            <p><strong>N° Facture:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> ${new Date(invoice.generatedAt || Date.now()).toLocaleDateString('fr-FR')}</p>
          </div>

          <div class="mandataire-info">
            <h3>Prestataire</h3>
            <p><strong>${invoice.mandataire.name}</strong></p>
            <p><strong>SIREN:</strong> ${invoice.mandataire.siren}</p>
            <p><strong>SIRET:</strong> ${invoice.mandataire.siret}</p>
          </div>

          <div class="info-section">
            <h3>Assistant Prestataire</h3>
            <div class="info-row">
              <span><strong>${assistant.displayName}</strong></span>
            </div>
            <div class="info-row">
              <span>${assistant.address || ''}</span>
            </div>
          </div>

          <div class="info-section">
            <h3>Client</h3>
            <div class="info-row">
              <span><strong>${client.name}</strong></span>
            </div>
            <div class="info-row">
              <span>${client.address}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${invoice.totalHoursWorked}h</td>
                <td>${invoice.subtotalHT.toFixed(2)}€</td>
              </tr>
              ${
                invoice.totalFraisAnnexes > 0
                  ? `<tr><td>Frais annexes</td><td>${invoice.totalFraisAnnexes.toFixed(2)}€</td></tr>`
                  : ''
              }
              <tr class="total-row">
                <td>TOTAL TTC</td>
                <td>${invoice.totalTTC.toFixed(2)}€</td>
              </tr>
            </tbody>
          </table>

          <div class="legal">
            <p><strong>Mention légale:</strong> ${APP_CONFIG.LEGAL_MENTIONS.TVA}</p>
            <p>Facture établie en vertu de l'article 1777 du CGI</p>
          </div>

          <div class="payment-info">
            <p><strong>${APP_CONFIG.LEGAL_MENTIONS.PAYMENT_TEXT}</strong></p>
            <p><strong>IBAN:</strong> ${invoice.paymentInfo.iban}</p>
            <p><strong>BIC:</strong> ${invoice.paymentInfo.bic}</p>
          </div>
        </body>
      </html>
    `;
  }
}

export default InvoiceService;
