import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../stores/invoiceStore.supabase';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore } from '../stores/clientStore.supabase';
import { useMandataireStore } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { generateCESUTemplate, generateClassicalTemplate } from '../services/InvoiceTemplates';
import { nextInvoiceNumber, nextCreditNumber } from '../services/invoiceNumbering';
import { generateAndSharePDF, generatePdfBase64 } from '../utils/pdfGenerator';
import { supabase } from '../lib/supabase';
import InvoiceImportPanel from './InvoiceImportPanel';

export default function InvoicesTab() {
  const { invoices, addInvoice, updateInvoice } = useInvoiceStore();
  const { timesheets } = useTimesheetStore();
  const { clients, getContactsForClient } = useClientStore();
  const { getMandataireById, hydrateMandataires } = useMandataireStore();
  const { user } = useAuthStore();

  // Les mandataires ne sont pas hydratés globalement : on les charge ici pour que
  // l'envoi puisse résoudre le destinataire d'un client rattaché à un mandataire.
  useEffect(() => { hydrateMandataires(); }, [hydrateMandataires]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<'CESU' | 'CLASSICAL'>('CESU');
  // Avoir (note de crédit) sur une facture existante
  const [creditModal, setCreditModal] = useState<any | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: '', reason: '', date: '' });
  const [creatingCredit, setCreatingCredit] = useState(false);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const openCreditModal = (invoice: any) => {
    const today = new Date();
    setCreditForm({
      amount: Math.abs(invoice.total_amount || 0).toFixed(2),
      reason: `Avoir sur facture ${invoice.invoice_number}`,
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    });
    setCreditModal(invoice);
  };

  const handleCreateCredit = async () => {
    if (!creditModal) return;
    const amount = parseFloat(creditForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { alert('Montant de l\'avoir invalide.'); return; }
    const dateMs = creditForm.date ? new Date(creditForm.date).getTime() : Date.now();
    const d = new Date(dateMs);
    const number = nextCreditNumber(invoices, d.getFullYear());
    setCreatingCredit(true);
    try {
      await addInvoice({
        invoice_number: number,
        client_id: creditModal.client_id,
        status: 'sent',
        total_amount: -Math.abs(amount), // avoir = montant négatif
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        lines: [{ designation: creditForm.reason || `Avoir sur facture ${creditModal.invoice_number}`, quantity: 1, unit_price: -Math.abs(amount) }],
        credit_of: creditModal.invoice_number,
        generated_at: dateMs,
        facturation_mode: creditModal.facturation_mode || 'CLASSICAL',
      } as any);
      setCreditModal(null);
    } catch (e: any) {
      console.error('Création avoir échouée:', e);
      alert(`Échec de la création de l'avoir : ${e?.message || e}`);
    } finally {
      setCreatingCredit(false);
    }
  };

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

    // N° de facture — série annuelle continue, gap-safe (cf. services/invoiceNumbering).
    // INVOICE_NUMBER_START = dernier n° facture.net avant bascule (à fixer par le PO avant mise en service).
    const INVOICE_NUMBER_START = 0;
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const invoiceNumber = nextInvoiceNumber(invoices, year, INVOICE_NUMBER_START);

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

  // Construit le HTML de la facture (partagé entre PDF et envoi email). null si données manquantes.
  const buildInvoiceHtml = (invoice: any): { html: string; client: any } | null => {
    {
      const client = clients.find((c) => c.id === invoice.client_id);
      if (!client || !user) {
        return null;
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

      // Le template attend des champs camelCase ; le store User est en snake_case → on mappe
      // (sinon "Votre contact : undefined", display_name n'étant pas lu).
      const userForTemplate = {
        displayName: [user.first_name, user.display_name].filter(Boolean).join(' ') || user.display_name,
        email: user.email,
        address: user.address,
        phone: user.phone,
        cesuNumber: user.cesu_number,
        siren: user.siren,
        siret: user.siret,
        businessName: user.business_name,
        businessAddress: user.business_address,
        iban: user.iban,
        bic: user.bic,
        sapDeclarationNumber: user.sap_declaration_number,
      };
      // Lignes à rendre :
      //  - facture indépendante (société) → lignes libres stockées ;
      //  - facture importée (reprise DomiTemps / facture.net) sans pointage ni ligne mais
      //    avec un montant stocké → on rend UNE ligne récap au montant de la facture
      //    (sinon le recalcul depuis des pointages inexistants affiche 0 €).
      let pdfLines = invoice.lines as { designation: string; quantity: number; unit_price: number }[] | undefined;
      if ((!pdfLines || pdfLines.length === 0) && invoiceTimesheets.length === 0 && (invoice.total_amount || 0) > 0) {
        pdfLines = [{
          designation: `Prestations ${String(invoice.month).padStart(2, '0')}/${invoice.year}`,
          quantity: 1,
          unit_price: invoice.total_amount,
        }];
      }

      const htmlContent =
        mode === 'CESU'
          ? generateCESUTemplate(invoiceData, client, invoiceTimesheets, userForTemplate)
          : generateClassicalTemplate(invoiceData, client, invoiceTimesheets, userForTemplate, undefined, undefined, pdfLines);

      return { html: htmlContent, client };
    }
  };

  const generatePDF = async (invoice: any) => {
    try {
      const built = buildInvoiceHtml(invoice);
      if (!built) { alert('Client ou user non trouvé'); return; }
      await generateAndSharePDF(built.html, `invoice_${invoice.invoice_number}.pdf`);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      console.error('Error stack:', error?.stack);
      alert(`Erreur: ${error?.message || String(error)}`);
    }
  };

  // FAC-07 : envoi de la facture par email (Edge Function send-invoice → Resend).
  const sendInvoiceEmail = async (invoice: any) => {
    const client = clients.find((c) => c.id === invoice.client_id);
    if (!client) { alert('Client non trouvé'); return; }
    const contacts = getContactsForClient(invoice.client_id);
    // Client rattaché à un mandataire → la facture part AU MANDATAIRE (ex. CESU géré par l'association).
    // Sinon fallback sur l'email du client, puis sur le 1er destinataire supplémentaire.
    const mandataire = client.mandataire_id ? getMandataireById(client.mandataire_id) : null;
    const to = mandataire?.email || client.email || contacts[0]?.email;
    if (!to) { alert("Aucun email destinataire (renseignez le mandataire, l'email du client ou un destinataire supplémentaire)."); return; }
    // Destinataires supplémentaires = en copie (cc), en plus du destinataire principal.
    const cc = contacts.map((c) => c.email).filter((e) => e && e !== to);
    const isCredit = !!invoice.credit_of;
    if (!window.confirm(`Envoyer ${isCredit ? "l'avoir" : 'la facture'} ${invoice.invoice_number} à ${to} ?`)) return;

    setSendingId(invoice.id);
    try {
      const built = buildInvoiceHtml(invoice);
      if (!built) { alert('Données facture incomplètes'); return; }
      const pdfBase64 = await generatePdfBase64(built.html);
      const subject = `${isCredit ? 'Avoir' : 'Facture'} ${invoice.invoice_number}`;
      // Signature = prénom + nom (display_name ne contient que le nom de famille).
      const signature = [user?.first_name, user?.display_name].filter(Boolean).join(' ') || user?.business_name || '';
      const message = `Bonjour,\n\nVeuillez trouver ${isCredit ? "l'avoir" : 'la facture'} ${invoice.invoice_number} en pièce jointe.\n\nCordialement,\n${signature}`;
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        // replyTo : les reponses du destinataire doivent revenir au professionnel
        // qui envoie, pas a l'adresse d'expedition du domaine.
        body: { to, cc, subject, message, pdfBase64, filename: `${invoice.invoice_number}.pdf`, replyTo: user?.email },
      });
      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || 'Échec de l\'envoi');
      }
      // Marque envoyée + horodate (sauf si déjà payée, on garde le statut payé).
      const updates: any = { sent_at: Date.now(), sent_channel: 'email' };
      if (invoice.status === 'draft') updates.status = 'sent';
      await updateInvoice(invoice.id, updates);
      alert(`Email envoyé à ${to}.`);
    } catch (e: any) {
      console.error('Envoi email échoué:', e);
      alert(`Échec de l'envoi : ${e?.message || e}\n\n(La fonction send-invoice est-elle déployée et la clé Resend configurée ?)`);
    } finally {
      setSendingId(null);
    }
  };

  // ── Impayés (FAC-05) : factures « envoyée » non payées (avoirs négatifs exclus) ──
  const DAY = 86400000;
  const nowMs = Date.now();
  const OVERDUE_DAYS = 30; // au-delà → considéré en retard
  const unpaid = invoices.filter((i) => i.status === 'sent' && (i.total_amount || 0) > 0);
  const unpaidTotal = unpaid.reduce((s, i) => s + (i.total_amount || 0), 0);
  const overdueCount = unpaid.filter((i) => (nowMs - (i.generated_at || i.created_at || nowMs)) > OVERDUE_DAYS * DAY).length;
  const ageDays = (i: any) => Math.floor((nowMs - (i.generated_at || i.created_at || nowMs)) / DAY);

  const displayedInvoices = onlyUnpaid
    ? [...unpaid].sort((a, b) => (a.generated_at || 0) - (b.generated_at || 0)) // impayés : plus ancien d'abord
    : invoices;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Factures ({invoices.length})</h2>
        <p style={{ color: '#666', fontSize: '13px', marginTop: '6px' }}>
          Les factures se génèrent depuis l'onglet <strong>Bilans</strong> (par client, en fin de mois).
          Cet onglet sert au <strong>suivi</strong> : statut payé/impayé, attestation fiscale.
        </p>
      </div>

      <InvoiceImportPanel />

      {/* Impayés (FAC-05) : synthèse + filtre */}
      {unpaid.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#FFF4E5', border: '1px solid #FF9500', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#b36b00', fontSize: '15px' }}>
              💰 Impayé : {unpaidTotal.toFixed(2)} € · {unpaid.length} facture{unpaid.length > 1 ? 's' : ''} envoyée{unpaid.length > 1 ? 's' : ''}
            </div>
            {overdueCount > 0 && (
              <div style={{ color: '#FF3B30', fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
                ⚠️ {overdueCount} en retard (&gt; {OVERDUE_DAYS} jours)
              </div>
            )}
          </div>
          <button onClick={() => setOnlyUnpaid((v) => !v)}
            style={{ padding: '9px 16px', backgroundColor: onlyUnpaid ? '#FF9500' : 'white', color: onlyUnpaid ? 'white' : '#b36b00', border: '1px solid #FF9500', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            {onlyUnpaid ? 'Voir toutes les factures' : 'Voir les impayés'}
          </button>
        </div>
      )}

      {/* Invoices List */}
      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px' }}>
        {invoices.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No invoices yet. Generate your first one!</p>
        ) : displayedInvoices.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Aucune facture impayée 🎉</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {displayedInvoices.map((invoice) => (
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
                        {invoice.credit_of && (
                        <span style={{ backgroundColor: '#FF3B30', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                          AVOIR
                        </span>
                      )}
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
                      {invoice.status === 'sent' && (invoice.total_amount || 0) > 0 && ageDays(invoice) > OVERDUE_DAYS && (
                        <span style={{ backgroundColor: '#FF3B30', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                          EN RETARD · {ageDays(invoice)}j
                        </span>
                      )}
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
                      📅 {formatDate(invoice.generated_at || invoice.created_at)}
                    </p>
                    <p style={{ fontWeight: 'bold', fontSize: '18px', color: invoice.total_amount < 0 ? '#FF3B30' : '#007AFF' }}>
                      Total: {invoice.total_amount.toFixed(2)}€
                    </p>
                    {invoice.credit_of && (
                      <p style={{ color: '#FF3B30', fontSize: '12px', marginTop: '2px' }}>
                        ↩ Avoir sur facture {invoice.credit_of}
                      </p>
                    )}
                    {invoice.sent_at && (
                      <p style={{ color: '#1a6fb5', fontSize: '12px', marginTop: '4px' }}>
                        ✉️ Envoyée le {formatDate(invoice.sent_at)}
                      </p>
                    )}
                    {invoice.status === 'paid' && invoice.paid_at && (
                      <p style={{ color: '#34C759', fontSize: '12px', marginTop: '4px' }}>
                        💶 {invoice.total_amount < 0 ? 'Remboursé' : 'Encaissée'} le {formatDate(invoice.paid_at)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
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
                    <button
                      onClick={() => sendInvoiceEmail(invoice)}
                      disabled={sendingId === invoice.id}
                      title="Envoyer par email (PDF joint)"
                      style={{
                        padding: '8px 16px',
                        backgroundColor: sendingId === invoice.id ? '#ccc' : '#34C759',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: sendingId === invoice.id ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      {sendingId === invoice.id ? 'Envoi…' : '✉️ Envoyer'}
                    </button>
                    <select
                      value={invoice.status}
                      onChange={(e) => {
                        const status = e.target.value as 'draft' | 'sent' | 'paid';
                        // « Payée » → on horodate l'encaissement (base URSSAF). Sinon on l'efface.
                        const updates: any = { status };
                        if (status === 'paid') { if (!invoice.paid_at) updates.paid_at = Date.now(); }
                        else { updates.paid_at = null; }
                        updateInvoice(invoice.id, updates);
                      }}
                      title="Statut de la facture"
                      style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      <option value="draft">Brouillon</option>
                      <option value="sent">Envoyée</option>
                      <option value="paid">Payée</option>
                    </select>
                    {invoice.status === 'paid' && (
                      <input
                        type="date"
                        value={invoice.paid_at ? new Date(invoice.paid_at).toISOString().slice(0, 10) : ''}
                        onChange={(e) => updateInvoice(invoice.id, { paid_at: e.target.value ? new Date(e.target.value).getTime() : null })}
                        title="Date d'encaissement"
                        style={{ padding: '6px 8px', border: '1px solid #34C759', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                      />
                    )}
                    {!invoice.credit_of && (
                      <button
                        onClick={() => openCreditModal(invoice)}
                        title="Créer un avoir sur cette facture"
                        style={{ padding: '8px 16px', backgroundColor: 'white', color: '#FF3B30', border: '1px solid #FF3B30', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        ↩ Avoir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Avoir (note de crédit) */}
      {creditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setCreditModal(null)}>
          <div style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '92%', maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px', fontSize: '19px' }}>Avoir sur facture {creditModal.invoice_number}</h2>
            <p style={{ margin: '0 0 18px', color: '#888', fontSize: '13px' }}>
              Annule/corrige une facture émise (montant crédité au client). N° dédié AV-{new Date(creditForm.date || Date.now()).getFullYear()}-NNN.
            </p>

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Montant à créditer (€)</label>
            <input type="number" step="0.01" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '14px' }} />
            <p style={{ fontSize: '11px', color: '#999', margin: '-10px 0 14px' }}>Total facture : {Math.abs(creditModal.total_amount || 0).toFixed(2)} € — laisser tel quel pour un avoir total, réduire pour un avoir partiel.</p>

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Motif</label>
            <input type="text" value={creditForm.reason} onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
              placeholder="Ex: erreur de facturation, remise…" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '14px' }} />

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Date de l'avoir</label>
            <input type="date" value={creditForm.date} onChange={(e) => setCreditForm({ ...creditForm, date: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px' }} />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCreditModal(null)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button onClick={handleCreateCredit} disabled={creatingCredit}
                style={{ flex: 1, padding: '12px', background: creatingCredit ? '#ccc' : '#FF3B30', color: 'white', border: 'none', borderRadius: '8px', cursor: creatingCredit ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {creatingCredit ? 'Création…' : "Créer l'avoir"}
              </button>
            </div>
          </div>
        </div>
      )}

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
