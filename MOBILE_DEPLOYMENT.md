# 📱 SAP Sheet - Guide de Publication Mobile

Ce guide explique comment générer et publier SAP Sheet sur l'App Store iOS et Google Play Android.

## ✅ Étape 1 : Générer le build web

```bash
npm run build
```

Cela crée le dossier `dist/` qui sera utilisé par Capacitor.

## 🍎 iOS (App Store)

### Prérequis
- Mac avec Xcode installé
- Apple Developer Account ($99/an)
- Certificat de signature provisioning profile

### Étapes

1. **Ajouter le projet iOS à Capacitor** (première fois seulement) :
```bash
npm run cap:add:ios
```

2. **Synchroniser les fichiers web vers iOS** :
```bash
npm run cap:sync
```

3. **Ouvrir le projet Xcode** :
```bash
npm run cap:open:ios
```

4. **Dans Xcode** :
   - Sélectionne "SAP Sheet" dans le target
   - Va dans "Signing & Capabilities"
   - Connecte ton Apple Developer Account
   - Configure l'équipe et le bundle identifier
   - Ajoute les capacités requises (Camera, Location, etc.)

5. **Build et publish** :
   - Product → Archive
   - Organizer → Distribute App
   - Suis les étapes pour publier sur App Store Connect

---

## 🤖 Android (Google Play)

### Prérequis
- Java SDK installé
- Android SDK installé (via Android Studio)
- Google Developer Account ($25 one-time)
- Clé de signature (keystore)

### Étapes

1. **Ajouter le projet Android à Capacitor** (première fois seulement) :
```bash
npm run cap:add:android
```

2. **Synchroniser les fichiers web vers Android** :
```bash
npm run cap:sync
```

3. **Ouvrir le projet Android Studio** :
```bash
npm run cap:open:android
```

4. **Générer une clé de signature** (première fois seulement) :
```bash
keytool -genkey -v -keystore sap-sheet.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias sap-sheet
```

5. **Configurer le fichier de build** :
   - Ouvre `android/app/build.gradle`
   - Ajoute la config de signature (avec le chemin vers sap-sheet.keystore)

6. **Build en release** :
```bash
./gradlew bundleRelease
```
(ou via Android Studio : Build → Generate Signed Bundle / APK)

7. **Publish** :
   - Va sur Google Play Console
   - Crée une nouvelle app
   - Upload le `.aab` (Android App Bundle)
   - Remplis les infos (screenshots, description, etc.)
   - Soumet pour review

---

## 🌐 PWA (Web - Bonus)

L'app fonctionne aussi comme PWA :

1. **Build web** :
```bash
npm run build
```

2. **Deploy sur un serveur** (Netlify, Vercel, etc.) :
```bash
npm run build && npm run preview
```

3. **Sur mobile** :
   - Accède au site en HTTPS
   - iOS : tap le bouton Partager → "Sur l'écran d'accueil"
   - Android : menu → "Installer l'app"

---

## 🔐 Configuration des permissions

Les permissions pour Camera, Geolocation, etc. sont déjà configurées dans `capacitor.config.ts`.

Ajoute les permissions dans les manifestes natives :
- **iOS** : Info.plist (géré automatiquement par Capacitor)
- **Android** : AndroidManifest.xml (géré automatiquement par Capacitor)

---

## 🚀 Checklist avant publication

- [ ] Version bump en package.json
- [ ] Screenshots (iOS: 1170x2532px, Android: 1080x1920px)
- [ ] Icônes (192x192 et 512x512)
- [ ] Description et keywords
- [ ] Tests sur appareil réel
- [ ] Vérifier offline mode (PWA + Capacitor)
- [ ] Tester les APIs natives (Camera, Location)
- [ ] Politique de confidentialité
- [ ] Termes d'utilisation

---

## 📝 Variables d'environnement

Ajoute des secrets si besoin :
```bash
# Dans .env.production
VITE_FIREBASE_API_KEY=xxx
VITE_BACKEND_URL=https://api.example.com
```

Accède-les dans le code :
```typescript
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
```

---

## 🐛 Troubleshooting

**App se plante au démarrage sur iOS** :
- Vérifier la console Xcode pour les erreurs
- Vérifier que le service worker est bien chargé

**Android build fails** :
- Vérifier la version de Java (Java 17+ recommandé)
- Nettoyer : `./gradlew clean`

**Capacitor ne synce pas** :
- Supprimer les dossiers `ios/` et `android/`
- Relancer `npm run cap:add:ios` et `npm run cap:add:android`

---

## 📚 Ressources

- [Capacitor Docs](https://capacitorjs.com/docs/)
- [iOS App Store Submission](https://developer.apple.com/app-store/submission/)
- [Google Play Console](https://play.google.com/console)
- [MDN PWA Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/)

---

## 💬 Support

Pour des questions spécifiques, consulte la documentation Capacitor ou contacte l'équipe de développement.
