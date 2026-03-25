# 🚀 SAP Sheet - Configuration Capacitor Complétée

Capacitor est maintenant configuré pour générer des apps natives iOS/Android. Voici ce qui a été mis en place :

## ✅ Ce qui est fait

1. **Capacitor installé** avec CLI, iOS, et Android
2. **capacitor.config.ts** créé avec configuration d'app ID et plugins
3. **Service Worker** enregistré pour offline support (PWA)
4. **manifest.json** créé pour PWA et App Store
5. **index.html** mis à jour avec meta tags PWA
6. **Scripts npm** ajoutés pour Capacitor
7. **Documentation complète** : `MOBILE_DEPLOYMENT.md`

## 📦 Structure Capacitor

```
sap-sheet/
├── capacitor.config.ts      # Configuration Capacitor
├── public/
│   ├── manifest.json        # PWA manifest
│   └── sw.js               # Service Worker
├── MOBILE_DEPLOYMENT.md     # Guide de publication
└── dist/                    # Build web (généré par `npm run build`)
```

## 🎯 Prochaines étapes

### Étape 1 : Build web
```bash
npm run build
```

### Étape 2 : Ajouter iOS (Mac requis)
```bash
npm run cap:add:ios
npm run cap:open:ios
```
Puis tu configures la signature dans Xcode.

### Étape 3 : Ajouter Android
```bash
npm run cap:add:android
npm run cap:open:android
```
Puis tu configures le keystore et la signature.

### Étape 4 : Tester sur appareil
- iOS : brancher iPhone + Xcode
- Android : brancher téléphone + Android Studio

### Étape 5 : Publier
- Voir `MOBILE_DEPLOYMENT.md` pour les détails complets

## 🔧 Commandes principales

```bash
npm run build              # Build web (requis avant tous les autres)
npm run cap:build         # Build + sync Capacitor
npm run cap:open:ios      # Ouvre Xcode
npm run cap:open:android  # Ouvre Android Studio
npm run cap:sync          # Sync les changements web vers les apps natives
npm run cap:update        # Update Capacitor et plugins
```

## 📱 Plugins inclus

- **@capacitor/camera** - Accès caméra
- **@capacitor/geolocation** - GPS/Localisation
- **@capacitor/device** - Info appareil

Ajoute d'autres plugins au besoin :
```bash
npm install @capacitor/notifications --save --legacy-peer-deps
```

## 🌐 PWA aussi disponible

Sans mobile native, tu peux aussi déployer la PWA sur n'importe quel serveur web :
```bash
npm run build
npm run preview
```

## ⚠️ Important

- Le dossier `dist/` est le résultat du build web - ne le commit pas
- Les dossiers `ios/` et `android/` seront créés avec `cap:add:ios` et `cap:add:android`
- Tu dois faire un `npm run build` avant chaque `cap:sync`

## 🆘 Besoin d'aide ?

Voir `MOBILE_DEPLOYMENT.md` ou la [doc Capacitor](https://capacitorjs.com/docs/).

---

**Tu es maintenant prêt à générer les apps natives !** 🎉
