# Domms Analytics

Module de **tableaux de bord et reporting** pour Domms / DomiTemps — remplacement
de **DigDash** (BI / dashboards) et de **BIRT** (reporting documentaire paginé).
Application séparée (Vite + React + TypeScript) qui lit les données Domms via
l'API Supabase, en **lecture seule**.

Voir le cadrage : [`../docs/digdash-replacement/PRD.md`](../docs/digdash-replacement/PRD.md).

## Fonctionnalités (v0.1)

- **Tableau de bord interactif** : KPIs (heures, revenu, CA facturé/encaissé,
  frais, clients actifs), évolution mensuelle (heures + CA), répartition
  CESU/Classique, statut des factures, top clients. Filtre par année.
- **Exploration ad-hoc** : croise une mesure (heures, revenu, frais, CA, nb
  factures…) par une dimension (mois, client, mandataire, mode, statut) en
  barres / courbe / table.
- **Rapports documentaires** *(remplace BIRT)* : catalogue de rapports
  paramétrables (relevé d'activité, journal de facturation, synthèse par
  mandataire, détail des interventions), structurés en bandes avec
  groupes + sous-totaux + total général, aperçu écran et **export PDF paginé /
  Excel structuré**.
- **Export PDF & Excel** sur tous les écrans.

## Démarrage

```bash
cd domms-analytics
npm install
cp .env.example .env      # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5180
```

Pour limiter le reporting à un assistant précis, renseigner `VITE_DOMMS_USER_ID`.

## Architecture

```
src/
├── lib/        supabase (client) + types du domaine
├── data/       queries (Supabase) · metrics (KPIs/séries) · explorer (moteur ad-hoc)
├── reports/    model · definitions (catalogue BIRT) · renderReport (PDF/Excel) · export
└── components/ Dashboard · Reports · Explorer · KpiCard · PeriodControls
```

### Ajouter un rapport

Un rapport est une `ReportDefinition` (dans `src/reports/definitions.ts`) :
nom, description, paramètres pertinents et une fonction `run(ds, params)` qui
renvoie un `ReportResult` (colonnes typées, groupes avec sous-totaux, total
général). L'aperçu écran et les exports PDF/Excel sont alors automatiques.

Aucune dépendance au code de l'app principale : seul le **schéma Supabase** est
partagé. Le module peut être extrait dans son propre dépôt.

## Reste à faire (backlog)

- **US4** — rapports planifiés (Supabase Edge Function + cron + email Resend).
- **US5** — authentification + RLS (cloisonnement par `user_id`).
- Vues SQL / RPC d'agrégation si la volumétrie augmente.
