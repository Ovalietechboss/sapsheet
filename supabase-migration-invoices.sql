-- Migration : crée la table `invoices` (ABSENTE en base → cause de "Erreur lors de la création").
-- Tout le module Factures (liste, statuts, import reprise 2026, attestation) écrit ici.
-- Schéma aligné sur le type Invoice (src/stores/invoiceStore.supabase.ts) + facturation_mode
-- utilisé par le code (InvoicesTab/BilansTab). ids = TEXT (générés côté app), timestamps = BIGINT (ms).
--
-- ⚠️ À APPLIQUER PAR LE PO (Supabase → SQL Editor), avec backup. Additif & idempotent.

CREATE TABLE IF NOT EXISTS invoices (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  total_amount     DOUBLE PRECISION NOT NULL DEFAULT 0,
  month            INTEGER,
  year             INTEGER,
  facturation_mode TEXT,
  generated_at     BIGINT,
  created_at       BIGINT,
  updated_at       BIGINT
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id   ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_year_month ON invoices(year, month);

-- RLS désactivée, cohérent avec billing_period_clients (app mono-utilisateur via clé anon).
-- À durcir plus tard si multi-utilisateurs (politique user_id = auth.uid()).
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
