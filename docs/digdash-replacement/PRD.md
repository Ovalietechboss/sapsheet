# PRD — Remplacement de DigDash pour Domms (DomiTemps)

> Document de cadrage léger, esprit BMAD (Analyst → PM → Architect → Stories).
> Statut : v0.1 — premier incrément. Auteur : équipe Domms.

## 1. Contexte & problème

Domms / **DomiTemps** est une application de gestion de temps et de facturation
pour les services à la personne (SAP). Aujourd'hui, la restitution analytique
(tableaux de bord, rapports, exploration des données) repose sur **DigDash**, un
outil de BI externe — coûteux, lourd à maintenir et déconnecté du produit.

On veut **remplacer DigDash par un module de reporting natif** qui lit
directement les données Domms dans Supabase.

## 2. Objectifs (esprit BMAD — value first)

| # | Objectif | Mesure de succès |
|---|----------|------------------|
| O1 | Dashboards interactifs | KPIs + graphes filtrables par période, sans DigDash |
| O2 | Rapports PDF/Excel | Génération à la demande, puis planifiée (mensuel/trimestriel) |
| O3 | Exploration ad-hoc | L'utilisateur croise mesure × dimension sans dev |
| O4 | Coût & autonomie | Suppression de la licence DigDash |

Hors périmètre v1 : reporting réglementaire NOVA/URSSAF (déjà couvert côté app
principale via `BilansTab` / `attestationFiscale`).

## 3. Cible & architecture

- **Application séparée** (`domms-analytics/`), déployable indépendamment, qui
  lit la base Domms via l'API Supabase (clé anon, RLS à activer côté prod).
- Stack alignée sur l'existant : **Vite + React 18 + TypeScript**, client
  `@supabase/supabase-js`, graphiques **Recharts**, export **jsPDF** + **xlsx**.
- Pourra être extraite dans son propre dépôt plus tard (zéro dépendance au code
  de l'app principale ; seul le schéma Supabase est partagé).

```
domms-analytics/
├── src/
│   ├── lib/         # client supabase, types du domaine
│   ├── data/        # queries Supabase + agrégations (metrics)
│   ├── components/  # KPI, charts, filtres, dashboard, explorer
│   ├── reports/     # génération PDF / Excel
│   └── App.tsx
```

## 4. Modèle de données (source : schéma Supabase Domms)

| Table | Champs utiles au reporting |
|-------|----------------------------|
| `timesheets` | `duration` (h), `frais_repas/transport/autres`, `status`, `client_id`, `date_arrival` (epoch ms) |
| `clients` | `hourly_rate`, `facturation_mode` (CESU/CLASSICAL), `name`, `first_name`, `mandataire_id` |
| `invoices` | `total_amount`, `status` (draft/sent/paid), `month`, `year` |
| `mandataires` | `name`, `association_name` |

**Mesures** : heures travaillées, revenu prestations (`duration × hourly_rate`),
frais annexes, nb interventions, nb clients actifs, CA facturé / encaissé / en
attente, nb factures.

**Dimensions** : mois, client, mandataire, mode (CESU/Classique), statut facture.

## 5. User stories (backlog priorisé)

- **US1 — Dashboard interactif** *(MVP, ce commit)* : KPIs du mois, évolution
  12 mois (heures + CA), répartition CESU/Classique, top clients, statut
  factures, filtre par année. ✅
- **US2 — Export à la demande** *(MVP, ce commit)* : export du dashboard et des
  tables en **PDF** et **Excel**. ✅
- **US3 — Explorateur ad-hoc** *(MVP, ce commit)* : choix mesure × dimension ×
  type de graphe, table + export. ✅
- **US4 — Rapports planifiés** *(itération suivante)* : Supabase Edge Function +
  cron (mensuel/trimestriel), envoi email (Resend, déjà utilisé dans Domms).
- **US5 — Auth & RLS** *(itération suivante)* : connexion utilisateur, cloisonnement
  par `user_id`, partage de dashboards.

## 6. Décisions & risques

- **Lecture seule** : le module n'écrit jamais dans la base Domms.
- **RLS** : actuellement désactivé côté Domms ; à activer avant prod
  (filtrage par `user_id`). Le code filtre déjà par `user_id` quand fourni.
- **Planification** : nécessite un backend (Edge Function) — pas faisable en
  pur front, d'où le report en US4.
- **Volumétrie** : agrégations faites côté client pour l'instant ; basculer vers
  des vues SQL / RPC si la volumétrie l'exige.

## 7. Prochaines étapes

1. Brancher les vraies clés Supabase (`.env`) et valider sur données réelles.
2. US4 : Edge Function de rapports planifiés + email.
3. US5 : auth + RLS.
4. Extraction éventuelle dans un dépôt dédié.
