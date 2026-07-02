# PRD — Kizy · Jalon 1 (MVP)

> Product Requirements Document, phase PM (BMAD). Dérivé de `docs/brief.md`.
> Périmètre : **Jalon 1 uniquement**. Les jalons 2/3 sont hors scope de ce PRD (rappelés en fin de doc).

---

## 1. Objectif du MVP

Permettre à un **bailleur particulier** de gérer ses biens, ses baux et ses colocataires, de réaliser un **état des lieux mobile complet (photos + inventaire + signature manuscrite), y compris hors-ligne**, et d'émettre ses **quittances / appels de loyer** avec suivi des paiements — le tout en **SaaS multi-bailleurs par abonnement**.

**Critère de réussite MVP** : un bailleur réalise, de bout en bout et sans papier, le cycle *bien → bail → EDL d'entrée signé → quittance mensuelle*, depuis son mobile.

## 2. Personas

- **Bailleur (utilisateur principal)** : possède 1–10 biens, gère seul, utilise surtout le mobile sur le terrain et le web pour l'administratif.
- **Locataire / colocataire** : ne se connecte pas au J1 ; il **signe en présentiel** sur le mobile du bailleur (le mode « à distance » + portail arrive au Jalon 2).

## 3. Contraintes & principes

- **Mobile-first**, mais utilisable en web responsive (même code base Capacitor/React).
- **Multi-tenant** : chaque donnée est rattachée à un `owner_id` (bailleur) ; isolation stricte par **RLS Supabase**.
- **Offline-first sur l'EDL** : saisie + photos stockées localement (IndexedDB + Filesystem), **synchronisation idempotente** au retour réseau.
- **France** : baux loi 89-462 (nu), meublé, + parking/garage ; mentions légales FR ; monnaie €.
- **Abonnement** : l'accès est conditionné à un abonnement actif (gestion fine des paliers = Jalon 2, mais le modèle de données prévoit `subscription`).

---

## 4. Epics du Jalon 1

| # | Epic | Résultat attendu |
|---|------|------------------|
| E1 | Compte, authentification & multi-tenant | Un bailleur crée son compte, ses données sont isolées |
| E2 | Gestion des biens | CRUD des biens (nu, meublé, parking) avec photos |
| E3 | Locataires, garants & colocation | Fiches + colocation avec **quotes-parts** |
| E4 | Baux | Créer un bail rattachant bien + locataires + quotes-parts, générer le PDF |
| E5 | État des lieux (cœur) | EDL entrée/sortie pièce par pièce, photos, notation, **offline** |
| E6 | Inventaire meublé | Inventaire rattaché au bail, avec photos |
| E7 | Signature manuscrite | Signature des 2 parties sur mobile, intégrée au PDF horodaté |
| E8 | Synchronisation hors-ligne | File locale + sync fiable des données et photos |
| E9 | Loyers : quittances & appels | Génération PDF + envoi email, ventilation par quote-part |
| E10 | Suivi des paiements / impayés | Marquage payé/impayé, soldes, relance basique |

---

## 5. User stories

> Format : **US-{epic}.{n}** — *En tant que … je veux … afin de …*. AC = critères d'acceptation.

### E1 — Compte & multi-tenant
- **US-1.1** En tant que bailleur, je crée un compte (email + mot de passe) afin d'accéder à Kizy.
  - AC : inscription, connexion, déconnexion, réinitialisation mot de passe (Supabase Auth).
  - AC : à la 1ʳᵉ connexion, un enregistrement `owner`/profil est créé.
- **US-1.2** En tant que bailleur, je ne vois **que mes propres données** afin de garantir la confidentialité.
  - AC : RLS activée sur toutes les tables ; un utilisateur A ne peut lire/écrire les données d'un utilisateur B (test d'isolation).
- **US-1.3** En tant que bailleur, mon accès dépend d'un **abonnement actif** afin de refléter le modèle SaaS.
  - AC : table `subscription` (statut, période) ; au J1 un statut « actif » par défaut/manuel suffit (paiement réel = J2). Un statut inactif restreint l'accès en écriture.

