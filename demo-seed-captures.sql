-- =====================================================================
-- Jeu de démonstration pour les captures d'écran du Play Store
--
-- OBJECTIF : ne JAMAIS publier de capture montrant de vrais clients. Les
-- personnes accompagnées à domicile sont des personnes vulnérables ; leurs
-- noms et adresses n'ont rien à faire sur une fiche publique.
--
-- Ce script crée un compte de démonstration isolé, avec des données
-- entièrement fictives, à supprimer aussitôt les captures faites.
--
-- ⚠️  Il ÉCRIT dans la base de production. C'est volontaire et sans risque
--     pour les données existantes : tout est rattaché à `user_demo`, cloisonné
--     par RLS, et supprimé par la section de nettoyage en fin de fichier
--     (la cascade emporte clients, mandataires et pointages).
--     Un backup vérifié existe (workflow Backup DB).
-- =====================================================================


-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Créer le compte d'authentification (INTERFACE, pas SQL)
--
-- Supabase Dashboard → Authentication → Users → « Add user »
--   Email    : demo@domitemps.app
--   Password : (au choix, à noter — il servira aussi à Google pour la review)
--   ☑ Auto Confirm User   ← INDISPENSABLE, sinon la connexion sera refusée
--
-- Puis copier l'UID affiché et le coller ci-dessous.
-- ---------------------------------------------------------------------

-- 👉 Rien à faire ici : l'UID se colle directement dans l'INSERT de l'étape 2,
--    à la place de COLLER-ICI-L-UID (l'éditeur SQL de Supabase ne gère pas la
--    syntaxe \set de psql).


-- ---------------------------------------------------------------------
-- ÉTAPE 2 — Profil, mandataire et clients fictifs
-- ---------------------------------------------------------------------

