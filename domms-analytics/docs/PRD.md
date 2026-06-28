# PRD — Remplacement de DigDash pour Domms (DomiTemps)

> Document de cadrage léger, esprit BMAD (Analyst → PM → Architect → Stories).
> Statut : v0.1 — premier incrément. Auteur : équipe Domms.

## 1. Contexte & problème

Domms / **DomiTemps** est une application de gestion de temps et de facturation
pour les services à la personne (SAP). Aujourd'hui, la restitution analytique
repose sur **deux outils externes** :

- **DigDash** — plateforme de BI : tableaux de bord interactifs et exploration.
- **BIRT** (Business Intelligence Reporting Tool) — moteur de **reporting
  documentaire** : rapports paginés, structurés, groupés avec sous-totaux,
  paramétrables, exportés en PDF/Excel.

Les deux sont coûteux, lourds à maintenir et déconnectés du produit. On veut les
**remplacer par un module de reporting natif** qui lit directement les données
Domms dans Supabase, et qui couvre les **deux usages** : BI (DigDash) ET
reporting documentaire (BIRT).

## 2. Objectifs (esprit BMAD — value first)

| # | Objectif | Remplace | Mesure de succès |
|---|----------|----------|------------------|
| O1 | Dashboards interactifs | DigDash | KPIs + graphes filtrables par période |
| O2 | Rapports documentaires paginés | **BIRT** | Rapports paramétrés, groupés, sous-totaux, PDF/Excel |
| O3 | Exploration ad-hoc | DigDash | L'utilisateur croise mesure × dimension sans dev |
| O4 | Rapports planifiés | BIRT/DigDash | Génération récurrente (mensuel/trimestriel) + email |
| O5 | Coût & autonomie | Les deux | Suppression des licences DigDash + BIRT |

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

- **US1 — Dashboard interactif** *(livré)* : KPIs du mois, évolution
  (heures + CA), répartition CESU/Classique, top clients, statut
  factures, filtre par année. ✅ *(remplace DigDash)*
- **US2 — Export à la demande** *(livré)* : export du dashboard et des
  tables en **PDF** et **Excel**. ✅
- **US3 — Explorateur ad-hoc** *(livré)* : choix mesure × dimension ×
  type de graphe, table + export. ✅ *(remplace DigDash)*
- **US6 — Rapports documentaires paginés** *(livré)* : catalogue de rapports
  paramétrables (relevé d'activité, journal de facturation, synthèse par
  mandataire, détail des interventions), structure en bandes avec
  groupes + sous-totaux + total général, aperçu écran et export PDF paginé /
  Excel structuré. ✅ *(remplace BIRT)*
- **US4 — Rapports planifiés** *(itération suivante)* : Supabase Edge Function +
  cron (mensuel/trimestriel), envoi email (Resend, déjà utilisé dans Domms),
  réutilise le moteur de rapports d'US6.
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
