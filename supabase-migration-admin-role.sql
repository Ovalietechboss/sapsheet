-- Migration : ajout du rôle admin
-- À exécuter dans SQL Editor de Supabase

-- 1. Ajouter la colonne role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- 2. Mettre TON compte en admin (remplace par ton email)
UPDATE users SET role = 'admin' WHERE email = 'poumpoum6565@gmail.com';

-- Vérifie que ça a fonctionné :
-- SELECT id, email, role FROM users;
