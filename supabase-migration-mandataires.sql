-- Migration : table mandataires + refactoring clients
-- À exécuter dans SQL Editor de Supabase

-- 1. Créer la table mandataires
CREATE TABLE IF NOT EXISTS mandataires (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT,                        -- M., Mme., Dr., etc.
  name TEXT NOT NULL,                -- Nom de la personne (ex: "Jean Martin")
  association_name TEXT NOT NULL,    -- Nom de l'asso/entreprise (ex: "ADMR Paris")
  email TEXT NOT NULL,
  phone TEXT,
  siren TEXT,                        -- SIREN de l'association
  address TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 2. Désactiver RLS (cohérent avec le reste du schéma)
ALTER TABLE mandataires DISABLE ROW LEVEL SECURITY;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_mandataires_user_id ON mandataires(user_id);

-- 4. Ajouter email + mandataire_id sur clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mandataire_id TEXT REFERENCES mandataires(id) ON DELETE SET NULL;

-- 5. (Optionnel) Migrer les données existantes :
--    Créer un mandataire par client qui avait mandataire_name
--    À faire manuellement si nécessaire, selon les données en place.

-- 6. Supprimer les anciennes colonnes flat (après migration des données)
-- ALTER TABLE clients DROP COLUMN IF EXISTS mandataire_name;
-- ALTER TABLE clients DROP COLUMN IF EXISTS mandataire_email;
-- ALTER TABLE clients DROP COLUMN IF EXISTS mandataire_siren;
-- (commentées pour ne pas perdre de données existantes avant migration)
