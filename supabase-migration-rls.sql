-- Migration : Activation RLS (Row Level Security)
-- À exécuter dans SQL Editor de Supabase
-- IMPORTANT : ne supprime aucune donnée, ajoute uniquement des règles de filtrage

-- ═══════════════════════════════════════════════════════════════════════
-- Fonction helper : récupérer le user_id (notre table) depuis auth.uid()
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS TEXT AS $$
  SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction helper : vérifier si l'utilisateur connecté est admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = (SELECT auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : users
-- Règle : voir son propre profil, admin voit tout
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- Lecture : son propre profil OU admin voit tout
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth_id = auth.uid() OR public.is_admin());

-- Modification : son propre profil uniquement
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (auth_id = auth.uid());

-- Insertion : autorisée (pour le signup)
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (true);

-- Suppression : admin uniquement
CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : mandataires
-- Règle : chaque user voit ses propres mandataires
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.mandataires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mandataires_all" ON public.mandataires;

CREATE POLICY "mandataires_all" ON public.mandataires
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : clients
-- Règle : chaque user voit ses propres clients
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_all" ON public.clients;

CREATE POLICY "clients_all" ON public.clients
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : client_contacts
-- Règle : via le client (qui a un user_id)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_contacts_all" ON public.client_contacts;

CREATE POLICY "client_contacts_all" ON public.client_contacts
  FOR ALL USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = public.get_my_user_id())
    OR public.is_admin()
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = public.get_my_user_id())
    OR public.is_admin()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : timesheets
-- Règle : chaque user voit ses propres pointages
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timesheets_all" ON public.timesheets;

CREATE POLICY "timesheets_all" ON public.timesheets
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : invoices
-- Règle : chaque user voit ses propres factures
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_all" ON public.invoices;

CREATE POLICY "invoices_all" ON public.invoices
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : invoice_templates
-- Règle : chaque user voit ses propres templates
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_templates_all" ON public.invoice_templates;

CREATE POLICY "invoice_templates_all" ON public.invoice_templates
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : billing_periods
-- Règle : chaque user voit ses propres périodes
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_periods_all" ON public.billing_periods;

CREATE POLICY "billing_periods_all" ON public.billing_periods
  FOR ALL USING (user_id = public.get_my_user_id() OR public.is_admin())
  WITH CHECK (user_id = public.get_my_user_id() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE : billing_period_clients
-- Règle : via la période (qui a un user_id)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.billing_period_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_period_clients_all" ON public.billing_period_clients;

CREATE POLICY "billing_period_clients_all" ON public.billing_period_clients
  FOR ALL USING (
    period_id IN (SELECT id FROM public.billing_periods WHERE user_id = public.get_my_user_id())
    OR public.is_admin()
  )
  WITH CHECK (
    period_id IN (SELECT id FROM public.billing_periods WHERE user_id = public.get_my_user_id())
    OR public.is_admin()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Vérification : lister les tables avec RLS activé
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
