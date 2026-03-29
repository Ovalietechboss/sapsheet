-- Migration : prénom + avatar sur users
-- À exécuter dans SQL Editor de Supabase

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
