# DomiTemps

> Gestion de temps et facturation pour assistantes a domicile

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-blue.svg)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://vercel.com/)

## Fonctionnalites

### Pointages
- Saisie des heures avec arrivee/depart, date du jour par defaut
- Champ prestation realisee (ex: "Assistance a domicile", "Accompagnement courses")
- Indemnites kilometriques (km, tarif/km, montant modifiable)
- Frais annexes (repas, transport, autres)
- Validation : brouillon / valide
- **Filtre par mois** avec navigation fleches, groupement par jour
- **Saisie rapide** : multi-pointages par client en un seul ecran

### Clients et mandataires
- Gestion clients CESU/CLASSIQUE avec titre, prenom, nom, email, taux horaire
- Sous-onglets [Clients | Mandataires] dans un meme ecran
- Mandataires : titre, prenom, nom, association/entreprise, email, SIREN, telephone
- Destinataires supplementaires par client (ex: "Nicole et Colette", "Service paiement UDAF")
- Champ observations/instructions par client
- Edition et suppression avec protections

### Bilans de fin de mois
- Groupement par mandataire avec email destinataire
- Statuts par client : a generer / genere / envoye / erreur
- Alertes avant cloture (pointages non valides, clients sans document)
- Cloture / reouverture / archivage
- Historique des mois passes
- **Vue Documents** : generation PDF par client
- **Vue Chronologie** : liste des pointages du mois
- **Export CSV** avec IK et BOM UTF-8 pour Excel
- **Recapitulatif NOVA** trimestriel (heures, clients, CA hors frais)

### Generation PDF
- **CESU** : releve mensuel avec tableau journalier, IK, frais, recap, mandataire
- **CLASSIQUE** : facture pro inspiree format officiel (emetteur/destinataire, detail par prestation groupee avec dates, IK separes, conditions de paiement)
- Destinataires supplementaires affiches ("Copie a :")
- Nom du fichier = numero facture (ex: `CESU-2026-03-Dupont.pdf`, `FAC-2026-03-Legrand.pdf`)
- Telechargement direct sur web, partage natif sur Android
- JPEG 85% + scale 1.5 (~300Ko au lieu de 8Mo)
- Footer : "Genere par DomiTemps — Au service de celles et ceux qui prennent soin des autres"

### Dashboard
- **Web** : hero avec avatar + prenom, 5 cartes stats, evolution 6 mois (barres CSS), repartition CESU/Classique, top 5 clients, alertes, cumul annuel, derniers pointages
- **Mobile** : version allegee (stats + raccourcis + derniers pointages)
- Boutons aide (WhatsApp + Email)

### Profil utilisateur
- Prenom, nom complet, avatar (upload photo max 500Ko)
- Infos pro : CESU, IBAN, BIC, SIREN, SIRET, entreprise
- Prenom affiche a la connexion sur le dashboard

### Authentification
- Login / Signup avec Supabase Auth
- Confirmation email a l'inscription
- Mot de passe oublie (email de reset + page /reset-password)
- Inscriptions publiques controlees par `VITE_ALLOW_SIGNUP`

### Administration (`/admin`)
- Dashboard supervision : stats globales, activite par utilisateur
- Gestion utilisateurs : creation, toggle role admin/user, suppression
- Impersonation : se connecter en tant qu'un autre utilisateur (support sans mot de passe)
- Banniere orange de retour admin
- Parametres systeme (inscriptions, Supabase URL)
- Lien discret "admin" dans le footer (visible uniquement pour les admins)

## Stack technique

| Composant | Technologie |
|---|---|
| Frontend | React 18 + TypeScript 5.3 + Vite 7 |
| State | Zustand (stores auth/timesheet/client/invoice/mandataire/billingPeriod) |
| Backend | Supabase (PostgreSQL + Auth + REST API) |
| Mobile | Capacitor 8 (Android SDK 36, appId: com.domitemps.app) |
| PDF | html2canvas + jsPDF (JPEG 85%, scale 1.5) |
| Deploy web | Vercel (auto-deploy depuis GitHub) |
| Tests | Jest 29 (90 tests / 6 suites) |

