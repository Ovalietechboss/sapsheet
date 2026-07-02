# Kizy — Journal de bord & mémoire de projet

> Fichier **chrono / mémoire** : reprend l'historique des décisions et l'état d'avancement pour reprendre le projet à tout moment (y compris depuis une nouvelle session ou le futur repo `kizy`).
> Dernière mise à jour : **2026-07-02**. Statut : **⏸️ EN PAUSE après la phase PRD**.

---

## 🎯 En une phrase
**Kizy** = logiciel **SaaS de gestion locative pour bailleurs particuliers**, **mobile-first**, dont le différenciateur est **l'état des lieux mobile (photos par pièce + inventaire + signature manuscrite), utilisable hors-ligne**. Inspiré de Rentila, mais meilleur sur le terrain.

## 📌 Reprendre ici (prochaine action)
➡️ **Phase Architect (BMAD)** : rédiger `docs/architecture.md` à partir de `docs/prd.md`
(schéma Supabase + RLS, stratégie offline/sync, pipeline PDF+signature, briques réutilisables de DomiTemps).

---

## 🗓️ Chronologie

### 2026-07-02 — Cadrage initial (phase Analyst + PM)
1. **Demande** : préparer avec **BMAD** un logiciel de gestion locative pour particuliers, façon Rentila mais avec une vraie app mobile (EDL photos, inventaires, signature).
2. **Constat repo** : le repo `sapsheet` contient **DomiTemps** (pointage/facturation aides à domicile) — stack **React + TS + Capacitor + Supabase + PDF + caméra/filesystem/share/geolocation + offline `idb`**. Beaucoup de briques réutilisables.
3. **BMAD pas encore installé** (pas de `.bmad-core/`).
4. **Q/R de cadrage n°1** :
   - Base tech → **capitaliser sur l'existant** (réutiliser la stack).
   - Focus MVP → **les deux en parallèle** (gestion locative complète + EDL/signature).
   - Signature → **manuscrite en v1, eIDAS plus tard**.
   - Ambition → **SaaS multi-bailleurs**.
5. **Q/R de cadrage n°2** :
   - Baux v1 → **tout** (nu, meublé, saisonnier, parking) + **LMNP** ajouté par l'utilisateur.
   - Signature → **présentiel + à distance**.
   - Hors-ligne → **indispensable**.
   - Loyers → **tout** (quittances/appels, impayés, IRL/régul, tableau de bord/2044) + **LMNP**.
   - ⚠️ Tout coché = **vision cible** → décision de **phaser** (MVP resserré).
6. **Project Brief rédigé** → `docs/brief.md` (commit `fbe0a9c`).
7. **Q/R de cadrage n°3 (décisions produit)** :
   - Nom → **on en parle** (tranché plus tard).
   - Colocation → **quotes-parts dès le J1**.
   - Photos → **Supabase Storage + quota**.
   - Tarif → **abonnement**.
   - Repo → **nouveau repo dédié** (DomiTemps intact).
   - → brief mis à jour (commit `716c84f`).
8. **Choix du nom** : brainstorm → l'utilisateur retient **Kizy** (évoque *keys*). Vérif web : pas de collision en proptech FR ; `kizy.com` pris par *Kizy Tracking* (IoT, autre secteur) → viser `kizy.fr`/`kizy.app` + dépôt INPI (classes 9 & 36). Nom **adopté**.
9. **PRD Jalon 1 rédigé** → `docs/prd.md` (commit `94f6d96`, avec renommage Kizy dans le brief).
10. **⏸️ PAUSE** demandée par l'utilisateur ; création de ce journal.

---

## ✅ Décisions figées
| Sujet | Décision |
|---|---|
| Nom produit | **Kizy** |
| Repo cible | **nouveau repo dédié `kizy`** (`ovalietechboss/kizy`), DomiTemps/`sapsheet` reste intact |
| Modèle éco | **Abonnement** (SaaS) |
| Multi-tenant | Oui, isolation **RLS Supabase** (`owner_id = auth.uid()`) |
| Colocation | **Quotes-parts** de loyer par colocataire dès le J1 |
| Photos | **Supabase Storage**, privé, quota par bailleur, compression ~JPEG 85% |
| Signature | **Manuscrite** (canvas→PDF horodaté + hash) au J1 ; **eIDAS** au J3 |
| Offline | **Offline-first sur l'EDL** (IndexedDB `idb` + Filesystem + sync idempotente, UUID client) |
| Marché | France (loi 89-462, meublé, parking ; IRL/2044/LMNP plus tard) |
| Base tech | Capitaliser sur la stack DomiTemps (**copiée** dans le nouveau repo, pas partagée) |

## 🧱 Phasage
- **🟢 J1 (MVP)** : auth/multi-tenant · biens (nu/meublé/parking) · locataires/garants · colocation quotes-parts · baux · **EDL photos par pièce** · inventaire meublé · **signature manuscrite présentiel** · **offline+sync** · quittances/appels de loyer · suivi paiements/impayés.
- **🟡 J2** : signature **à distance** + **portail locataire** · **révision IRL** · **régul charges** · comparatif EDL entrée↔sortie automatisé · alertes/échéances.
- **🟠 J3** : **saisonnier** · **2044** · **LMNP (amortissements/2031)** · **signature eIDAS** · paiement en ligne.

## 📦 Artefacts produits (branche `claude/rental-management-app-9f4as0` du repo `sapsheet`)
- `docs/brief.md` — Project Brief (vision, phasage, cartographie Rentila→Kizy, décisions).
- `docs/prd.md` — PRD Jalon 1 (10 epics E1–E10, ~30 user stories + AC, modèle de données).
- `docs/CHRONO.md` — ce journal.

> Ces docs sont **portables** : à copier dans le futur repo `kizy` pour y poursuivre.

## ⚠️ Contrainte d'outillage à connaître
La session Claude actuelle a un **accès GitHub restreint au seul repo `ovalietechboss/sapsheet`**.
→ Elle **ne peut pas créer ni pousser** vers `ovalietechboss/kizy`. La création du repo dédié et le dev qui suit devront se faire depuis une **nouvelle session pointée sur `kizy`**.

## 🔁 Reprise — checklist
1. [ ] Créer le repo GitHub **`ovalietechboss/kizy`** (vide) + réserver `kizy.fr`/`kizy.app` + vérif INPI.
2. [ ] Copier `docs/brief.md`, `docs/prd.md`, `docs/CHRONO.md` dans le nouveau repo.
3. [ ] `npx bmad-method install` dans `kizy` (crée `.bmad-core/`, agents PM/Architect/SM/Dev/QA).
4. [ ] **Phase Architect** → `docs/architecture.md` (schéma Supabase+RLS, offline/sync, PDF+signature, réutilisation DomiTemps).
5. [ ] Sharding des stories (SM) → dev itératif du J1 (Dev/QA).

## ❓Questions encore ouvertes
- Paliers d'abonnement + quotas (nb biens, Go de photos).
- Charte graphique / logo Kizy.
- Colocation : un document loyer par colocataire **ou** un document global (choix à confirmer en archi/UX).
