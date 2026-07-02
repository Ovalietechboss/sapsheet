# Project Brief — LocaTerrain (nom de code provisoire)

> Logiciel de gestion locative pour bailleurs particuliers, **mobile-first**, avec état des lieux photo + inventaire + signature sur le terrain.
> Premier artefact BMAD (phase Analyst). À valider avant de passer au PRD (phase PM).

---

## 1. Executive Summary

**LocaTerrain** est une application de **gestion des locations pour particuliers** (SaaS multi-bailleurs), qui vise à faire aussi bien que Rentila sur la gestion locative « bureau » (biens, locataires, baux, loyers, fiscalité) **tout en le dépassant nettement sur le terrain mobile** : état des lieux avec photos par pièce, inventaire du mobilier, et **signature manuscrite des documents directement sur le mobile**, y compris **hors-ligne**.

Le produit capitalise sur une base technique existante (React + TypeScript + **Capacitor** iOS/Android + **Supabase** + génération **PDF** + **caméra/filesystem/share** déjà intégrés), ce qui accélère fortement la partie mobile.

## 2. Problem Statement

Les outils actuels de gestion locative pour particuliers (Rentila, etc.) sont pensés **web / bureau**. L'**état des lieux**, l'**inventaire meublé** et la **signature** — qui se font sur place, dans le logement, souvent **sans réseau** — y sont mal servis :

- Pas de vraie application mobile fluide pour l'EDL.
- Prise de photos non intégrée au document (photos éparpillées, non horodatées, non rattachées à une pièce).
- Signature électronique reléguée à une option payante et peu adaptée au présentiel.
- Aucune tolérance au hors-ligne (cave, sous-sol, logement vide sans wifi).

Résultat : le bailleur retombe sur le **papier + photos manuelles**, avec un risque juridique (litiges dépôt de garantie) et une perte de temps à ressaisir.

## 3. Proposed Solution

Une app **mobile-first** (et web) qui couvre le cycle complet du bailleur :

1. **Terrain (différenciateur)** : EDL entrée/sortie guidé pièce par pièce, photos rattachées, inventaire meublé, comparatif entrée↔sortie, signature manuscrite des deux parties, PDF horodaté généré sur place — **le tout utilisable hors-ligne** puis synchronisé.
2. **Gestion locative** : biens, locataires/garants, baux, quittances & appels de loyer, suivi des paiements/impayés, révision IRL, régularisation des charges.
3. **Pilotage & fiscalité** : tableau de bord rentabilité, aide déclaration revenus fonciers (2044) et **LMNP** (régime réel, amortissements, liasse 2031) — jalon ultérieur.

## 4. Target Users

- **Cible primaire** : bailleur particulier possédant 1 à ~10 biens, non professionnel, qui gère lui-même ses locations depuis son mobile.
- **Cible secondaire** : petit multipropriétaire / LMNP qui veut suivre rentabilité et fiscalité.
- **Utilisateur du portail (secondaire)** : le **locataire**, pour signer à distance et recevoir quittances (jalon 2).

## 5. Goals & Success Metrics

**Objectifs produit**
- Réaliser un EDL complet (photos + inventaire + signatures) en < 30 min, sans papier.
- Zéro perte de données terrain même sans réseau.
- Générer quittances/appels de loyer en 1 clic.

**Métriques de succès (post-lancement)**
- % d'EDL menés entièrement dans l'app (vs papier).
- Nb de biens/baux gérés par utilisateur actif.
- Taux de synchronisation réussie après saisie offline.
- Rétention mensuelle des bailleurs.

## 6. Périmètre & phasage MVP

> ⚠️ Toutes les fonctionnalités ci-dessous ont été retenues comme **vision cible**. Pour livrer vite et bien, on **phase**. Le MVP (Jalon 1) est volontairement resserré.

### 🟢 Jalon 1 — MVP (à livrer en premier)
- **Auth & multi-tenant** : compte bailleur, isolation des données par RLS (base déjà en place).
- **Biens** : résidentiel **nu** + **meublé**, parking/garage. Fiche, caractéristiques, photos.
- **Locataires & garants** : fiches, **colocation avec quotes-parts de loyer par colocataire**.
- **Baux** : création bail nu/meublé, loyer+charges+dépôt, dates, PDF.
- **État des lieux (cœur du différenciateur)** : entrée/sortie, pièce par pièce, **photos rattachées**, notation état, commentaires.
- **Inventaire meublé** rattaché au bien/bail.
- **Signature manuscrite** sur l'écran (bailleur + locataire), **en présentiel**, intégrée au PDF horodaté.
- **Mode hors-ligne** : saisie EDL/inventaire/photos en local + **synchronisation** au retour du réseau.
- **Loyers — socle** : **quittances + appels de loyer** (PDF + email, brique email Resend déjà présente).
- **Suivi des paiements/impayés** : marquage payé/impayé, soldes, relances basiques.

### 🟡 Jalon 2
- **Signature à distance** via lien envoyé au locataire + **mini-portail locataire**.
- **Révision IRL** (indice INSEE) et **régularisation des charges**.
- Comparatif EDL entrée↔sortie automatisé (calcul dégradations / retenues dépôt).
- Alertes & échéances (fin de bail, révision, assurance PNO/GLI, DPE).

### 🟠 Jalon 3
- **Bail saisonnier / courte durée** (calendrier, nuitées).
- **Tableau de bord fiscalité** : revenus fonciers (aide 2044).
- **LMNP** : régime réel, **amortissements**, aide liasse **2031**.
- **Signature eIDAS** via prestataire (Yousign/DocuSign) en option certifiée.

