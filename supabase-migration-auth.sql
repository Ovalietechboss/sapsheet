-- ============================================================
-- SAP Sheet - Migration : Supabase Auth + RLS
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- 1. Créer la table invoice_templates si elle n'existe pas
CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content_html TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_user_id ON invoice_templates(user_id);

-- 2. Ajouter la colonne auth_id à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- 3. Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- 4. Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "users_own_data" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "clients_own_data" ON clients;
DROP POLICY IF EXISTS "timesheets_own_data" ON timesheets;
DROP POLICY IF EXISTS "invoices_own_data" ON invoices;
DROP POLICY IF EXISTS "invoice_templates_own_data" ON invoice_templates;

-- 5. Policies pour la table users
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (auth_id = auth.uid());

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (auth_id = auth.uid());

-- 6. Policies pour les tables liées (via user_id -> users.id -> auth_id)
CREATE POLICY "clients_own_data" ON clients
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "timesheets_own_data" ON timesheets
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "invoices_own_data" ON invoices
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "invoice_templates_own_data" ON invoice_templates
  FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================================
-- ✅ Migration terminée !
-- Chaque utilisateur ne voit désormais que ses propres données.
-- ============================================================
