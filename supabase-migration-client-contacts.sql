-- Migration : observations client + contacts additionnels
-- À exécuter dans SQL Editor de Supabase

-- 1. Champ observations sur clients (instructions spécifiques)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS observations TEXT;

-- 2. Table des contacts additionnels par client
CREATE TABLE IF NOT EXISTS client_contacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,        -- Ex: "Nicole et Colette", "Service paiement UDAF"
  email TEXT NOT NULL,
  notes TEXT,                 -- Info complémentaire
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 3. Désactiver RLS
ALTER TABLE client_contacts DISABLE ROW LEVEL SECURITY;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
