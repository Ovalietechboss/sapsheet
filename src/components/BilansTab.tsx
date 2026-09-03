import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useTimesheetStore } from '../stores/timesheetStore.supabase';
import { useClientStore, ClientContact } from '../stores/clientStore.supabase';
import { useMandataireStore, Mandataire } from '../stores/mandataireStore.supabase';
import { useAuthStore } from '../stores/authStore';
import { useBillingPeriodStore, BillingPeriod, ClientDocStatus } from '../stores/billingPeriodStore.supabase';
import { useInvoiceStore, InvoiceLine } from '../stores/invoiceStore.supabase';
import { generateCESUTemplate, generateClassicalTemplate, generateRecapTemplate } from '../services/InvoiceTemplates';
import { nextInvoiceNumber } from '../services/invoiceNumbering';
import { generateAndSharePDF, generatePdfBase64 } from '../utils/pdfGenerator';
import { supabase } from '../lib/supabase';
import { isDureeDirecte } from '../utils/timesheetMode';
import { useIsMobile } from '../hooks/useMediaQuery';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const STATUS_LABEL: Record<ClientDocStatus, string> = { pending: 'À générer', generated: 'Généré', sent: 'Envoyé', error: 'Erreur' };
const STATUS_COLOR: Record<ClientDocStatus, string> = { pending: '#FF9500', generated: '#007AFF', sent: '#34C759', error: '#FF3B30' };
const STATUS_ICONE: Record<ClientDocStatus, string> = { pending: '○', generated: '📄', sent: '✉️', error: '⚠️' };

/**
 * Badge d'état du document, identique pour un relevé CESU et pour une facture.
 * Sur mobile on n'affiche que l'icône : la ligne y est déjà chargée, et le libellé complet
 * reste accessible par `title` (appui long, ou survol sur écran large).
 */
function BadgeDoc({ etat, sentAt, canal, compact }: {
  etat: ClientDocStatus; sentAt: number | null; canal: 'email' | 'hand' | null; compact: boolean;
}) {
  const remis = canal === 'hand';
  const date = sentAt ? new Date(sentAt).toLocaleDateString('fr-FR') : null;
  const libelle = etat === 'sent' && date
    ? (remis ? `Remis en main propre le ${date}` : `Envoyé par email le ${date}`)
    : STATUS_LABEL[etat];
  // Une remise en main propre n'est pas un envoi : elle a sa propre icone.
  const icone = etat === 'sent' && remis ? '🤝' : STATUS_ICONE[etat];
  return (
    <span title={libelle} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
      padding: compact ? '3px 7px' : '3px 10px', borderRadius: '12px',
      fontSize: '12px', fontWeight: 'bold',
      backgroundColor: STATUS_COLOR[etat] + '22', color: STATUS_COLOR[etat],
      border: `1px solid ${STATUS_COLOR[etat]}44`,
    }}>
      <span style={{ fontSize: '13px', lineHeight: 1 }}>{icone}</span>
      {!compact && <span>{libelle}</span>}
    </span>
  );
}

const PERIOD_STATUS_LABEL = { open: 'Ouvert', locked: 'Clôturé', archived: 'Archivé' };
const PERIOD_STATUS_COLOR = { open: '#34C759', locked: '#FF9500', archived: '#888' };

type SubView = 'documents' | 'chronologie' | 'synthese';

interface ClientRow {
  clientId: string;
  clientName: string;
  /** Etat du document, unifie entre les deux modes (voir docStateFor). */
  docState: ClientDocStatus;
  /** Horodatage de transmission, quel que soit le mode. Null si jamais transmis. */
  docSentAt: number | null;
  /** Comment il a ete transmis : par email, ou remis en main propre. */
  docChannel: 'email' | 'hand' | null;
  /** Facture correspondante (clients classiques), pour pouvoir la mettre a jour. */
  invoiceId: string | null;
  facturationMode: 'CESU' | 'CLASSICAL';
  clientType: 'PARTICULIER' | 'SOCIETE';
  clientEmail?: string;
  mandataire?: Mandataire;
  timesheetCount: number;
  totalHours: number;
  totalEarnings: number;
  totalFrais: number;
  totalAmount: number;
  hasDraftTimesheets: boolean;
  recipientEmail?: string;
}

interface MandataireGroup {
  mandataire?: Mandataire;
  clients: ClientRow[];
  totalAmount: number;
  recipientEmail?: string;
}