INSERT INTO public.users (
  id, auth_id, email, first_name, display_name, type, role,
  address, phone, cesu_number, siren, business_name,
  created_at, updated_at
) VALUES (
  'user_demo', 'COLLER-ICI-L-UID', 'demo@domitemps.app',   -- 👈 UID du compte auth
  'Camille', 'DURAND', 'assistant', 'user',
  '12 rue des Lilas, 65000 Tarbes', '06 00 00 00 00',
  'CESU-DEMO-0000', '000000000', 'Services à domicile Camille Durand',
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

INSERT INTO public.mandataires (
  id, user_id, titre, first_name, name, association_name, email, phone, siren, address,
  created_at, updated_at
) VALUES (
  'mand_demo', 'user_demo', 'Mme', 'Claire', 'MOREAU',
  'Association Démo 65', 'contact@association-demo.test', '05 00 00 00 00', '000000001',
  '3 avenue de la Démonstration, 65000 Tarbes',
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

INSERT INTO public.clients (
  id, user_id, titre, first_name, name, email, address,
  facturation_mode, client_type, hourly_rate, mandataire_id, observations,
  created_at, updated_at
) VALUES
  ('cli_demo_1', 'user_demo', 'Mme', 'Jeanne',  'MARTIN',  NULL,
   '5 rue du Moulin, 65000 Tarbes',      'CESU',      'PARTICULIER', 24.00, 'mand_demo',
   'Aide au lever, préparation des repas', (EXTRACT(EPOCH FROM now())*1000)::bigint, (EXTRACT(EPOCH FROM now())*1000)::bigint),
  ('cli_demo_2', 'user_demo', 'M.',  'Robert',  'DUBOIS',  NULL,
   '18 chemin des Prés, 65310 Laloubère', 'CESU',      'PARTICULIER', 24.00, 'mand_demo',
   'Accompagnement courses le mardi',      (EXTRACT(EPOCH FROM now())*1000)::bigint, (EXTRACT(EPOCH FROM now())*1000)::bigint),
  ('cli_demo_3', 'user_demo', 'Mme', 'Simone',  'BERNARD', 'simone.bernard@exemple.test',
   '7 place de la Fontaine, 65000 Tarbes', 'CLASSICAL', 'PARTICULIER', 26.50, NULL,
   'Entretien du logement',                (EXTRACT(EPOCH FROM now())*1000)::bigint, (EXTRACT(EPOCH FROM now())*1000)::bigint),
  ('cli_demo_4', 'user_demo', 'M.',  'André',   'PETIT',   'andre.petit@exemple.test',
   '22 route de Bagnères, 65200 Pouzac',  'CLASSICAL', 'PARTICULIER', 26.50, NULL,
   NULL,                                   (EXTRACT(EPOCH FROM now())*1000)::bigint, (EXTRACT(EPOCH FROM now())*1000)::bigint);

INSERT INTO public.client_contacts (id, client_id, label, email, notes, created_at, updated_at)
VALUES ('cc_demo_1', 'cli_demo_1', 'Famille Martin', 'famille.martin@exemple.test',
        'Copie pour information', (EXTRACT(EPOCH FROM now())*1000)::bigint, (EXTRACT(EPOCH FROM now())*1000)::bigint);


-- ---------------------------------------------------------------------
-- ÉTAPE 3 — Pointages du mois en cours (16 interventions réparties)
-- Les écrans Pointages, Bilans et Accueil auront ainsi de quoi s'afficher.
-- ---------------------------------------------------------------------

WITH jours AS (
  SELECT d, date_trunc('month', now()) + ((d - 1) * interval '1 day') AS base
  FROM generate_series(1, 16) AS d
),
cl AS (
  SELECT id, row_number() OVER (ORDER BY id) AS n
  FROM public.clients WHERE user_id = 'user_demo'
)
INSERT INTO public.timesheets (
  id, user_id, client_id, date_arrival, date_departure, duration,
  description, status, frais_repas, frais_transport, frais_autres,
  ik_km, ik_rate, ik_amount, created_at, updated_at
)
SELECT
  'ts_demo_' || j.d,
  'user_demo',
  cl.id,
  (EXTRACT(EPOCH FROM j.base + interval '9 hours') * 1000)::bigint,
  (EXTRACT(EPOCH FROM j.base + interval '11 hours') * 1000)::bigint,
  2.00,
  CASE (j.d % 3)
    WHEN 0 THEN 'Assistance à domicile'
    WHEN 1 THEN 'Accompagnement courses'
    ELSE        'Entretien du logement'
  END,
  CASE WHEN j.d > 13 THEN 'draft' ELSE 'validated' END,
  0, 0, 0,
  CASE WHEN j.d % 4 = 0 THEN 12.0 ELSE 0 END,
  0.603,
  CASE WHEN j.d % 4 = 0 THEN ROUND(12.0 * 0.603, 2) ELSE 0 END,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint
FROM jours j
JOIN cl ON cl.n = ((j.d - 1) % 4) + 1;


-- ---------------------------------------------------------------------
-- ÉTAPE 4 — Contrôle
-- ---------------------------------------------------------------------

SELECT 'clients'    AS objet, count(*) FROM public.clients    WHERE user_id = 'user_demo'
UNION ALL SELECT 'pointages', count(*) FROM public.timesheets WHERE user_id = 'user_demo'
UNION ALL SELECT 'mandataires', count(*) FROM public.mandataires WHERE user_id = 'user_demo';
-- Attendu : 4 clients, 16 pointages, 1 mandataire.


-- =====================================================================
-- NETTOYAGE — à exécuter DÈS QUE LES CAPTURES SONT FAITES
--
-- La cascade sur user_id supprime clients, mandataires, pointages, contacts
-- et périodes. Ne pas oublier de supprimer AUSSI le compte d'authentification
-- dans Supabase Dashboard → Authentication → Users.
-- =====================================================================

-- DELETE FROM public.users WHERE id = 'user_demo';
--
-- Vérification (doit renvoyer 0 partout) :
-- SELECT count(*) FROM public.clients    WHERE user_id = 'user_demo';
-- SELECT count(*) FROM public.timesheets WHERE user_id = 'user_demo';