### E2 — Biens
- **US-2.1** Créer/éditer/supprimer un bien (type : nu, meublé, parking/garage).
  - AC : champs — libellé, adresse, type, surface, nb pièces, étage, DPE, meublé oui/non, notes.
- **US-2.2** Ajouter des photos au bien (depuis caméra ou galerie), compressées.
  - AC : upload Supabase Storage, miniature, suppression ; compression JPEG (~85%).
- **US-2.3** Lister mes biens avec recherche/filtre par type et statut (loué / vacant).

### E3 — Locataires, garants & colocation
- **US-3.1** Créer une fiche locataire (civilité, nom, prénom, email, téléphone, pièce d'identité optionnelle).
- **US-3.2** Ajouter un garant à un locataire (personne physique : coordonnées ; ou Visale : référence).
- **US-3.3** Constituer une **colocation** : rattacher plusieurs locataires à un bail avec **quote-part de loyer** par colocataire.
  - AC : la somme des quotes-parts = 100 % (ou = loyer total) ; alerte si incohérent.
  - AC : quote-part exprimable en % ou en montant €.

### E4 — Baux
- **US-4.1** Créer un bail rattachant un bien + un ou plusieurs locataires (+ quotes-parts).
  - AC : type de bail (nu 89-462 / meublé / parking), date de début, durée, loyer, charges, dépôt de garantie, jour d'échéance.
- **US-4.2** Générer le **PDF du bail** à partir d'un modèle, avec les mentions légales du type choisi.
- **US-4.3** Suivre le statut du bail (actif, terminé) et les dates clés.

### E5 — État des lieux (cœur du différenciateur)
- **US-5.1** Démarrer un EDL **d'entrée** ou **de sortie** lié à un bail.
- **US-5.2** Parcourir le logement **pièce par pièce** (pièces pré-remplies selon le bien, ajout/suppression possible).
- **US-5.3** Pour chaque pièce / élément (murs, sol, plafond, ouvertures, équipements…), noter un **état** (neuf / bon / usagé / mauvais) + commentaire libre.
- **US-5.4** Prendre **des photos rattachées à la pièce/l'élément**, plusieurs par élément.
  - AC : photos horodatées, associées à l'entité pièce/élément, compressées, visibles offline.
- **US-5.5** Relever les **compteurs** (eau, élec, gaz) et remettre les **clés** (nombre/type).
- **US-5.6** Finaliser l'EDL → génère un **PDF structuré** (pièces, états, photos, compteurs, clés).
- **US-5.7 (sortie)** Comparer visuellement avec l'EDL d'entrée du même bail (comparatif automatisé = J2, mais accès à l'EDL d'entrée en lecture au J1).

### E6 — Inventaire meublé
- **US-6.1** Pour un bail meublé, constituer un **inventaire du mobilier** (pièce, objet, quantité, état, photo).
- **US-6.2** L'inventaire est **joint à l'EDL/au bail** dans le PDF.

### E7 — Signature manuscrite
- **US-7.1** À la fin de l'EDL (ou du bail), recueillir la **signature manuscrite** du bailleur et du/des locataire(s) au doigt/stylet sur l'écran.
  - AC : canvas de signature, effacer/recommencer, capture par signataire nommé.
- **US-7.2** Les signatures sont **intégrées au PDF** avec **horodatage** et une **empreinte d'intégrité (hash)** du document.
  - AC : le PDF final montre chaque signature + date/heure + mention de valeur (accord entre parties).
- **US-7.3** Le PDF signé est **stocké** (Supabase Storage) et **partageable** (email / partage natif).

### E8 — Synchronisation hors-ligne
- **US-8.1** En tant que bailleur sans réseau, je saisis un EDL complet (données + photos) qui est **persisté localement**.
  - AC : IndexedDB (via `idb`) pour les données, Filesystem pour les photos ; aucune perte si l'app est fermée.
- **US-8.2** Au retour du réseau, les données et photos se **synchronisent automatiquement** vers Supabase.
  - AC : sync **idempotente** (IDs générés côté client — UUID), reprise après échec, indicateur d'état de sync (en attente / synchronisé / erreur).
- **US-8.3** En cas de conflit (rare, mono-utilisateur), la **dernière écriture du propriétaire** l'emporte, avec journal.

### E9 — Loyers : quittances & appels
- **US-9.1** Générer un **appel de loyer** mensuel pour un bail (loyer + charges, période, échéance).
- **US-9.2** Générer une **quittance** une fois le loyer encaissé (mention « pour solde de tout compte de la période »).
- **US-9.3** En colocation, **ventiler** l'appel/la quittance selon les **quotes-parts** (un document par colocataire ou un document global au choix).
- **US-9.4** Envoyer le document par **email** (Edge Function, brique email déjà présente à généraliser) et/ou partage natif.

### E10 — Suivi des paiements / impayés
- **US-10.1** Marquer un loyer **payé / partiellement payé / impayé**, avec date et montant.
- **US-10.2** Voir le **solde** par bail / par locataire et la liste des **impayés**.
- **US-10.3** Envoyer une **relance basique** (email/lettre type) pour un impayé.

---

## 6. Modèle de données (cible J1)

```
owner (bailleur)               ── profil, lié à auth.users
subscription                   ── owner_id, statut, période, palier(J2)
property (bien)                ── owner_id, type(nu|meublé|parking), adresse, surface, DPE, meublé…
property_photo                 ── property_id, storage_path
tenant (locataire)             ── owner_id, civilité, nom, prénom, email, tél
guarantor (garant)             ── tenant_id, type(physique|visale), coordonnées|réf
lease (bail)                   ── owner_id, property_id, type, dates, loyer, charges, dépôt, échéance, statut
lease_tenant (coloc)           ── lease_id, tenant_id, quote_part(% ou €)   ← quotes-parts
inspection (EDL)               ── owner_id, lease_id, type(entrée|sortie), date, statut, hash, sync_state
inspection_room (pièce)        ── inspection_id, nom, ordre
inspection_item (élément)      ── inspection_room_id, libellé, état, commentaire
inspection_photo               ── inspection_item_id|room_id, storage_path|local_path, taken_at
meter_reading (compteur)       ── inspection_id, type(eau|élec|gaz), valeur
key_handover (clés)            ── inspection_id, type, nombre
signature                      ── inspection_id|lease_id, signer_name, role, image, signed_at
inventory_item (inventaire)    ── lease_id|inspection_id, pièce, objet, qté, état, photo
rent_call (appel de loyer)     ── lease_id, période, montant, échéance, statut
receipt (quittance)            ── lease_id|lease_tenant_id, période, montant, pdf_path
payment (paiement)             ── rent_call_id|lease_id, montant, date, statut
```

Toutes les tables « métier » portent `owner_id` + politique **RLS `owner_id = auth.uid()`**. IDs = **UUID générés côté client** (indispensable pour l'offline/sync).

## 7. Exigences non-fonctionnelles

- **Performance** : liste des biens/baux < 1 s ; photo compressée < ~300 Ko.
- **Fiabilité offline** : 0 perte de données terrain ; sync reprise automatique.
- **Sécurité** : RLS sur 100 % des tables ; Storage privé par bailleur ; PDF signés hashés.
- **RGPD** : données locataires (identité) → base légale, minimisation, suppression sur demande.
- **Portabilité** : même code Web + Android (iOS ultérieur) via Capacitor.

## 8. Hors périmètre J1 (rappel)

- Signature **à distance** + **portail locataire** → Jalon 2.
- **Révision IRL** + **régularisation des charges** → Jalon 2.
- Comparatif EDL entrée↔sortie **automatisé** (calcul retenues dépôt) → Jalon 2.
- **Saisonnier**, **fiscalité 2044**, **LMNP (amortissements/2031)**, **signature eIDAS**, **paiement en ligne** → Jalon 3.

## 9. Prochaine étape BMAD

**Architecture (phase Architect)** : à partir de ce PRD → schéma Supabase + politiques RLS, stratégie offline/sync détaillée (IndexedDB `idb` + Filesystem + file de sync), pipeline PDF+signature, structure du code et briques réutilisées de DomiTemps. → `docs/architecture.md`.
