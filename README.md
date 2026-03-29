# SAP Sheet - Timesheet Management App

> Application de gestion de feuilles de temps pour assistantes de vie à domicile

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-blue.svg)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://vercel.com/)

## Fonctionnalites

### Gestion quotidienne
- **Pointages** : Suivi des heures avec arrivee/depart, frais annexes (repas, transport, autres), date du jour par defaut
- **Clients** : Gestion clients CESU/CLASSIQUE avec titre, prenom, nom, email, taux horaire
- **Mandataires** : Table dediee (titre, prenom, nom, association/entreprise, email, SIREN, telephone)
- **Factures** : Generation PDF reel (html2canvas + jsPDF), templates CESU et CLASSIQUE
- **Rapports** : Rapports mensuels, export CSV (web + Android), statistiques par client

### Bilan de fin de mois
- Groupement par mandataire avec email destinataire
- Statuts par client : a generer / genere / envoye / erreur
- Alertes avant cloture (pointages non valides, clients sans document)
- Cloture du mois (verrouillage des timesheets)
- Reouverture possible si correction necessaire
- Archivage et historique des mois passes

### Dashboard accueil
- Salutation personnalisee avec stats du mois en cours
- 4 cartes stats (heures, clients actifs, pointages, a percevoir)
- Raccourcis rapides vers chaque section
- Derniers pointages

### Multi-plateforme
- **Web** : Deploye sur Vercel (deploy automatique depuis GitHub)
- **Android** : App native via Capacitor (APK)
- **PDF** : Vrai PDF sur Android (html2canvas + jsPDF), impression sur web

### Authentification
- Login / Signup avec Supabase Auth
- Confirmation email a l'inscription
- Mot de passe oublie (email de reset)
- Inscriptions publiques controlees par variable d'environnement

### Administration
- Page super-admin (`/admin`) reservee au role admin
- Dashboard supervision : stats globales, activite par utilisateur
- Gestion utilisateurs : toggle role, creation
- Impersonation : se connecter en tant qu'un autre utilisateur (support sans mot de passe)
- Banniere orange de retour admin pendant l'impersonation

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | React 18 + TypeScript 5.3 + Vite 7 |
| State | Zustand (stores auth/timesheet/client/invoice/mandataire/billingPeriod) |
| Backend | Supabase (PostgreSQL + Auth + REST API) |
| Mobile | Capacitor 8 (Android SDK 36) |
| PDF | html2canvas + jsPDF |
| Deploy web | Vercel (auto-deploy depuis GitHub) |
| Tests | Jest 29 (90 tests / 6 suites) |

## Structure du projet

```
src/
├── components/         # Onglets UI
│   ├── DashboardTab    # Page d'accueil avec stats
│   ├── TimesheetsTab   # Gestion des pointages
│   ├── ClientsTab      # Sous-onglets Clients + Mandataires
│   ├── BilansTab       # Bilan fin de mois + cloture
│   ├── ReportsTab      # Rapports + export CSV/PDF
│   └── ProfileTab      # Profil utilisateur
├── stores/             # Zustand stores (Supabase)
│   ├── authStore       # Auth + impersonation
│   ├── clientStore     # CRUD clients
│   ├── mandataireStore # CRUD mandataires
│   ├── timesheetStore  # CRUD pointages
│   ├── invoiceStore    # CRUD factures
│   └── billingPeriodStore # Periodes + cloture
├── services/           # InvoiceTemplates (CESU + CLASSIQUE), ReportService
├── pages/              # LoginPage, HomePage, AdminPage, ResetPasswordPage
├── utils/              # pdfGenerator (web + mobile)
└── hooks/              # useIsMobile
```

## Base de donnees

Schema dans `supabase-schema.sql` + migrations :

| Table | Description |
|---|---|
| `users` | Utilisateurs (display_name, role, email, CESU, IBAN, SIREN...) |
| `mandataires` | Mandataires (titre, prenom, nom, association, email, SIREN) |
| `clients` | Clients (titre, prenom, nom, email, adresse, mode CESU/CLASSIQUE, mandataire_id) |
| `timesheets` | Pointages (arrivee, depart, duree, frais) |
| `invoices` | Factures (numero, statut, montant, mois/annee) |
| `billing_periods` | Periodes de facturation (open/locked/archived) |
| `billing_period_clients` | Suivi par client dans une periode (pending/generated/sent) |

### Migrations SQL (a executer dans l'ordre)
1. `supabase-schema.sql` — Schema initial
2. `supabase-migration-mandataires.sql` — Table mandataires + mandataire_id sur clients
3. `supabase-migration-names.sql` — Champs first_name + titre
4. `supabase-migration-billing-periods.sql` — Periodes de facturation
5. `supabase-migration-admin-role.sql` — Role admin

## Demarrage rapide

### Prerequis
- Node.js 18+
- Compte Supabase
- Android Studio (optionnel, pour build mobile)

### Installation

```bash
git clone https://github.com/Ovalietechboss/sapsheet.git
cd sapsheet/sapsheet-main
npm install --legacy-peer-deps
cp .env.example .env
# Editer .env avec vos cles Supabase
npm run dev
```

### Variables d'environnement

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ALLOW_SIGNUP=false   # true pour ouvrir les inscriptions
```

### Build production

```bash
npm run build          # Build web
npx cap sync android   # Sync Android
npx cap open android   # Ouvrir dans Android Studio
```

### Tests

```bash
npx jest               # 90 tests / 6 suites
```

## Deploiement

### Web (Vercel)
- Connecte a GitHub (Ovalietechboss/sapsheet)
- Root Directory : `sapsheet-main`
- Auto-deploy a chaque push sur `main`
- Variables d'env configurees dans Vercel Settings

### Android
- Build APK depuis Android Studio : Build > Build APK(s)
- Ou en ligne de commande : `cd android && gradlew assembleDebug`

## Securite

- `.env` non commite (`.gitignore`)
- Cle Supabase ANON uniquement (publique par design)
- Inscriptions publiques desactivees par defaut
- Confirmation email obligatoire a l'inscription
- Page admin protegee par role
- RLS Supabase pret a activer

## Roadmap

- [ ] Envoi email automatique (Resend + Supabase Edge Functions)
- [ ] Synchronisation offline (Service Worker)
- [ ] Publication Play Store
- [ ] Nom de domaine custom
- [ ] Portail mandataire (validation des pointages)
- [ ] Dashboard analytics avance
- [ ] Activation RLS Supabase

## Licence

Proprietaire - (c) 2026 SAP Sheet

---

Developpe pour les assistantes de vie a domicile