## Structure du projet

```
src/
├── components/
│   ├── DashboardTab      # Accueil avec analytics (web complet / mobile light)
│   ├── TimesheetsTab     # Pointages filtres par mois, groupes par jour
│   ├── ImportRapide      # Saisie rapide multi-pointages
│   ├── ClientsTab        # Sous-onglets Clients + Mandataires + edition
│   ├── BilansTab         # Bilans + chronologie + CSV + NOVA
│   └── ProfileTab        # Profil avec avatar
├── stores/
│   ├── authStore         # Auth + impersonation + role admin
│   ├── clientStore       # CRUD clients + contacts additionnels
│   ├── mandataireStore   # CRUD mandataires
│   ├── timesheetStore    # CRUD pointages (avec IK + description)
│   ├── invoiceStore      # CRUD factures
│   └── billingPeriodStore # Periodes + cloture + archivage
├── services/
│   ├── InvoiceTemplates  # Templates CESU + CLASSIQUE (avec mandataire, contacts, IK)
│   └── ReportService     # Agregation mensuelle
├── pages/                # LoginPage, HomePage, AdminPage, ResetPasswordPage
├── utils/                # pdfGenerator (JPEG, multi-page, web + Android)
└── hooks/                # useIsMobile
```

## Base de donnees

| Table | Description |
|---|---|
| `users` | Utilisateurs (first_name, display_name, avatar_url, role, CESU, IBAN, SIREN...) |
| `mandataires` | Mandataires (titre, first_name, name, association, email, SIREN, phone, address) |
| `clients` | Clients (titre, first_name, name, email, address, mode, hourly_rate, mandataire_id, observations) |
| `client_contacts` | Destinataires supplementaires par client (label, email, notes) |
| `timesheets` | Pointages (arrivee, depart, duree, frais, ik_km, ik_rate, ik_amount, description) |
| `invoices` | Factures (numero, statut, montant, mois/annee) |
| `billing_periods` | Periodes de facturation (open/locked/archived) |
| `billing_period_clients` | Suivi par client dans une periode (pending/generated/sent) |

### Migrations SQL (a executer dans l'ordre)
1. `supabase-schema.sql` — Schema initial
2. `supabase-migration-mandataires.sql` — Table mandataires + mandataire_id sur clients
3. `supabase-migration-names.sql` — Champs first_name + titre
4. `supabase-migration-billing-periods.sql` — Periodes de facturation
5. `supabase-migration-admin-role.sql` — Role admin
6. `supabase-migration-client-contacts.sql` — Contacts additionnels + observations clients
7. `supabase-migration-ik.sql` — Indemnites kilometriques sur timesheets
8. `supabase-migration-timesheet-description.sql` — Description prestation
9. `supabase-migration-user-profile.sql` — Prenom + avatar sur users

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
- appId : `com.domitemps.app`

## Securite

- `.env` non commite (`.gitignore`)
- Cle Supabase ANON uniquement (publique par design)
- Inscriptions publiques desactivees par defaut
- Confirmation email obligatoire a l'inscription
- Page admin protegee par role
- Valeurs negatives impossibles (IK, frais)
- RLS Supabase pret a activer

## Roadmap

- [ ] Envoi email automatique (Resend + Supabase Edge Functions)
- [ ] Nom de domaine domitemps.fr
- [ ] Publication Play Store
- [ ] App iOS (Capacitor ready)
- [ ] Synchronisation offline (Service Worker)
- [ ] Portail mandataire (validation des pointages)
- [ ] Integration API NOVA (si disponible)
- [ ] Activation RLS Supabase

## Licence

Proprietaire - (c) 2026 DomiTemps

---

DomiTemps — Au service de celles et ceux qui prennent soin des autres
