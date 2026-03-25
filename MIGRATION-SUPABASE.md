# 🚀 Migration Supabase - SAP Sheet

## ✅ Étapes complétées

1. **Installation**: `@supabase/supabase-js` installé
2. **Configuration**: Fichier `.env.supabase.example` créé
3. **Schéma DB**: `supabase-schema.sql` avec tables + RLS
4. **Stores migrés**: authStore, clientStore, timesheetStore, invoiceStore
5. **App.tsx**: Supprimé SyncService + IndexedDB

## 📋 Prochaines étapes

### 1. Créer projet Supabase (5 min)

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Copier **URL** et **anon key** depuis Settings > API
4. Créer fichier `.env` à la racine:

```bash
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-anon-key
```

### 2. Exécuter le schéma SQL (2 min)

1. Dans Supabase Dashboard > SQL Editor
2. Copier le contenu de `supabase-schema.sql`
3. Exécuter (Run)

### 3. Lancer l'app (1 min)

```bash
npm run dev
# Ou pour Android:
npm run build && npx cap sync android && cd android && ./gradlew.bat installDebug
```

## 🎯 Avantages obtenus

- ✅ **Pas de serveur local**: Backend hébergé par Supabase
- ✅ **Sync automatique**: Plus de problèmes d'IP ou de configuration réseau
- ✅ **Web + Mobile**: Fonctionne partout sans config
- ✅ **Base Postgres**: Données structurées avec relations
- ✅ **RLS**: Isolation automatique des données par user_id
- ✅ **Temps réel**: Supabase Realtime disponible si besoin

## 📁 Fichiers créés/modifiés

### Créés
- `src/lib/supabase.ts` - Client Supabase
- `src/stores/clientStore.supabase.ts` - Store clients avec Supabase
- `src/stores/timesheetStore.supabase.ts` - Store timesheets avec Supabase
- `src/stores/invoiceStore.supabase.ts` - Store invoices avec Supabase
- `supabase-schema.sql` - Schéma DB complet
- `.env.supabase.example` - Template configuration

### Modifiés
- `App.tsx` - Supprimé SyncService, utilise nouveaux stores
- `src/stores/authStore.ts` - Remplacé IndexedDB par Supabase

### À supprimer (optionnel)
- `server/` - Serveur Node.js local (plus nécessaire)
- `src/services/SyncService.ts`
- `src/services/DatabaseService.ts`
- `src/stores/clientStore.ts` (ancien)
- `src/stores/timesheetStore.ts` (ancien)
- `src/stores/invoiceStore.ts` (ancien)

## 🔧 Note sur RLS

Le fichier `src/lib/supabase.ts` contient `setUserId()` qui configure le context RLS. **Important**: 
- Créer une fonction SQL pour `set_config` si elle n'existe pas:

```sql
CREATE OR REPLACE FUNCTION set_config(name text, value text)
RETURNS void AS $$
BEGIN
  PERFORM set_config(name, value, false);
END;
$$ LANGUAGE plpgsql;
```

Ou simplifier en utilisant directement les policies basées sur `auth.uid()` si vous utilisez Supabase Auth.
