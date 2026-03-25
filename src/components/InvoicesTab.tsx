import React, { useState } from 'react';
import { useInvoiceStore } from '../stores/invoiceStore.supabase';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { generateCESUTemplate, generateClassicalTemplate } from '../services/InvoiceTemplates';
import { generateAndSharePDF } from '../utils/pdfGenerator';

export default function InvoicesTab() {
  const { invoices, addInvoice } = useInvoiceStore();
  const { timesheets } = useTimesheetStore();
  const { clients } = useClientStore();
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<'CESU' | 'CLASSICAL'>('CESU');

  // Filter unbilled timesheets (all timesheets are unbilled by default)
  const unbilledTimesheets = timesheets;

  const handleGenerateInvoice = () => {
    if (selectedTimesheets.length === 0) {
      alert('Veuillez sélectionner au moins une feuille de temps');
      return;
    }

    const selectedTimesheetData = timesheets.filter(t => selectedTimesheets.includes(t.id));
    const totalHours = selectedTimesheetData.reduce((sum, t) => sum + t.duration, 0);
    const totalFrais = selectedTimesheetData.reduce(
      (sum, t) =>
        sum + (t.frais_repas || 0) + (t.frais_transport || 0) + (t.frais_autres || 0),
      0,
    );
    
    // Get client info
    const firstTimesheet = selectedTimesheetData[0];
    const client = clients.find((c) => c.id === firstTimesheet.client_id);
    
    if (!client) {
      alert('Client non trouvé');
      return;
    }

    const hourlyRate = client.hourly_rate || 15.5;
    const totalAmount = totalHours * hourlyRate + totalFrais;

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = invoices.filter((i) => i.invoice_number.startsWith(`${year}-${month}`)).length + 1;
    const invoiceNumber = `${year}-${month}-${String(count).padStart(3, '0')}`;

    addInvoice({
      invoice_number: invoiceNumber,
      client_id: firstTimesheet.client_id,
      status: 'draft',
      total_amount: totalAmount,
      month: Number(month),
      year,
      generated_at: Date.now(),
      facturation_mode: selectedMode,
    });

    setShowModal(false);
    setSelectedTimesheets([]);
    setSelectedMode('CESU');
  };

  const toggleTimesheet = (id: string) => {
    setSelectedTimesheets(prev => 
      prev.includes(id) ? prev.filter(tsId => tsId !== id) : [...prev, id]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  };

  const getClientName = (clientId: string) => {
    return clients.find((c) => c.id === clientId)?.name || 'Unknown';
  };

  const generatePDF = async (invoice: any) => {
    try {
      const client = clients.find((c) => c.id === invoice.client_id);
      if (!client || !user) {
        alert('Client ou user non trouvé');
        return;
      }

      // Filtrer les timesheets par client, année et mois de la facture
      const invoiceTimesheets = timesheets.filter((ts) => {
        const tsDate = new Date(ts.date_arrival);
        return (
          ts.client_id === invoice.client_id &&
          tsDate.getFullYear() === invoice.year &&
          (tsDate.getMonth() + 1) === invoice.month
        );
      });

      console.log('Invoice data:', { year: invoice.year, month: invoice.month });
      console.log('Filtered timesheets:', invoiceTimesheets.length);

      const mode: 'CESU' | 'CLASSICAL' = 
        invoice.facturation_mode === 'CLASSICAL' || client.facturation_mode === 'CLASSICAL' 
          ? 'CLASSICAL' 
          : 'CESU';

      const totalHours = invoiceTimesheets.reduce((sum, ts) => sum + (ts.duration || 0), 0);
      const totalFrais = invoiceTimesheets.reduce(
        (sum, ts) =>
          sum + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
        0,
      );
      const hourlyRate = client.hourly_rate || 15.5;

      console.log('Calculated values:', { totalHours, totalFrais, hourlyRate });

      const invoiceData = {
        ...invoice,
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        status: invoice.status,
        total_amount: invoice.total_amount,
        totalAmount: totalHours * hourlyRate + totalFrais,
        month: invoice.month,
        year: invoice.year,
        generated_at: invoice.generated_at,
        created_at: invoice.created_at || invoice.generated_at,
        facturation_mode: mode,
        totalHours: totalHours,
        totalFrais: totalFrais,
        hourlyRate: hourlyRate,
      };

      console.log('Invoice data passed to template:', invoiceData);

      const htmlContent =
        mode === 'CESU'
          ? generateCESUTemplate(invoiceData, client, invoiceTimesheets, user)
          : generateClassicalTemplate(invoiceData, client, invoiceTimesheets, user);

      await generateAndSharePDF(htmlContent, `invoice_${invoice.invoice_number}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      console.error('Error stack:', error?.stack);
      alert(`Erreur: ${error?.message || String(error)}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Invoices ({invoices.length})</h2>
        <button
          onClick={() => setShowModal(true)}
          disabled={unbilledTimesheets.length === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: unbilledTimesheets.length === 0 ? '#ccc' : '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: unbilledTimesheets.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          + Generate Invoice
        </button>
      </div>

      {/* Invoices List */}
      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px' }}>
        {invoices.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No invoices yet. Generate your first one!</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: '2px solid #34C759',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0 }}>#{invoice.invoice_number}</h3>
                      <span style={{ 
                        backgroundColor: invoice.status === 'paid' ? '#34C759' : invoice.status === 'sent' ? '#007AFF' : '#FF9500',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {invoice.status === 'draft' ? 'BROUILLON' : invoice.status === 'sent' ? 'ENVOYÉE' : 'PAYÉE'}
                      </span>
                      {invoice.facturation_mode && (
                        <span style={{ 
                          backgroundColor: '#5856D6',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {invoice.facturation_mode}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#666', marginBottom: '4px' }}>
                      👤 Client: {getClientName(invoice.client_id)}
                    </p>
                    <p style={{ color: '#666', marginBottom: '4px' }}>
                      📅 {formatDate(invoice.created_at)}
                    </p>
                    <p style={{ fontWeight: 'bold', fontSize: '18px', color: '#007AFF' }}>
                      Total: {invoice.total_amount.toFixed(2)}€
                    </p>
                  </div>
                  <button
                    onClick={() => generatePDF(invoice)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#007AFF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Generate Invoice</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Facturation Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as 'CESU' | 'CLASSICAL')}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="CESU">CESU</option>
                <option value="CLASSICAL">Classical</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>Select Timesheets ({selectedTimesheets.length} selected)</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
                {unbilledTimesheets.length === 0 ? (
                  <p style={{ color: '#999', textAlign: 'center' }}>No unbilled timesheets available</p>
                ) : (
                  unbilledTimesheets.map((timesheet) => {
                    const client = clients.find((c) => c.id === timesheet.client_id);
                    return (
                      <label
                        key={timesheet.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px',
                          marginBottom: '8px',
                          backgroundColor: selectedTimesheets.includes(timesheet.id) ? '#e3f2fd' : 'white',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTimesheets.includes(timesheet.id)}
                          onChange={() => toggleTimesheet(timesheet.id)}
                          style={{ marginRight: '12px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 'bold' }}>{client?.name}</p>
                          <p style={{ fontSize: '12px', color: '#666' }}>
                            {formatDate(timesheet.date_arrival)} • {timesheet.duration.toFixed(2)}h
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={selectedTimesheets.length === 0}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: selectedTimesheets.length === 0 ? '#ccc' : '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedTimesheets.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
