-- =====================================================================
-- Durcissement sécurité AVANT ouverture de DomiTemps à d'autres utilisateurs
-- Audit du 2026-08-31 (lecture des policies réelles depuis le dump de prod)
--
-- ⚠️  À EXÉCUTER MANUELLEMENT dans le SQL Editor de Supabase, APRÈS backup.
--     Ne jamais passer par un db:push automatique sur la prod de Cathy.
--
-- ÉTAT ACTUEL : les 7 tables métier sont correctement isolées
-- (user_id = get_my_user_id() OR is_admin(), avec WITH CHECK). Rien à y changer.
-- Le problème est ailleurs : dans la table `users` elle-même.
--
-- ---------------------------------------------------------------------
-- FAILLE 1 — Auto-promotion en admin par UPDATE
--   users_update : USING (auth_id = auth.uid()), SANS WITH CHECK.
--   Quand WITH CHECK est omis, Postgres réutilise l'expression USING. Or RLS
--   ne sait pas restreindre COLONNE par colonne : n'importe quel utilisateur
--   connecté peut donc exécuter
--       UPDATE users SET role = 'admin' WHERE auth_id = auth.uid();
--   is_admin() devient vrai, et TOUTES les policies *_all lui ouvrent les
--   données de TOUS les autres utilisateurs.
--
-- FAILLE 2 — Auto-promotion en admin par INSERT
--   users_insert : WITH CHECK (true). Aucune contrainte UNIQUE sur auth_id.
--   Un utilisateur peut donc insérer une SECONDE ligne users portant son
--   propre auth_id et role = 'admin'. Même résultat.
--
-- FAILLE 3 — Stockage grand ouvert
--   avatars_all_auth : TO authenticated USING (true) WITH CHECK (true), sans
--   filtre de bucket ni de propriétaire. Tout utilisateur connecté peut lire,
--   écraser ou supprimer n'importe quel fichier de n'importe quel bucket.
--
-- PORTÉE RÉELLE AUJOURD'HUI : nulle. Il n'y a que 2 comptes (l'admin et
-- Cathy) et VITE_ALLOW_SIGNUP=false. Ces failles deviennent exploitables
-- au moment PRÉCIS où un troisième utilisateur obtient un compte.
-- ---------------------------------------------------------------------
--
-- CONTRAINTE DE CONCEPTION RESPECTÉE ICI : ne pas casser l'inscription.
-- Avec la confirmation d'email activée, `supabase.auth.signUp()` ne renvoie
-- PAS de session : l'INSERT dans `users` qui suit (authStore.ts:138) part donc
-- en ANONYME, avec auth.uid() = NULL. C'est très probablement la raison pour
-- laquelle la policy avait été ouverte à `true`. Les règles ci-dessous
-- préservent ce cas de figure — aucun changement de code n'est requis.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ÉTAPE 0 — CONTRÔLES PRÉALABLES (lecture seule, à lire avant d'exécuter)
-- ---------------------------------------------------------------------

-- 0.a Doublons d'auth_id ? Doit renvoyer 0 ligne, sinon l'étape 1 échouera.
SELECT auth_id, count(*)
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING count(*) > 1;

-- 0.b Qui est admin aujourd'hui ? Doit renvoyer UNE seule ligne (ton compte).
SELECT id, email, role FROM public.users WHERE role = 'admin';


-- ---------------------------------------------------------------------
-- ÉTAPE 1 — Un seul profil par compte d'authentification
-- Ferme la faille 2 : plus possible d'ajouter une 2e ligne pour son auth_id.
-- ---------------------------------------------------------------------

ALTER TABLE public.users
  ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);


-- ---------------------------------------------------------------------
-- ÉTAPE 2 — INSERT : interdire de se créer directement en admin
-- On conserve le cas légitime de l'inscription (auth.uid() NULL car email
-- non encore confirmé), on bloque l'escalade.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS users_insert ON public.users;

CREATE POLICY users_insert ON public.users
  FOR INSERT
  WITH CHECK (
    role = 'user'
    AND (
      (SELECT auth.uid()) IS NULL          -- inscription : pas encore de session
      OR auth_id = (SELECT auth.uid())     -- connecté : uniquement pour soi
    )
  );


-- ---------------------------------------------------------------------
-- ÉTAPE 3 — UPDATE : rendre `role` et `auth_id` non modifiables par soi-même
-- Ferme la faille 1. Un trigger est préféré à un REVOKE colonne par colonne :
-- il résiste à l'ajout de futures colonnes, là où un GRANT explicite obligerait
-- à réénumérer les 21 colonnes à chaque évolution du schéma.
-- L'écran d'administration continue de fonctionner : is_admin() y est vrai.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Modification du role interdite (reservee aux administrateurs)';
  END IF;
  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Modification de auth_id interdite';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_escalation ON public.users;
CREATE TRIGGER users_prevent_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();


-- ---------------------------------------------------------------------
-- ÉTAPE 4 — Stockage : limiter au bucket avatars et au propriétaire
--
-- ⚠️  À APPLIQUER SÉPARÉMENT ET À TESTER TOUT DE SUITE (upload d'un avatar
--     depuis le profil). `storage.objects` porte deux colonnes de propriété
--     selon l'âge du projet — `owner` (uuid, historique) et `owner_id` (text,
--     actuelle) — d'où le double test ci-dessous. Un seul objet est stocké
--     aujourd'hui, le risque de régression est donc faible et réversible.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS avatars_all_auth ON storage.objects;

-- Lecture : tous les avatars restent visibles (photos affichées dans l'app).
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Écriture / remplacement / suppression : uniquement ses propres fichiers.
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
  );

CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
  );

CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (owner = (SELECT auth.uid()) OR owner_id = (SELECT auth.uid())::text)
  );


-- ---------------------------------------------------------------------
-- ÉTAPE 5 — VÉRIFICATIONS APRÈS APPLICATION
-- ---------------------------------------------------------------------

-- 5.a Les policies attendues sont en place
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE (schemaname = 'public' AND tablename = 'users')
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY tablename, policyname;

-- 5.b Le garde-fou d'escalade est armé
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.users'::regclass AND NOT tgisinternal;

-- 5.c Toujours un seul admin
SELECT id, email, role FROM public.users WHERE role = 'admin';

-- 5.d TEST FONCTIONNEL À FAIRE DANS L'APP, dans cet ordre :
--     1. Cathy se connecte, modifie son profil (prénom) -> doit fonctionner
--     2. Upload d'un avatar -> doit fonctionner
--     3. Écran admin : basculer un compte user/admin -> doit fonctionner
--     4. Création d'un compte de test (VITE_ALLOW_SIGNUP=true temporairement)
--        -> doit fonctionner, et le compte doit arriver avec role='user'


-- =====================================================================
-- ROLLBACK (si l'un des tests ci-dessus échoue)
-- =====================================================================
-- DROP TRIGGER IF EXISTS users_prevent_escalation ON public.users;
-- DROP FUNCTION IF EXISTS public.prevent_privilege_escalation();
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_id_key;
-- DROP POLICY IF EXISTS users_insert ON public.users;
-- CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS avatars_select ON storage.objects;
-- DROP POLICY IF EXISTS avatars_insert ON storage.objects;
-- DROP POLICY IF EXISTS avatars_update ON storage.objects;
-- DROP POLICY IF EXISTS avatars_delete ON storage.objects;
-- CREATE POLICY avatars_all_auth ON storage.objects TO authenticated
--   USING (true) WITH CHECK (true);
