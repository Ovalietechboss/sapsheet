-- Migration : horodatage de l'envoi email d'une facture (`sent_at`, ms epoch).
-- Renseigné quand la facture est envoyée par email (Edge Function send-invoice / Resend).
-- Sert au suivi (« envoyée le… ») et aux relances d'impayés.
-- Additif & idempotent. ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at BIGINT;
