-- Migration : système de clôture de mois
-- À exécuter dans SQL Editor de Supabase

-- 1. Table des périodes de facturation (une par mois/utilisateur)
CREATE TABLE IF NOT EXISTS billing_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'archived')),
  locked_at BIGINT,       -- timestamp de clôture
  notes TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(user_id, month, year)
);

-- 2. Table du suivi par client dans une période
CREATE TABLE IF NOT EXISTS billing_period_clients (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'sent', 'error')),
  doc_generated_at BIGINT,
  sent_at BIGINT,
  recipient_email TEXT,   -- email utilisé pour l'envoi
  notes TEXT,             -- retour mandataire / commentaire
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(period_id, client_id)
);

-- 3. Désactiver RLS (cohérent avec le reste)
ALTER TABLE billing_periods DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing_period_clients DISABLE ROW LEVEL SECURITY;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_billing_periods_user_id ON billing_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_periods_status ON billing_periods(status);
CREATE INDEX IF NOT EXISTS idx_billing_period_clients_period_id ON billing_period_clients(period_id);
CREATE INDEX IF NOT EXISTS idx_billing_period_clients_client_id ON billing_period_clients(client_id);
