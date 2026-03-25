# SAP Sheet - Timesheet Management App

> Application de gestion de feuilles de temps pour assistantes de vie à domicile

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0-blue.svg)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green.svg)](https://supabase.com/)

## 🎉 Version 1.0 - Fonctionnalités

### ✅ Gestion complète
- **Timesheets** : Suivi des heures avec arrivée/départ, frais annexes (repas, transport, autres)
- **Clients** : Gestion clients avec modes CESU/CLASSICAL, mandataires optionnels
- **Invoices** : Génération factures avec badges statut (BROUILLON/ENVOYÉE/PAYÉE)
- **Reports** : Rapports mensuels avec breakdown par client, export CSV
- **Profile** : Profil utilisateur complet (CESU, IBAN, BIC, SIREN/SIRET, adresses)

### 📱 Multi-plateforme
- **Web** : Application responsive desktop/tablet
- **Android** : App native avec menu hamburger, partage de fichiers
- **Export PDF** : 
  - Web → Impression directe via `window.print()`
  - Mobile → Partage HTML via Share API Android

### 🎨 Templates de factures
- **CESU** : Pointage CESU avec numéro prestataire
- **Classical** : Facture classique avec SIREN/SIRET

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- Android Studio (pour build mobile)
- Compte Supabase

### Installation

```bash
# Cloner le repo
git clone https://github.com/Ovalietechboss/sapsheet.git
cd sapsheet

# Installer les dépendances
npm install --legacy-peer-deps

# Créer .env avec vos clés Supabase
cp .env.example .env
# Éditer .env avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# Lancer en mode web
npm run dev

# Build pour production web
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

### Android Build

```bash
# Build Vite + sync Capacitor
npm run build
npm run cap:sync

# Ouvrir dans Android Studio
npm run cap:open:android

# Puis Run 'app' dans Android Studio
```

## 📊 Architecture technique

### Stack
- **Frontend** : React 18 + TypeScript + Vite 7
- **State** : Zustand (stores auth/timesheet/client/invoice/ui/sync)
- **Backend** : Supabase (PostgreSQL + REST API)
- **Mobile** : Capacitor 8 (Android SDK 36, Gradle 8.11.1)
- **PDF** : html2canvas + jspdf + Templates HTML

### Structure
```
src/
├── components/         # UI tabs (Timesheets, Clients, Invoices, Reports, Profile)
├── stores/            # Zustand stores avec mapping snake_case ↔ camelCase
├── services/          # InvoiceTemplates, DatabaseService
├── utils/             # pdfGenerator (web + mobile)
├── hooks/             # useIsMobile, useMediaQuery
├── pages/             # LoginPage, HomePage
└── config/            # constants.ts

android/
├── app/
│   ├── build.gradle   # Gradle 8.11.1, SDK 36
│   └── src/main/
│       ├── AndroidManifest.xml  # Permissions FileProvider
│       └── res/
```

### Base de données Supabase

Schema défini dans `supabase-schema.sql` :
- `users` : display_name, email, address, phone, cesu_number, iban, bic, siren, siret, business_name, business_address
- `clients` : name, address, facturation_mode (CESU/CLASSICAL), hourly_rate, mandataire (optionnel)
- `timesheets` : date_arrival, date_departure, duration, frais_repas/transport/autres, notes
- `invoices` : invoice_number, status (draft/sent/paid), total_amount, month, year, facturation_mode
- `invoice_templates` : Modèles personnalisables (future feature)

## 🔧 Configuration

### Variables d'environnement (.env)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Capacitor (capacitor.config.ts)
```typescript
{
  appId: 'com.sapsheet.app',
  appName: 'SAP Sheet',
  webDir: 'dist',
  server: { androidScheme: 'https', allowNavigation: ['*'] },
  android: { allowMixedContent: true, captureInput: true }
}
```

## 📱 Features mobiles

### Menu hamburger
- Bouton ☰ en haut à gauche (56×56px, z-index 10000)
- Backdrop transparent pour fermer
- Transition CSS smooth (300ms)

### Export PDF Android
- Génération HTML depuis templates CESU/CLASSICAL
- Encodage base64 UTF-8 pour caractères français
- Partage via Share API native → Ouvrir dans Chrome → Imprimer en PDF
- Cache Android (`Directory.Cache`) pour fichiers temporaires

### Permissions Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<provider android:name="androidx.core.content.FileProvider" ... />
```

## 🎯 Mapping snake_case ↔ camelCase

### Frontend (TypeScript camelCase)
```typescript
interface User {
  displayName: string;
  cesuNumber?: string;
  // ...
}
```

### Backend (Supabase snake_case)
```sql
CREATE TABLE users (
  display_name TEXT,
  cesu_number TEXT,
  ...
);
```

### Conversion dans authStore.ts
```typescript
updateUser: (data) => {
  const { createdAt, updatedAt, ...allowedData } = data;
  await supabase.from('users').update(allowedData).eq('id', user.id);
  await loadUser(); // Recharge avec mapping
},

loadUser: () => {
  const mappedUser = {
    displayName: data.display_name,
    cesuNumber: data.cesu_number,
    // ...
  };
}
```

## 📄 Templates de factures

### Template CESU (vert #34C759)
- Badge "POINTAGE CESU" + numéro CESU
- Tableau heures avec taux horaire
- Section frais annexes si présents
- Mentions TVA non applicable, IBAN/BIC

### Template CLASSICAL (bleu #007AFF)
- Badge "FACTURE CLASSIQUE" + SIREN/SIRET
- Info entreprise (business_name, business_address)
- Mandataire si configuré
- Layout identique aux factures professionnelles

## 🐛 Debugging

### Logs Android (Logcat)
```bash
# Dans Android Studio → Logcat (onglet bas)
# Filtrer par "capacitor" ou "sapsheet"
```

### Console web (F12)
```javascript
// Tous les stores Zustand exposent leurs données
console.log(useAuthStore.getState().user);
console.log(useTimesheetStore.getState().timesheets);
```

## 🔒 Sécurité

- `.env` **non commité** (dans `.gitignore`)
- `.env.example` fourni pour documentation
- RLS Supabase désactivé pour démo (à activer en prod avec auth Supabase)
- Clés Supabase ANON (publiques) seulement

## 🚧 Roadmap v2.0

- [ ] Synchronisation offline complète (Service Worker)
- [ ] Envoi email automatique factures (Supabase Edge Functions)
- [ ] Export PDF natif mobile (plugin react-native-html-to-pdf)
- [ ] Multi-utilisateurs avec auth Supabase (RLS activé)
- [ ] Signature électronique factures
- [ ] Dashboard analytics avancé
- [ ] Tests E2E Playwright

## 📝 Notes de développement

### Session du 26 janvier 2026
- ✅ Configuration Gradle 8.11.1 + Android SDK 36
- ✅ Menu hamburger responsive mobile
- ✅ Profil utilisateur avec mapping snake_case/camelCase
- ✅ Export PDF web + mobile (Share API)
- ✅ Templates CESU/CLASSICAL complets
- ✅ Badges statut factures (BROUILLON/ENVOYÉE/PAYÉE)
- ✅ Reports avec breakdown par client + export CSV
- ✅ Hook useIsMobile pour détecter taille écran
- ✅ Permissions Android FileProvider
- ✅ Push GitHub complet avec .gitignore

### Problèmes résolus
1. **window.open() bloqué sur Android** → Share API + Filesystem
2. **Caractères UTF-8 corrompus** → Encodage base64 avec `btoa(unescape(encodeURIComponent()))`
3. **Colonnes Supabase manquantes** → ALTER TABLE dans SQL Editor
4. **Mapping snake_case/camelCase** → Conversion dans authStore loadUser/updateUser
5. **Gradle deprecated** → Mise à jour vers 8.11.1 + SDK 36
6. **Menu mobile caché** → z-index 10000 + minWidth/minHeight fixes

## 📞 Support

Pour toute question : [GitHub Issues](https://github.com/Ovalietechboss/sapsheet/issues)

## 📄 Licence

Propriétaire - © 2026 SAP Sheet

---

**Développé avec ❤️ pour les assistantes de vie à domicile**