### 🔴 Hors périmètre (pour l'instant)
- Comptabilité complète type expert-comptable.
- Gestion de mandats pro / agences (multi-bailleurs gérés par un tiers).
- Encaissement/paiement en ligne intégré (Stripe, prélèvement SEPA).

## 7. Cartographie Rentila → LocaTerrain

| Domaine Rentila | LocaTerrain | Jalon | Différenciation |
|---|---|---|---|
| Biens / lots | ✅ | 1 | Photos natives mobile |
| Locataires / garants | ✅ | 1 | — |
| Baux (nu/meublé) | ✅ | 1 | Génération + signature mobile |
| Bail saisonnier | ✅ | 3 | — |
| Quittances / appels loyer | ✅ | 1 | 1 clic + email |
| Suivi impayés / relances | ✅ | 1-2 | — |
| Révision IRL | ✅ | 2 | — |
| Régularisation charges | ✅ | 2 | — |
| **État des lieux** | ✅✅ | 1 | **App terrain hors-ligne + photos par pièce** |
| **Inventaire meublé** | ✅✅ | 1 | **Rattaché, photo, comparatif** |
| **Signature documents** | ✅✅ | 1 (manuscrite) / 3 (eIDAS) | **Manuscrite présentiel incluse, pas en option payante** |
| Alertes / échéances | ✅ | 2 | — |
| Portail locataire | ✅ | 2 | — |
| Déclaration fiscale 2044 | ✅ | 3 | — |
| **LMNP (amortissement/2031)** | ✅ | 3 | **Au-delà de Rentila** |

## 8. Post-MVP Vision

Devenir l'outil de référence du bailleur particulier français « du terrain à la fiscalité » : mobile en priorité, hors-ligne fiable, et intégrations progressives (encaissement en ligne, GLI/assurances, expert-comptable, connexion INSEE/IRL automatique).

## 9. Technical Considerations

- **Réutilisation** de la stack existante : Capacitor (Camera, Filesystem, Share, Geolocation), Supabase (Auth + Postgres + RLS + Edge Functions), génération PDF (jsPDF/html2pdf), envoi email (Edge Function `send-invoice`/Resend à généraliser).
- **Multi-tenant** : isolation par `owner_id` + politiques RLS (le repo a déjà `supabase-migration-rls.sql` comme modèle).
- **Hors-ligne** : file d'attente locale (IndexedDB, `idb` déjà présent) + stockage photos local (Filesystem) + **synchronisation idempotente** vers Supabase Storage/DB au retour réseau. À concevoir dès l'architecture.
- **Signature manuscrite** : capture canvas tactile → image → intégrée au PDF + horodatage + empreinte (hash) pour l'intégrité. eIDAS = intégration API tierce ultérieure.
- **Photos** : compression (déjà pratiquée dans DomiTemps : JPEG 85% / scale 1.5) pour maîtriser le poids.
- **Modèle de données clé** : Bien → Bail → (Locataires, Garants) → États des lieux (entrée/sortie) → Pièces → Éléments/Photos ; Inventaire ; Loyers (appels, quittances, paiements).

## 10. Constraints & Assumptions

- **Marché France** (IRL INSEE, loi 89-462, mentions légales bail, DPE, régimes fiscaux FR).
- Mono-langue **français** en v1.
- Budget prestataire signature eIDAS **différé** (jalon 3).
- **Nouveau repo dédié** `LocaTerrain` ; les briques réutilisables de `sapsheet`/DomiTemps (auth Supabase, RLS, PDF, caméra/filesystem/share, offline `idb`, email Edge Function) sont **copiées et adaptées**, pas partagées.
- **SaaS par abonnement** : la tarification impacte les quotas (biens, stockage photos) et le portail locataire.

## 11. Risks & Open Questions

**Risques**
- Complexité du hors-ligne + synchronisation photos (conflits, gros volumes) → à cadrer sérieusement en architecture.
- Valeur juridique de la signature manuscrite → suffisante entre particuliers, mais à documenter (horodatage, intégrité).
- Périmètre très large (tout coché) → risque de dispersion ; le phasage doit être tenu.

**Décisions prises (2026-07)**
- ✅ **Colocation** : gestion des **quotes-parts de loyer par colocataire dès le Jalon 1**.
- ✅ **Photos** : stockage **Supabase Storage** avec **quota par bailleur** (valeur à caler selon l'offre d'abonnement).
- ✅ **Modèle économique** : **abonnement** (SaaS payant, pas de mode gratuit prévu ; freemium éventuel à débattre).
- ✅ **Dépôt** : **nouveau repo dédié** `LocaTerrain` — DomiTemps (`sapsheet`) reste intact ; on y **copie les briques réutilisables** (auth, PDF, caméra, offline, RLS).

**Questions encore ouvertes (à trancher au PRD)**
1. **Nom définitif** du produit + charte / logo (en discussion).
2. Palier(s) d'abonnement et quotas associés (nb de biens, Go de photos).

## 12. Next Steps (workflow BMAD)

1. ✅ **Analyst — Project Brief** (ce document) → à valider.
2. **Installer BMAD** dans le repo : `npx bmad-method install` (crée `.bmad-core/`, agents PM/Architect/SM/Dev/QA).
3. **PM — PRD** : à partir de ce brief, rédiger le PRD (epics + user stories du Jalon 1).
4. **Architect — Architecture** : modèle de données, stratégie hors-ligne/sync, RLS multi-tenant, PDF/signature.
5. **SM → Dev → QA** : sharding des stories et développement itératif du MVP.

---
*Document généré comme point de départ de discussion — à amender librement.*