export default function BilansTab() {
  const { timesheets } = useTimesheetStore();
  const { clients, getContactsForClient } = useClientStore();
  const { mandataires } = useMandataireStore();
  const { user } = useAuthStore();
  const { invoices, addInvoice, updateInvoice } = useInvoiceStore();
  const {
    periods, getOrCreatePeriod, getPeriod, getClientStatus,
    upsertClientStatus, lockPeriod, unlockPeriod, archivePeriod,
  } = useBillingPeriodStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [generating, setGenerating] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [subView, setSubView] = useState<SubView>('documents');
  const [showNova, setShowNova] = useState(false);
  const [showUrssaf, setShowUrssaf] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; mode: 'CESU' | 'CLASSICAL' } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<{ mode: 'CESU' | 'CLASSICAL'; alreadyGen: number; pending: number } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendProgress, setSendProgress] = useState<{ done: number; total: number } | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);
  // Facture indépendante (société B2B, lignes libres)
  const [societeModal, setSocieteModal] = useState<ClientRow | null>(null);
  const [societeLines, setSocieteLines] = useState<InvoiceLine[]>([{ designation: '', quantity: 1, unit_price: 0 }]);
  const [societeDate, setSocieteDate] = useState('');

  const isMobile = useIsMobile();

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 3 + i).reverse();

  const currentPeriod = getPeriod(selectedMonth, selectedYear);
  const isLocked = currentPeriod?.status === 'locked' || currentPeriod?.status === 'archived';
  const isArchived = currentPeriod?.status === 'archived';

  // ── Données du mois ────────────────────────────────────────────────────────

  const start = new Date(selectedYear, selectedMonth - 1, 1).getTime();
  const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).getTime();

  const monthTimesheets = useMemo(
    () => timesheets.filter((ts) => ts.date_arrival >= start && ts.date_arrival <= end).sort((a, b) => a.date_arrival - b.date_arrival),
    [timesheets, start, end]
  );

  const { groups, totalClientsActive, totalHours, totalEarnings, totalFrais, totalMontant, warnings } = useMemo(() => {
    const rows: ClientRow[] = clients.map((client) => {
      const cts = monthTimesheets.filter((ts) => ts.client_id === client.id);
      const totalHours = cts.reduce((s, ts) => s + ts.duration, 0);
      const totalEarnings = cts.reduce((s, ts) => s + Math.round(ts.duration * client.hourly_rate * 100) / 100, 0);
      const totalFrais = cts.reduce(
        (s, ts) => s + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0)), 0
      );
      const mandataire = mandataires.find((m) => m.id === client.mandataire_id);
      const persisted = currentPeriod ? getClientStatus(currentPeriod.id, client.id) : null;

      // Etat du document : DEUX sources de verite selon le mode, et c'est voulu.
      //  - CESU      : l'envoi est trace dans billing_period_clients (bouton de cet ecran).
      //  - CLASSIQUE : l'envoi se fait depuis l'onglet Factures, qui ecrit invoices.sent_at.
      // On lit `sent_at` et jamais `invoices.status` : ce dernier vaut « emise », il peut etre
      // passe a la main sans qu'aucun email ne soit parti.
      const facture = client.facturation_mode === 'CLASSICAL'
        ? invoices.find((i) => i.client_id === client.id && i.month === selectedMonth && i.year === selectedYear)
        : null;

      let docState: ClientDocStatus;
      let docSentAt: number | null = null;
      let docChannel: 'email' | 'hand' | null = null;
      if (persisted?.status === 'error') {
        docState = 'error';
      } else if (client.facturation_mode === 'CESU') {
        docState = (persisted?.status as ClientDocStatus) || 'pending';
        docSentAt = persisted?.sent_at ?? null;
        docChannel = persisted?.sent_channel ?? null;
      } else if (!facture) {
        docState = 'pending';
      } else if (facture.sent_at) {
        docState = 'sent';
        docSentAt = facture.sent_at;
        docChannel = facture.sent_channel ?? null;
      } else {
        docState = 'generated';
      }

      return {
        docState,
        docSentAt,
        docChannel,
        invoiceId: facture?.id ?? null,
        clientId: client.id,
        clientName: [client.titre, client.first_name, client.name].filter(Boolean).join(' '),
        facturationMode: client.facturation_mode,
        clientType: client.client_type || 'PARTICULIER',
        clientEmail: client.email,
        mandataire,
        timesheetCount: cts.length,
        totalHours,
        totalEarnings,
        totalFrais,
        totalAmount: totalEarnings + totalFrais,
        hasDraftTimesheets: cts.some((ts) => ts.status === 'draft'),
        recipientEmail: mandataire?.email || client.email,
      };
    });

    // Grouper par mandataire
    const map = new Map<string, MandataireGroup>();
    rows.forEach((row) => {
      const key = row.mandataire?.id || '__none__';
      if (!map.has(key)) map.set(key, { mandataire: row.mandataire, clients: [], totalAmount: 0, recipientEmail: row.mandataire?.email || row.clientEmail });
      const g = map.get(key)!;
      g.clients.push(row);
      g.totalAmount += row.totalAmount;
    });

    const groups = Array.from(map.values()).sort((a, b) => {
      if (!a.mandataire) return 1;
      if (!b.mandataire) return -1;
      return a.mandataire.association_name.localeCompare(b.mandataire.association_name);
    });

    const activeRows = rows.filter((r) => r.timesheetCount > 0);
    const warnings: string[] = [];
    const notGenerated = activeRows.filter((r) => r.docState === 'pending');
    const draftTs = activeRows.filter((r) => r.hasDraftTimesheets);
    if (notGenerated.length > 0) warnings.push(`${notGenerated.length} client${notGenerated.length > 1 ? 's' : ''} sans document généré`);
    if (draftTs.length > 0) warnings.push(`${draftTs.length} client${draftTs.length > 1 ? 's' : ''} avec pointages non validés`);

    return {
      groups,
      totalClientsActive: activeRows.length,
      totalHours: activeRows.reduce((s, r) => s + r.totalHours, 0),
      totalEarnings: activeRows.reduce((s, r) => s + r.totalEarnings, 0),
      totalFrais: activeRows.reduce((s, r) => s + r.totalFrais, 0),
      totalMontant: activeRows.reduce((s, r) => s + r.totalAmount, 0),
      warnings,
    };
  }, [monthTimesheets, clients, mandataires, currentPeriod, getClientStatus, invoices, selectedMonth, selectedYear]);

  // ── User profile pour templates ────────────────────────────────────────────

  const userProfile = user ? {
    displayName: [user.first_name, user.display_name].filter(Boolean).join(' ') || user.display_name || user.email,
    email: user.email, address: user.address, phone: user.phone,
    cesuNumber: user.cesu_number, siren: user.siren, siret: user.siret,
    businessName: user.business_name, businessAddress: user.business_address,
    iban: user.iban, bic: user.bic,
    sapDeclarationNumber: user.sap_declaration_number,
  } : null;

  // ── Génération PDF ─────────────────────────────────────────────────────────

  // Construit le document (HTML) d'un client pour le mois sélectionné.
  // Partagé entre la génération (téléchargement/partage) et l'envoi par email.
  const buildDoc = (row: ClientRow) => {
    if (!userProfile) return null;
    const client = clients.find((c) => c.id === row.clientId);
    if (!client) return null;
    const cts = monthTimesheets.filter((ts) => ts.client_id === client.id);

    const isCESU = client.facturation_mode === 'CESU';
    const clientTag = client.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '');
    const invoiceNumber = isCESU
      ? `CESU-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${clientTag}`
      : `FAC-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${clientTag}`;

    const invoiceData: any = {
      invoice_number: invoiceNumber,
      created_at: Date.now(),
      total_amount: row.totalAmount,
      month: selectedMonth,
      year: selectedYear,
    };

    const clientContacts = getContactsForClient(client.id);

    const html = isCESU
      ? generateCESUTemplate(invoiceData, client, cts, userProfile, row.mandataire, clientContacts)
      : generateClassicalTemplate(invoiceData, client, cts, userProfile, row.mandataire, clientContacts);

    return { client, cts, isCESU, invoiceNumber, html, clientContacts };
  };

  const handleGenerate = async (row: ClientRow) => {
    if (!user || !userProfile || isLocked) return;
    setGenerating(row.clientId);
    try {
      const period = await getOrCreatePeriod(selectedMonth, selectedYear);
      const doc = buildDoc(row);
      if (!doc) return;
      const { client, isCESU, invoiceNumber, html } = doc;

      await generateAndSharePDF(html, `${invoiceNumber}`);

      // Lien Bilans → module Factures : suivi de la facture (clients classiques uniquement ;
      // CESU = pointage, pas une facture). Idempotent + SOFT-FAIL : si l'écriture échoue
      // (ex. table `invoices` absente), on NE casse PAS la génération Bilans (cœur métier).
      if (!isCESU) {
        try {
          const existing = invoices.find(
            (i) => i.client_id === client.id && i.month === selectedMonth && i.year === selectedYear,
          );
          if (existing) {
            await updateInvoice(existing.id, { total_amount: row.totalAmount, invoice_number: invoiceNumber });
          } else {
            await addInvoice({
              invoice_number: invoiceNumber,
              client_id: client.id,
              // Generer un PDF n'est pas l'envoyer. La facture nait en brouillon, comme la
              // facture independante societe : elle passe « envoyee » soit par l'envoi email
              // depuis l'onglet Factures, soit a la main via le selecteur de statut.
              status: 'draft',
              total_amount: row.totalAmount,
              month: selectedMonth,
              year: selectedYear,
              generated_at: Date.now(),
              facturation_mode: 'CLASSICAL',
            });
          }
        } catch (e) {
          console.warn('[Bilans→Factures] suivi non enregistré (table invoices ?) :', e);
        }
      }

      await upsertClientStatus(period.id, client.id, {
        status: 'generated', doc_generated_at: Date.now(), recipient_email: row.recipientEmail,
      });
    } catch (err) {
      console.error('Génération échouée:', err);
      if (currentPeriod) await upsertClientStatus(currentPeriod.id, row.clientId, { status: 'error' });
    } finally {
      setGenerating(null);
    }
  };

  // ── Envoi du relevé CESU au mandataire (BIL-01) ─────────────────────
  //
  // Réutilise l'Edge Function `send-invoice` (Resend), déjà en place pour les factures :
  // elle est générique (to/cc/subject/message/pdfBase64/filename), aucune modif côté serveur.
  //
  // CESU uniquement, volontairement : une facture CLASSIQUE s'envoie depuis l'onglet
  // Factures, seul endroit qui tient à jour `invoices.sent_at` / `status`. L'envoyer aussi
  // d'ici créerait deux suivis divergents pour un même document.
  const sendCesuEmail = async (row: ClientRow, opts?: { silent?: boolean }): Promise<boolean> => {
    if (!user || !userProfile || isLocked) return false;
    const doc = buildDoc(row);
    if (!doc || !doc.isCESU) return false;

    // Même règle de destinataire que les factures : mandataire d'abord (le CESU est géré
    // par l'association), sinon le client, sinon le 1er destinataire supplémentaire.
    const to = row.recipientEmail || doc.clientContacts[0]?.email;
    if (!to) {
      if (!opts?.silent) alert(`Aucun email destinataire pour ${row.clientName} (renseignez le mandataire, l'email du client ou un destinataire supplémentaire).`);
      return false;
    }
    const cc = doc.clientContacts.map((c) => c.email).filter((e) => e && e !== to);
    const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

    if (!opts?.silent) {
      const warn = row.hasDraftTimesheets
        ? `\n\n⚠️ Ce client a des pointages NON VALIDÉS sur ${periodLabel}.`
        : '';
      if (!window.confirm(`Envoyer le relevé CESU de ${row.clientName} (${periodLabel}) à ${to} ?${warn}`)) return false;
    }

    setSendingId(row.clientId);
    try {
      const period = await getOrCreatePeriod(selectedMonth, selectedYear);
      const pdfBase64 = await generatePdfBase64(doc.html);
      // Signature = prénom + nom (display_name ne contient que le nom de famille).
      const signature = [user.first_name, user.display_name].filter(Boolean).join(' ') || user.business_name || '';
      const subject = `Relevé de pointages CESU — ${row.clientName} — ${periodLabel}`;
      const message =
        `Bonjour,\n\nVeuillez trouver en pièce jointe le relevé de pointages de ${row.clientName} ` +
        `pour ${periodLabel}, pour validation avant paiement.\n\n` +
        `${row.totalHours.toFixed(1)} h · ${row.totalAmount.toFixed(2)} €\n\n` +
        `Je reste à votre disposition pour tout complément.\n\nCordialement,\n${signature}`;

      const { data, error } = await supabase.functions.invoke('send-invoice', {
        // replyTo : les reponses du mandataire doivent revenir au professionnel
        // qui envoie, pas a l'adresse d'expedition du domaine.
        body: { to, cc, subject, message, pdfBase64, filename: `${doc.invoiceNumber}.pdf`, replyTo: user.email },
      });
      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || "Échec de l'envoi");
      }

      await upsertClientStatus(period.id, row.clientId, {
        status: 'sent', sent_at: Date.now(), sent_channel: 'email', recipient_email: to,
      });
      if (!opts?.silent) alert(`Email envoyé à ${to}.`);
      return true;
    } catch (e: any) {
      console.error('Envoi CESU échoué:', e);
      if (!opts?.silent) {
        alert(`Échec de l'envoi : ${e?.message || e}\n\n(La fonction send-invoice est-elle déployée et la clé Resend configurée ?)`);
      }
      return false;
    } finally {
      setSendingId(null);
    }
  };

  // ── Remise en main propre ───────────────────────────────────────────────
  //
  // Tout ne part pas par email : certains clients recoivent leur document de la
  // main a la main. Sans ce marquage, ces documents restaient « Genere » a vie,
  // sans aucun moyen de rectifier — constate le 01/09/2026.
  //
  // On ecrit dans la meme colonne que l'envoi email (sent_at), en precisant le
  // canal. Le suivi reflete ainsi la realite, et l'ecran distingue les deux.
  const marquerRemis = async (row: ClientRow) => {
    if (!user || isLocked) return;
    if (row.docState === 'pending') {
      alert("Générez d'abord le document : on ne remet pas un document qui n'existe pas.");
      return;
    }

    const annule = row.docState === 'sent';
    if (annule && row.docChannel === 'email') {
      alert("Ce document a été envoyé par email : son envoi ne peut pas être annulé ici.");
      return;
    }
    const question = annule
      ? `Annuler la remise en main propre pour ${row.clientName} ?`
      : `Marquer le document de ${row.clientName} comme remis en main propre ?`;
    if (!window.confirm(question)) return;

    setSendingId(row.clientId);
    try {
      const isCESU = row.facturationMode === 'CESU';
      if (isCESU) {
        const period = await getOrCreatePeriod(selectedMonth, selectedYear);
        await upsertClientStatus(period.id, row.clientId, annule
          ? { status: 'generated', sent_at: null, sent_channel: null }
          : { status: 'sent', sent_at: Date.now(), sent_channel: 'hand' });
      } else {
        if (!row.invoiceId) { alert('Facture introuvable pour ce mois.'); return; }
        await updateInvoice(row.invoiceId, annule
          ? { status: 'draft', sent_at: null, sent_channel: null }
          : { status: 'sent', sent_at: Date.now(), sent_channel: 'hand' });
      }
    } catch (e: any) {
      console.error('Marquage remis échoué:', e);
      alert(`Échec : ${e?.message || e}

(La colonne sent_channel existe-t-elle en base ? Voir supabase-migration-sent-channel.sql)`);
    } finally {
      setSendingId(null);
    }
  };

  // Envoi en masse : un email par client (le mandataire reçoit un dossier par bénéficiaire).
  // Séquentiel — chaque PDF passe par html2canvas, les paralléliser saturerait le navigateur.
  const handleSendBulkCesu = async () => {
    const targets = groups
      .flatMap((g) => g.clients)
      .filter((r) => r.facturationMode === 'CESU' && r.timesheetCount > 0 && !!r.recipientEmail);
    if (targets.length === 0) {
      alert('Aucun client CESU avec un email destinataire ce mois.');
      return;
    }
    const drafts = targets.filter((r) => r.hasDraftTimesheets).length;
    const already = targets.filter((r) => r.docState === 'sent').length;
    const details = [
      drafts > 0 ? `⚠️ ${drafts} client${drafts > 1 ? 's ont' : ' a'} des pointages NON VALIDÉS.` : '',
      already > 0 ? `${already} déjà envoyé${already > 1 ? 's' : ''} — ils seront renvoyés.` : '',
    ].filter(Boolean).join('\n');
    if (!window.confirm(
      `Envoyer ${targets.length} relevé${targets.length > 1 ? 's' : ''} CESU (${MONTHS[selectedMonth - 1]} ${selectedYear}), un email par client ?` +
      (details ? `\n\n${details}` : '')
    )) return;

    setSendProgress({ done: 0, total: targets.length });
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const sent = await sendCesuEmail(targets[i], { silent: true });
      if (sent) ok++; else failed.push(targets[i].clientName);
      setSendProgress({ done: i + 1, total: targets.length });
    }
    setSendProgress(null);
    alert(
      `${ok}/${targets.length} relevé${targets.length > 1 ? 's' : ''} envoyé${ok > 1 ? 's' : ''}.` +
      (failed.length ? `\n\nÉchecs : ${failed.join(', ')}` : '')
    );
  };

  // ── Facture indépendante (société B2B, lignes libres) ───────────────────────

  const openSocieteModal = (row: ClientRow) => {
    setSocieteLines([{ designation: '', quantity: 1, unit_price: 0 }]);
    const today = new Date();
    setSocieteDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setSocieteModal(row);
  };

  const societeTotal = societeLines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0,
  );

  const handleGenerateSociete = async () => {
    if (!user || !userProfile || !societeModal) return;
    const client = clients.find((c) => c.id === societeModal.clientId);
    if (!client) return;
    const validLines: InvoiceLine[] = societeLines
      .filter((l) => l.designation.trim() && (Number(l.quantity) || 0) > 0)
      .map((l) => ({ designation: l.designation.trim(), quantity: Number(l.quantity), unit_price: Number(l.unit_price) || 0 }));
    if (validLines.length === 0) { alert('Ajoutez au moins une ligne (désignation + quantité).'); return; }

    const dateMs = societeDate ? new Date(societeDate).getTime() : Date.now();
    const d = new Date(dateMs);
    const invMonth = d.getMonth() + 1;
    const invYear = d.getFullYear();
    const total = Math.round(validLines.reduce((s, l) => s + l.quantity * l.unit_price, 0) * 100) / 100;
    const invoiceNumber = nextInvoiceNumber(invoices, invYear);

    setGenerating(societeModal.clientId);
    try {
      const invoiceData: any = {
        invoice_number: invoiceNumber,
        created_at: Date.now(),
        generated_at: dateMs,
        total_amount: total,
        month: invMonth,
        year: invYear,
        lines: validLines,
      };
      const html = generateClassicalTemplate(invoiceData, client, [], userProfile, undefined, getContactsForClient(client.id), validLines);
      await generateAndSharePDF(html, invoiceNumber);

      // Enregistrement (suivi dans le module Factures) — soft-fail comme les autres.
      try {
        await addInvoice({
          invoice_number: invoiceNumber,
          client_id: client.id,
          status: 'draft', // créée mais non envoyée → à valider/envoyer depuis l'onglet Factures
          total_amount: total,
          month: invMonth,
          year: invYear,
          lines: validLines,
          generated_at: dateMs,
          facturation_mode: 'CLASSICAL',
        });
      } catch (e) {
        console.warn('[Société→Factures] suivi non enregistré (migration lines/invoices ?) :', e);
      }
      setSocieteModal(null);
    } catch (err) {
      console.error('Génération facture société échouée:', err);
      alert('Erreur lors de la génération de la facture.');
    } finally {
      setGenerating(null);
    }
  };

  // ── Génération en masse ────────────────────────────────────────────────────

  const handleGenerateBulk = async (mode: 'CESU' | 'CLASSICAL', force: boolean) => {
    if (isLocked || !user || !userProfile) return;
    const allClients = groups.flatMap((g) => g.clients);
    const targets = allClients.filter((r) =>
      r.facturationMode === mode &&
      r.timesheetCount > 0 &&
      (force || r.docState === 'pending')
    );
    if (targets.length === 0) return;
    setBulkProgress({ done: 0, total: targets.length, mode });
    for (let i = 0; i < targets.length; i++) {
      await handleGenerate(targets[i]);
      setBulkProgress({ done: i + 1, total: targets.length, mode });
    }
    setBulkProgress(null);
  };

  const handleExportRecap = async () => {
    if (totalClientsActive === 0 || !user || !userProfile) return;
    setGenerating('recap');
    try {
      const filename = `Recap_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`;
      const html = generateRecapTemplate({
        month: selectedMonth,
        year: selectedYear,
        groups,
        totals: {
          hours: totalHours,
          earnings: totalEarnings,
          frais: totalFrais,
          amount: totalMontant,
          clientCount: totalClientsActive,
        },
        user: userProfile,
      });
      await generateAndSharePDF(html, filename);
    } catch (err) {
      console.error('Export récap échoué:', err);
    } finally {
      setGenerating(null);
    }
  };

  const startBulk = (mode: 'CESU' | 'CLASSICAL') => {
    if (isLocked) return;
    const targets = groups.flatMap((g) => g.clients).filter(
      (r) => r.facturationMode === mode && r.timesheetCount > 0
    );
    if (targets.length === 0) {
      alert(`Aucun client ${mode === 'CESU' ? 'CESU' : 'classique'} avec des pointages ce mois.`);
      return;
    }
    const alreadyGen = targets.filter((r) => r.docState === 'generated' || r.docState === 'sent').length;
    if (alreadyGen > 0) {
      setConfirmBulk({ mode, alreadyGen, pending: targets.length - alreadyGen });
      return;
    }
    handleGenerateBulk(mode, false);
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const exportToCSV = async () => {
    const headers = ['Date', 'Client', 'Arrivée', 'Départ', 'Heures', 'Taux', 'Salaire', 'IK', 'Repas', 'Transport', 'Autres', 'Total'];
    const rows = monthTimesheets.map((ts) => {
      const client = clients.find((c) => c.id === ts.client_id);
      const rate = client?.hourly_rate || 0;
      const earnings = ts.duration * rate;
      const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0));
      const isDuree = isDureeDirecte(ts);
      return [
        new Date(ts.date_arrival).toLocaleDateString('fr-FR'),
        client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : '',
        isDuree ? '' : new Date(ts.date_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isDuree ? '' : new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ts.duration.toFixed(2), rate.toFixed(2), earnings.toFixed(2),
        (Math.max(0, ts.ik_amount || 0)).toFixed(2),
        (ts.frais_repas || 0).toFixed(2), (ts.frais_transport || 0).toFixed(2), (ts.frais_autres || 0).toFixed(2),
        (earnings + frais).toFixed(2),
      ].join(';');
    });
    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const filename = `rapport_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = btoa(unescape(encodeURIComponent(csv)));
        const result = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
        await Share.share({ title: 'Export CSV', url: result.uri, dialogTitle: 'Partager le CSV' });
      } catch (error: any) {
        alert(`Erreur export : ${error?.message || 'Erreur'}`);
      }
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  // ── Clôture ────────────────────────────────────────────────────────────────

  const handleLock = async () => {
    setLocking(true);
    try {
      const period = currentPeriod || await getOrCreatePeriod(selectedMonth, selectedYear);
      await lockPeriod(period.id);
      setConfirmLock(false);
    } finally { setLocking(false); }
  };

  const pastPeriods = useMemo(() =>
    [...periods].filter((p) => !(p.month === selectedMonth && p.year === selectedYear))
      .sort((a, b) => b.year - a.year || b.month - a.month),
    [periods, selectedMonth, selectedYear]
  );

  const navigateToPeriod = (p: BillingPeriod) => { setSelectedMonth(p.month); setSelectedYear(p.year); setShowHistory(false); };

  // ── Données NOVA (trimestriel) ─────────────────────────────────────────
  const novaData = useMemo(() => {
    // Déterminer le trimestre du mois sélectionné
    const quarter = Math.floor((selectedMonth - 1) / 3); // 0=T1, 1=T2, 2=T3, 3=T4
    const monthsInQuarter = [quarter * 3 + 1, quarter * 3 + 2, quarter * 3 + 3];
    const quarterLabel = `T${quarter + 1} ${selectedYear}`;

    const months = monthsInQuarter.map((m) => {
      const s = new Date(selectedYear, m - 1, 1).getTime();
      const e = new Date(selectedYear, m, 0, 23, 59, 59).getTime();
      const mTs = timesheets.filter((ts) => ts.date_arrival >= s && ts.date_arrival <= e);
      const hours = mTs.reduce((sum, ts) => sum + ts.duration, 0);
      const distinctClients = new Set(mTs.map((ts) => ts.client_id)).size;
      const ca = mTs.reduce((sum, ts) => {
        const client = clients.find((c) => c.id === ts.client_id);
        return sum + Math.round(ts.duration * (client?.hourly_rate || 0) * 100) / 100;
      }, 0);
      return {
        label: MONTHS[m - 1],
        hours: Math.ceil(hours),
        clients: distinctClients,
        ca,
      };
    });

    return { quarterLabel, months, monthsInQuarter };
  }, [timesheets, selectedMonth, selectedYear]);

  // ── Données URSSAF (trimestriel) — CA ENCAISSÉ du trimestre ─────────────────
  // Déclaration micro-entrepreneur = CA encaissé → on rattache chaque facture payée
  // à son mois de PAIEMENT (`paid_at`), pas à sa date de facture. CESU emploi direct
  // (non facturé) exclu de fait. Les factures payées sans date d'encaissement sont
  // signalées (à compléter dans l'onglet Factures).
  const urssafData = useMemo(() => {
    const quarter = Math.floor((selectedMonth - 1) / 3);
    const monthsInQuarter = [quarter * 3 + 1, quarter * 3 + 2, quarter * 3 + 3];
    const quarterLabel = `T${quarter + 1} ${selectedYear}`;

    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const missingDate = paidInvoices.filter((i) => !i.paid_at).length;

    const months = monthsInQuarter.map((m) => {
      const paid = paidInvoices.filter((i) => {
        if (!i.paid_at) return false; // sans date d'encaissement → non rattaché
        const d = new Date(i.paid_at);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === m;
      });
      const autresCA = paid.reduce((s, i) => {
        const c = clients.find((cl) => cl.id === i.client_id);
        return c?.client_type === 'SOCIETE' ? s + (i.total_amount || 0) : s;
      }, 0);
      const total = paid.reduce((s, i) => s + (i.total_amount || 0), 0);
      return { label: MONTHS[m - 1], total, sapCA: total - autresCA, autresCA, count: paid.length };
    });

    const quarterTotal = months.reduce((s, m) => s + m.total, 0);
    return { quarterLabel, months, quarterTotal, missingDate };
  }, [invoices, clients, selectedMonth, selectedYear]);

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR');
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>Bilan — {MONTHS[selectedMonth - 1]} {selectedYear}</h2>
          {currentPeriod && (
            <span style={{
              padding: '3px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
              backgroundColor: PERIOD_STATUS_COLOR[currentPeriod.status] + '22',
              color: PERIOD_STATUS_COLOR[currentPeriod.status],
              border: `1px solid ${PERIOD_STATUS_COLOR[currentPeriod.status]}44`,
            }}>
              {PERIOD_STATUS_LABEL[currentPeriod.status]}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '8px 14px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: showHistory ? '#007AFF' : 'white', color: showHistory ? 'white' : '#333', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            Historique ({pastPeriods.length})
          </button>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Historique */}
      {showHistory && (
        <div style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Mois passés</h3>
          {pastPeriods.length === 0 ? (
            <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>Aucun mois enregistré</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {pastPeriods.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', borderRadius: '6px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{MONTHS[p.month - 1]} {p.year}</span>
                    <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: PERIOD_STATUS_COLOR[p.status] + '22', color: PERIOD_STATUS_COLOR[p.status] }}>
                      {PERIOD_STATUS_LABEL[p.status]}
                    </span>
                    {p.locked_at && <span style={{ fontSize: '12px', color: '#888' }}>Clôturé le {new Date(p.locked_at).toLocaleDateString('fr-FR')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigateToPeriod(p)} style={{ padding: '6px 12px', backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Voir</button>
                    {p.status === 'locked' && <button onClick={() => archivePeriod(p.id)} style={{ padding: '6px 12px', backgroundColor: '#888', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Archiver</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bannière verrouillé */}
      {isLocked && (
        <div style={{ background: isArchived ? '#f5f5f5' : '#FFF8E7', border: `1px solid ${isArchived ? '#ddd' : '#FF9500'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: isArchived ? '#888' : '#FF9500' }}>
            {isArchived ? 'Mois archivé — lecture seule' : 'Mois clôturé — aucune modification possible'}
          </span>
          {!isArchived && <button onClick={() => unlockPeriod(currentPeriod!.id)} style={{ padding: '6px 14px', backgroundColor: 'white', color: '#FF9500', border: '1px solid #FF9500', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Rouvrir</button>}
        </div>
      )}

      {/* Résumé global — 5 cartes */}
      {/* auto-fit plutot que repeat(5, 1fr) : a 5 colonnes fixes, chaque carte
          tombait sous 70px sur un telephone et la derniere debordait a droite,
          hors de l'ecran. Avec minmax(110px), on obtient 3+2 sur mobile et les
          5 d'un trait des que la largeur le permet. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="Heures" value={`${totalHours.toFixed(1)}h`} bg="#EBF9F0" color="#2d8a4e" />
        <StatCard label="Clients actifs" value={String(totalClientsActive)} bg="#E8F4FF" color="#1a6fb5" />
        <StatCard label="Salaire" value={`${totalEarnings.toFixed(0)}€`} bg="#F0EBFF" color="#5b3db5" />
        <StatCard label="Frais" value={`${totalFrais.toFixed(0)}€`} bg="#FFF4E5" color="#b36b00" />
        <StatCard label="Total" value={`${totalMontant.toFixed(0)}€`} bg="#007AFF" color="#fff" />
      </div>

      {/* Alertes */}
      {!isLocked && warnings.length > 0 && (
        <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', color: '#856400', marginBottom: '6px', fontSize: '13px' }}>Points d'attention avant clôture</div>
          {warnings.map((w, i) => <div key={i} style={{ color: '#856400', fontSize: '13px' }}>• {w}</div>)}
        </div>
      )}

      {/* Sous-navigation : Documents | Chronologie | CSV */}
      {/* Cette barre ne porte pas que les onglets : URSSAF, NOVA et Export CSV
          s'y trouvent aussi. Sans flexWrap, les trois boutons sortaient de
          l'ecran a droite sur mobile — donc inatteignables (constate sur
          Pixel 9a le 2026-09-03). Ils passent desormais a la ligne. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: '8px', gap: '0', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
        {([
          { id: 'documents' as SubView, label: `Documents (${totalClientsActive})` },
          { id: 'chronologie' as SubView, label: `Chronologie (${monthTimesheets.length})` },
          { id: 'synthese' as SubView, label: `Synthèse` },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setSubView(tab.id)}
            style={{
              // Padding et corps reduits sur mobile : a 20px/14px les trois onglets
              // depassaient les 371px disponibles et « Synthese » tombait seul sur
              // une deuxieme ligne (mesure sur Pixel 9a, 411px CSS).
              padding: isMobile ? '10px 8px' : '10px 20px', border: 'none', borderBottom: subView === tab.id ? '3px solid #007AFF' : '3px solid transparent',
              backgroundColor: 'transparent', color: subView === tab.id ? '#007AFF' : '#888',
              fontWeight: subView === tab.id ? 'bold' : 'normal', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer', marginBottom: '-2px',
            }}>
            {tab.label}
          </button>
        ))}
        {/* Sur mobile, cet element force le retour a la ligne (flexBasis 100%)
            pour que les boutons d'action forment leur propre rangee au lieu de
            s'intercaler entre les onglets. Sur grand ecran il reste un simple
            ressort qui les repousse a droite. */}
        <div style={isMobile ? { flexBasis: '100%', height: 0 } : { flex: 1 }} />
        <button onClick={() => setShowUrssaf(true)}
          style={{ padding: '8px 16px', backgroundColor: '#00897B', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'center', marginBottom: '4px', marginRight: '8px' }}>
          URSSAF
        </button>
        <button onClick={() => setShowNova(true)}
          style={{ padding: '8px 16px', backgroundColor: '#AF52DE', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'center', marginBottom: '4px', marginRight: '8px' }}>
          NOVA
        </button>
        <button onClick={exportToCSV} disabled={monthTimesheets.length === 0}
          style={{ padding: '8px 16px', backgroundColor: monthTimesheets.length === 0 ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '6px', cursor: monthTimesheets.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px', alignSelf: 'center', marginBottom: '4px' }}>
          Export CSV
        </button>
      </div>

      {/* ══════ VUE DOCUMENTS — groupé par mandataire ══════ */}
      {subView === 'documents' && (
        <>
          {groups.map((group, gi) => {
            const groupLabel = group.mandataire
              ? `${[group.mandataire.titre, group.mandataire.first_name, group.mandataire.name].filter(Boolean).join(' ')} — ${group.mandataire.association_name}`
              : 'Sans mandataire';
            const borderColor = group.mandataire ? '#007AFF' : '#ccc';

            return (
              <div key={gi} style={{ marginBottom: '16px', border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: group.mandataire ? '#E8F4FF' : '#f5f5f5', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: group.mandataire ? '#1a6fb5' : '#666' }}>{groupLabel}</div>
                    {group.recipientEmail && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>✉️ {group.recipientEmail}</div>}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{group.totalAmount.toFixed(2)}€</span>
                </div>

                {group.clients.map((row) => {
                  const isSociete = row.clientType === 'SOCIETE';
                  const isCESU = row.facturationMode === 'CESU';
                  const color = isSociete ? '#5856D6' : isCESU ? '#34C759' : '#007AFF';
                  // Société : facture indépendante (lignes libres), pas de pointage → toujours actionnable.
                  if (isSociete) {
                    return (
                      <div key={row.clientId} style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{row.clientName}</span>
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: '#F0EBFF', color, border: `1px solid ${color}` }}>
                              🏢 SOCIÉTÉ
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#888' }}>Facture indépendante (B2B, hors champ SAP)</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isLocked && (
                            <button disabled={generating === row.clientId} onClick={() => openSocieteModal(row)}
                              style={{ padding: '7px 14px', backgroundColor: generating === row.clientId ? '#ccc' : color, color: 'white', border: 'none', borderRadius: '6px', cursor: generating === row.clientId ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                              {generating === row.clientId ? '...' : '+ Facture indépendante'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={row.clientId} style={{ padding: '14px 16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', opacity: row.timesheetCount === 0 ? 0.45 : 1 }}>
                      <div style={{ flex: 1, cursor: row.timesheetCount > 0 ? 'pointer' : 'default' }}
                        onClick={() => row.timesheetCount > 0 && setDetailClient(row)}
                        title={row.timesheetCount > 0 ? 'Voir le détail des pointages' : ''}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{row.clientName}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: isCESU ? '#EBF9F0' : '#E8F4FF', color, border: `1px solid ${color}` }}>
                            {isCESU ? 'CESU' : 'CLASSIQUE'}
                          </span>
                          {row.timesheetCount > 0 && <span style={{ fontSize: '10px', color: '#888' }}>↗ détail</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {row.timesheetCount === 0 ? 'Aucun pointage ce mois' :
                            `${row.timesheetCount} pointage${row.timesheetCount > 1 ? 's' : ''} · ${row.totalHours.toFixed(1)}h · ${row.totalEarnings.toFixed(2)}€${row.totalFrais > 0 ? ` + ${row.totalFrais.toFixed(2)}€ frais` : ''}`
                          }
                          {row.hasDraftTimesheets && row.timesheetCount > 0 && <span style={{ marginLeft: '8px', color: '#FF9500', fontWeight: 'bold' }}>non validés</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BadgeDoc etat={row.docState} sentAt={row.docSentAt} canal={row.docChannel} compact={isMobile} />
                        {row.timesheetCount > 0 && !isLocked && (
                          <button disabled={generating === row.clientId} onClick={() => handleGenerate(row)}
                            style={{ padding: '7px 14px', backgroundColor: generating === row.clientId ? '#ccc' : color, color: 'white', border: 'none', borderRadius: '6px', cursor: generating === row.clientId ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {generating === row.clientId ? '...' : isCESU ? (row.docState === 'pending' ? 'Pointage CESU' : 'Regénérer') : (row.docState === 'pending' ? 'Facture' : 'Regénérer')}
                          </button>
                        )}
                        {isCESU && row.timesheetCount > 0 && !isLocked && (
                          <button
                            disabled={sendingId === row.clientId || !!sendProgress || !row.recipientEmail}
                            onClick={() => sendCesuEmail(row)}
                            title={row.recipientEmail ? `Envoyer à ${row.recipientEmail}` : 'Aucun email destinataire (mandataire ou client)'}
                            style={{ padding: '7px 14px', backgroundColor: (sendingId === row.clientId || !!sendProgress || !row.recipientEmail) ? '#ccc' : '#5856D6', color: 'white', border: 'none', borderRadius: '6px', cursor: (sendingId === row.clientId || !!sendProgress || !row.recipientEmail) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {sendingId === row.clientId ? 'Envoi…' : row.docState === 'sent' ? '✉️ Renvoyer' : '✉️ Envoyer'}
                          </button>
                        )}
                        {/* Remise en main propre. Masque pour un document deja parti par
                            email : on n'annule pas un envoi, et il est deja marque. */}
                        {row.docState !== 'pending' && !isLocked
                          && !(row.docState === 'sent' && row.docChannel === 'email') && (
                          <button disabled={sendingId === row.clientId} onClick={() => marquerRemis(row)}
                            title={row.docState === 'sent' ? 'Annuler la remise en main propre' : 'Marquer comme remis en main propre'}
                            style={{ padding: '7px 12px', backgroundColor: 'white',
                              color: row.docState === 'sent' ? '#888' : '#5856D6',
                              border: `1px solid ${row.docState === 'sent' ? '#ccc' : '#5856D6'}`,
                              borderRadius: '6px', cursor: sendingId === row.clientId ? 'not-allowed' : 'pointer',
                              fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {row.docState === 'sent' ? (isMobile ? '↩' : '↩ Annuler') : (isMobile ? '🤝' : '🤝 Remis')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Génération en masse */}
          {!isLocked && totalClientsActive > 0 && (() => {
            const all = groups.flatMap((g) => g.clients).filter((r) => r.timesheetCount > 0);
            const cesuCount = all.filter((r) => r.facturationMode === 'CESU').length;
            const cesuSendable = all.filter((r) => r.facturationMode === 'CESU' && !!r.recipientEmail).length;
            const classicCount = all.filter((r) => r.facturationMode === 'CLASSICAL').length;
            return (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {cesuCount > 0 && (
                  <button onClick={() => startBulk('CESU')} disabled={!!bulkProgress}
                    style={{ padding: '12px 24px', backgroundColor: bulkProgress ? '#ccc' : '#34C759', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    Générer tous les CESU ({cesuCount})
                  </button>
                )}
                {cesuSendable > 0 && (
                  <button onClick={handleSendBulkCesu} disabled={!!bulkProgress || !!sendProgress}
                    title="Un email par client, au mandataire quand il y en a un"
                    style={{ padding: '12px 24px', backgroundColor: (bulkProgress || sendProgress) ? '#ccc' : '#5856D6', color: 'white', border: 'none', borderRadius: '8px', cursor: (bulkProgress || sendProgress) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    ✉️ Envoyer tous les CESU ({cesuSendable})
                  </button>
                )}
                {classicCount > 0 && (
                  <button onClick={() => startBulk('CLASSICAL')} disabled={!!bulkProgress}
                    style={{ padding: '12px 24px', backgroundColor: bulkProgress ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    Générer toutes les factures ({classicCount})
                  </button>
                )}
              </div>
            );
          })()}

          {/* Progression bulk */}
          {bulkProgress && (
            <div style={{ marginTop: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Génération {bulkProgress.mode === 'CESU' ? 'CESU' : 'factures'} en cours… <strong>{bulkProgress.done}/{bulkProgress.total}</strong>
            </div>
          )}

          {/* Progression envoi CESU */}
          {sendProgress && (
            <div style={{ marginTop: '12px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Envoi des relevés CESU en cours… <strong>{sendProgress.done}/{sendProgress.total}</strong>
            </div>
          )}

          {/* Bouton clôture */}
          {!isLocked && totalClientsActive > 0 && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button onClick={() => setConfirmLock(true)} disabled={!!bulkProgress}
                style={{ padding: '14px 36px', backgroundColor: bulkProgress ? '#ccc' : '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                Clôturer {MONTHS[selectedMonth - 1]} {selectedYear}
              </button>
              <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>Les pointages ne pourront plus être modifiés pour ce mois.</p>
            </div>
          )}
        </>
      )}

      {/* ══════ VUE CHRONOLOGIE ══════ */}
      {subView === 'chronologie' && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {monthTimesheets.length === 0 ? (
            <div style={{ backgroundColor: '#f9f9f9', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>
              Aucun pointage pour {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : monthTimesheets.map((ts) => {
            const client = clients.find((c) => c.id === ts.client_id);
            const rate = client?.hourly_rate || 0;
            const earnings = ts.duration * rate;
            const frais = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + (Math.max(0, ts.ik_amount || 0));
            const isCESU = client?.facturation_mode === 'CESU';
            const color = isCESU ? '#34C759' : '#007AFF';
            return (
              <div key={ts.id} style={{ backgroundColor: 'white', padding: '14px 16px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{client ? [client.titre, client.first_name, client.name].filter(Boolean).join(' ') : 'Inconnu'}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', backgroundColor: isCESU ? '#EBF9F0' : '#E8F4FF', color }}>
                      {isCESU ? 'CESU' : 'CLASS.'}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '10px',
                      backgroundColor: ts.status === 'validated' ? '#EBF9F0' : '#FFF4E5',
                      color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00',
                    }}>
                      {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {formatDate(ts.date_arrival)}
                    {!isDureeDirecte(ts) && ` · ${formatTime(ts.date_arrival)} → ${formatTime(ts.date_departure)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#007AFF' }}>{ts.duration.toFixed(1)}h</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {earnings.toFixed(2)}€{frais > 0 ? ` + ${frais.toFixed(2)}€` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ VUE SYNTHESE ══════ */}
      {subView === 'synthese' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Synthèse {MONTHS[selectedMonth - 1]} {selectedYear}</h3>
            <button onClick={handleExportRecap} disabled={totalClientsActive === 0 || generating === 'recap'}
              style={{ padding: '10px 20px', backgroundColor: (totalClientsActive === 0 || generating === 'recap') ? '#ccc' : '#5b3db5', color: 'white', border: 'none', borderRadius: '8px', cursor: (totalClientsActive === 0 || generating === 'recap') ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {generating === 'recap' ? 'Export…' : 'Exporter récap PDF'}
            </button>
          </div>

          {totalClientsActive === 0 ? (
            <div style={{ background: '#f9f9f9', padding: '40px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>
              Aucun pointage pour {MONTHS[selectedMonth - 1]} {selectedYear}
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', overflowX: 'auto', border: '1px solid #eee' }}>
              {/* overflowX auto, et non overflow hidden : les 7 colonnes ne tiennent
                  pas dans un telephone, et 'hidden' les rognait purement et
                  simplement — Frais et Total etaient invisibles, sans moyen de les
                  atteindre. minWidth force le defilement plutot que l'ecrasement. */}
              <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Client</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Mode</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Document</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Heures</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Salaire</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Frais</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600', color: '#666', borderBottom: '2px solid #ddd' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const activeRows = group.clients.filter((r) => r.timesheetCount > 0);
                    if (activeRows.length === 0) return null;
                    return (
                      <React.Fragment key={group.mandataire?.id || '__none__'}>
                        {group.mandataire && (
                          <tr style={{ background: '#E8F4FF' }}>
                            <td colSpan={7} style={{ padding: '8px 14px', fontWeight: 'bold', color: '#1a6fb5', fontSize: '12px' }}>
                              {[group.mandataire.titre, group.mandataire.first_name, group.mandataire.name].filter(Boolean).join(' ')} — {group.mandataire.association_name}
                            </td>
                          </tr>
                        )}
                        {activeRows.map((row) => (
                          <tr key={row.clientId} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                            onClick={() => setDetailClient(row)}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <td style={{ padding: '10px 14px', fontWeight: '500' }}>{row.clientName}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', backgroundColor: row.facturationMode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color: row.facturationMode === 'CESU' ? '#2d8a4e' : '#1a6fb5' }}>
                                {row.facturationMode === 'CESU' ? 'CESU' : 'CLASS.'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <BadgeDoc etat={row.docState} sentAt={row.docSentAt} canal={row.docChannel} compact={isMobile} />
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalHours.toFixed(2)}h</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalEarnings.toFixed(2)}€</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalFrais > 0 ? `${row.totalFrais.toFixed(2)}€` : '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>{row.totalAmount.toFixed(2)}€</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr style={{ backgroundColor: '#5b3db5', color: 'white', fontWeight: 'bold' }}>
                    <td colSpan={3} style={{ padding: '14px', fontSize: '14px' }}>TOTAUX — {totalClientsActive} client{totalClientsActive > 1 ? 's' : ''}</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalHours.toFixed(2)}h</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalEarnings.toFixed(2)}€</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>{totalFrais.toFixed(2)}€</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '15px' }}>{totalMontant.toFixed(2)}€</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal confirmation clôture */}
      {confirmLock && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setConfirmLock(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px' }}>Clôturer le mois ?</h2>
            <p style={{ color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
              Vous allez clôturer <strong>{MONTHS[selectedMonth - 1]} {selectedYear}</strong>.
            </p>
            {warnings.length > 0 && (
              <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px' }}>
                {warnings.map((w, i) => <div key={i} style={{ color: '#856400', fontSize: '13px' }}>• {w}</div>)}
              </div>
            )}
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>Vous pourrez rouvrir le mois si nécessaire.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmLock(false)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button onClick={handleLock} disabled={locking} style={{ flex: 1, padding: '12px', background: locking ? '#ccc' : '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: locking ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {locking ? 'Clôture...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail pointages d'un client */}
      {detailClient && (() => {
        const clientTs = monthTimesheets.filter((ts) => ts.client_id === detailClient.clientId);
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setDetailClient(null)}>
            <div style={{ background: 'white', padding: '24px 28px', borderRadius: '12px', width: '92%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '19px' }}>{detailClient.clientName}</h2>
                  <p style={{ margin: '2px 0 0', color: '#888', fontSize: '13px' }}>
                    {MONTHS[selectedMonth - 1]} {selectedYear} · {detailClient.timesheetCount} pointage{detailClient.timesheetCount > 1 ? 's' : ''} · {detailClient.totalHours.toFixed(2)}h · {detailClient.totalAmount.toFixed(2)}€
                  </p>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: detailClient.facturationMode === 'CESU' ? '#EBF9F0' : '#E8F4FF', color: detailClient.facturationMode === 'CESU' ? '#2d8a4e' : '#1a6fb5' }}>
                  {detailClient.facturationMode === 'CESU' ? 'CESU' : 'CLASSIQUE'}
                </span>
              </div>

              <div style={{ marginTop: '18px', display: 'grid', gap: '6px' }}>
                {clientTs.map((ts) => {
                  const fraisJour = (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0) + Math.max(0, ts.ik_amount || 0);
                  return (
                    <div key={ts.id} style={{ background: '#f9f9fb', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderLeft: ts.status === 'validated' ? '3px solid #34C759' : '3px solid #FF9500' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
                          {formatDate(ts.date_arrival)}
                          {!isDureeDirecte(ts) && <span style={{ color: '#666' }}> · {formatTime(ts.date_arrival)} → {formatTime(ts.date_departure)}</span>}
                        </div>
                        {ts.description && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{ts.description}</div>}
                        {fraisJour > 0 && (
                          <div style={{ fontSize: '11px', color: '#b36b00', marginTop: '2px' }}>
                            Frais : {fraisJour.toFixed(2)}€
                            {(ts.ik_amount || 0) > 0 && ` · IK ${(ts.ik_amount || 0).toFixed(2)}€`}
                            {(ts.frais_repas || 0) > 0 && ` · Repas ${ts.frais_repas.toFixed(2)}€`}
                            {(ts.frais_transport || 0) > 0 && ` · Transport ${ts.frais_transport.toFixed(2)}€`}
                            {(ts.frais_autres || 0) > 0 && ` · Autres ${ts.frais_autres.toFixed(2)}€`}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#007AFF' }}>{ts.duration.toFixed(2)}h</div>
                        <div style={{ fontSize: '10px', color: ts.status === 'validated' ? '#2d8a4e' : '#b36b00', fontWeight: '600', textTransform: 'uppercase' }}>
                          {ts.status === 'validated' ? 'Validé' : 'Brouillon'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailClient(null)}
                  style={{ padding: '10px 22px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal facture indépendante (société B2B) */}
      {societeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setSocieteModal(null)}>
          <div style={{ background: 'white', padding: '24px 28px', borderRadius: '12px', width: '94%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: '19px' }}>Facture indépendante — {societeModal.clientName}</h2>
            <p style={{ margin: '4px 0 18px', color: '#888', fontSize: '13px' }}>
              Société B2B, hors champ SAP · n° attribué automatiquement ({nextInvoiceNumber(invoices, societeDate ? new Date(societeDate).getFullYear() : selectedYear)})
            </p>

            <div style={{ marginBottom: '16px', maxWidth: '220px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>Date de la facture</label>
              <input type="date" value={societeDate} onChange={(e) => setSocieteDate(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            {/* Éditeur de lignes */}
            <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '8px', padding: '8px 12px', background: '#f5f5f5', fontSize: '12px', color: '#666', fontWeight: 600 }}>
                <span>Désignation</span><span style={{ textAlign: 'center' }}>Qté</span><span style={{ textAlign: 'right' }}>PU HT</span><span style={{ textAlign: 'right' }}>Total</span><span />
              </div>
              {societeLines.map((l, idx) => {
                const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                const updateLine = (patch: Partial<InvoiceLine>) =>
                  setSocieteLines(societeLines.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 90px 32px', gap: '8px', padding: '8px 12px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
                    <input type="text" value={l.designation} onChange={(e) => updateLine({ designation: e.target.value })}
                      placeholder="Prestation…" style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', width: '100%' }} />
                    <input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine({ quantity: parseFloat(e.target.value) })}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', width: '100%', textAlign: 'center' }} />
                    <input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine({ unit_price: parseFloat(e.target.value) })}
                      style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', width: '100%', textAlign: 'right' }} />
                    <span style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{lineTotal.toFixed(2)} €</span>
                    <button type="button" onClick={() => setSocieteLines(societeLines.length > 1 ? societeLines.filter((_, i) => i !== idx) : societeLines)}
                      style={{ padding: '4px', background: '#ff3b30', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>×</button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setSocieteLines([...societeLines, { designation: '', quantity: 1, unit_price: 0 }])}
              style={{ padding: '8px 14px', background: 'white', border: '1px dashed #5856D6', borderRadius: '6px', color: '#5856D6', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
              + Ajouter une ligne
            </button>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#555', fontWeight: 'bold' }}>Total HT</span>
              <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{societeTotal.toFixed(2)} €</span>
            </div>
            <p style={{ fontSize: '11px', color: '#999', textAlign: 'right', margin: '0 0 18px' }}>TVA non applicable, art. 293 B du CGI · mentions B2B incluses sur le PDF · créée en brouillon (non envoyée)</p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSocieteModal(null)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button onClick={handleGenerateSociete} disabled={generating === societeModal.clientId}
                style={{ flex: 1, padding: '12px', background: generating === societeModal.clientId ? '#ccc' : '#5856D6', color: 'white', border: 'none', borderRadius: '8px', cursor: generating === societeModal.clientId ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {generating === societeModal.clientId ? 'Génération…' : 'Générer (brouillon)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation régénération en masse */}
      {confirmBulk && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setConfirmBulk(null)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px' }}>
              {confirmBulk.mode === 'CESU' ? 'Régénérer les CESU ?' : 'Régénérer les factures ?'}
            </h2>
            <p style={{ color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
              <strong>{confirmBulk.alreadyGen}</strong> document{confirmBulk.alreadyGen > 1 ? 's' : ''} déjà généré{confirmBulk.alreadyGen > 1 ? 's' : ''}.
              {confirmBulk.pending > 0 && <> {confirmBulk.pending} en attente.</>}
            </p>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>Régénérer remplacera les fichiers déjà téléchargés.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setConfirmBulk(null)}
                style={{ flex: '1 1 100px', padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Annuler
              </button>
              {confirmBulk.pending > 0 && (
                <button onClick={() => { const m = confirmBulk.mode; setConfirmBulk(null); handleGenerateBulk(m, false); }}
                  style={{ flex: '1 1 100px', padding: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Seulement les {confirmBulk.pending} en attente
                </button>
              )}
              <button onClick={() => { const m = confirmBulk.mode; setConfirmBulk(null); handleGenerateBulk(m, true); }}
                style={{ flex: '1 1 100px', padding: '12px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Tout régénérer ({confirmBulk.alreadyGen + confirmBulk.pending})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL URSSAF ══════ */}
      {showUrssaf && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowUrssaf(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '92%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Déclaration URSSAF</h2>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>{urssafData.quarterLabel} — micro-entrepreneur</p>
              </div>
              <span style={{ padding: '4px 12px', backgroundColor: '#00897B22', color: '#00897B', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #00897B44' }}>CA payé</span>
            </div>

            <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
              CA des <strong>factures marquées « payée »</strong> du trimestre (à recopier dans votre déclaration URSSAF). Pensez à tenir les statuts de factures à jour.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#888', borderBottom: '2px solid #ddd' }}></th>
                  {urssafData.months.map((m) => (
                    <th key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#333', borderBottom: '2px solid #ddd' }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#E8F4FF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Particuliers (SAP)</td>
                  {urssafData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '15px', fontWeight: 'bold', color: '#1a6fb5', borderBottom: '1px solid #eee' }}>{m.sapCA.toFixed(2)}€</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#F0EBFF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Sociétés (B2B)</td>
                  {urssafData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '15px', fontWeight: 'bold', color: '#5b3db5', borderBottom: '1px solid #eee' }}>{m.autresCA.toFixed(2)}€</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#EBF9F0', borderTop: '2px solid #00897B' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', color: '#00695C' }}>CA payé du mois</td>
                  {urssafData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#00695C' }}>{m.total.toFixed(2)}€</td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#EBF9F0', border: '1px solid #00897B', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#00695C', fontSize: '14px' }}>Total CA payé {urssafData.quarterLabel}</span>
              <span style={{ fontWeight: 'bold', color: '#00695C', fontSize: '22px' }}>{urssafData.quarterTotal.toFixed(2)}€</span>
            </div>

            <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#856400' }}>
              CA rattaché au mois de <strong>paiement</strong> (date d'encaissement). Les CESU en emploi direct (non facturés) ne sont pas comptés ici. Vérifiez avant déclaration.
              {urssafData.missingDate > 0 && (
                <div style={{ marginTop: '6px', fontWeight: 'bold', color: '#b36b00' }}>
                  ⚠️ {urssafData.missingDate} facture(s) « payée » sans date d'encaissement → renseignez-la dans l'onglet Factures pour qu'elles soient comptées.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowUrssaf(false)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Fermer
              </button>
              <a href="https://www.autoentrepreneur.urssaf.fr/" target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, padding: '12px', background: '#00897B', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Ouvrir URSSAF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL NOVA ══════ */}
      {showNova && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowNova(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '92%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Déclaration NOVA</h2>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>{novaData.quarterLabel} — Mode prestataire</p>
              </div>
              <span style={{ padding: '4px 12px', backgroundColor: '#AF52DE22', color: '#AF52DE', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #AF52DE44' }}>EMA</span>
            </div>

            <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
              Recopiez ces valeurs dans votre espace <strong>NOVA</strong> → Mes statistiques → Mes données d'activité → À saisir.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#888', borderBottom: '2px solid #ddd' }}></th>
                  {novaData.months.map((m) => (
                    <th key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#333', borderBottom: '2px solid #ddd' }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Intervenants</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#333', borderBottom: '1px solid #eee' }}>1</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Dont salarié</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#888', borderBottom: '1px solid #eee' }}>0</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#F0EBFF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Heures</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#5b3db5', borderBottom: '1px solid #eee' }}>{m.hours}</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#E8F4FF' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #eee' }}>Particuliers</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#1a6fb5', borderBottom: '1px solid #eee' }}>{m.clients}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px' }}>Masse salariale</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: '#888' }}>0</td>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#EBF9F0', borderTop: '2px solid #34C759' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', fontSize: '13px', color: '#2d8a4e' }}>CA (hors frais/IK)</td>
                  {novaData.months.map((m) => (
                    <td key={m.label} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#2d8a4e' }}>{m.ca.toFixed(2)}€</td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#FFF8E7', border: '1px solid #FFCC00', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#856400' }}>
              Les heures sont arrondies à l'entier supérieur. Le CA correspond aux heures × taux horaire (hors frais annexes, transport et IK).
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowNova(false)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Fermer
              </button>
              <a href="https://nova.entreprises.gouv.fr/" target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, padding: '12px', background: '#AF52DE', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Ouvrir NOVA
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
  return (
    <div style={{ background: bg, padding: '14px 10px', borderRadius: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color, letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
