# 🤖 Guide Complet - Tester SAP Sheet sur Android

Voici comment tester l'app SAP Sheet sur un appareil Android ou émulateur.

---

## ✅ Prérequis

- ✔️ **Java JDK** installé (tu as 1.8.0)
- ✔️ **Android SDK** installé (tu as `%LOCALAPPDATA%\Android\sdk`)
- ✔️ **Gradle** (vient avec Android SDK)
- 📱 **Téléphone Android** ou **Émulateur Android**

---

## 🚀 Étape 1 : Configurer les variables d'environnement

Ajoute les variables d'environnement pour ADB et Android SDK.

### Sur Windows

1. **Ouvre les variables d'environnement** :
   - Appuie sur `Win + X`
   - Cherche "Modifier les variables d'environnement"

2. **Ajoute/modifie les variables** :

   ```
   ANDROID_SDK_ROOT = C:\Users\[TON_USER]\AppData\Local\Android\sdk
   ANDROID_HOME = C:\Users\[TON_USER]\AppData\Local\Android\sdk
   ```

   (Remplace `[TON_USER]` par ton username Windows)

3. **Ajoute à PATH** :
   ```
   %ANDROID_SDK_ROOT%\platform-tools
   %ANDROID_SDK_ROOT%\tools
   ```

4. **Redémarre le terminal** (ou PowerShell) après les changements

### Vérifier :
```powershell
adb --version
```

Si tu vois une version, c'est bon ✅

---

## 📱 Étape 2 : Préparer ton appareil

### Option A : Téléphone Android physique

1. **Active le mode développeur** :
   - Paramètres → À propos du téléphone
   - Appuie 7 fois sur "Numéro de build"
   - Une notification "Mode développeur activé" s'affiche

2. **Active le débogage USB** :
   - Paramètres → Options de développeur
   - Active "Débogage USB"

3. **Branche le téléphone** via USB à ton PC

4. **Autorise le débogage** :
   - Une popup s'affiche sur le téléphone
   - Appuie sur "Autoriser"

5. **Vérifie la connexion** :
   ```powershell
   adb devices
   ```
   Tu devrais voir ton téléphone listé

### Option B : Émulateur Android

1. Ouvre **Android Studio**
2. Va dans **AVD Manager** (Android Virtual Device)
3. Crée ou lance un émulateur
4. L'appareil apparaît automatiquement dans `adb devices`

---

## 🏗️ Étape 3 : Générer le build web

```bash
cd c:\CODE\BMAD\_bmad-output\sap-sheet
npm run build
```

Cela crée le dossier `dist/` avec la version optimisée.

---

## 🔧 Étape 4 : Ajouter le projet Android à Capacitor

```bash
npm run cap:add:android
```

Cela crée le dossier `android/` avec le projet Gradle complet.

---

## 🚀 Étape 5 : Ouvrir dans Android Studio

```bash
npm run cap:open:android
```

Android Studio s'ouvre avec le projet `android/`.

**Attend que Gradle termine la synchronisation** (peut prendre 2-5 min).

---

## 📱 Étape 6 : Build et Run sur ton appareil

### Option 1 : Via Android Studio (UI)

1. **Dans Android Studio**, en haut, dans la barre de menu :
   - **Run** → **Run 'app'** (ou appuie sur `Shift + F10`)

2. **Sélectionne ton appareil** dans la popup

3. L'app compile et s'installe sur ton téléphone ! 🎉

### Option 2 : Via terminal (commande)

```bash
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.sapsheet.app/.MainActivity
```

---

## ✅ Résoudre les problèmes

### ❌ "adb not found" ou "gradle not found"

- Redémarre le terminal après avoir ajouté les variables d'environnement
- Vérifiede que les dossiers existent vraiment :
  ```powershell
  Test-Path "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe"
  ```

### ❌ "No connected devices" / "adb devices vide"

- Vérifiede que le téléphone autorise le débogage USB
- Sur le téléphone, appuie sur "Autoriser" dans la popup
- Relance `adb devices` après

### ❌ "Gradle build failed"

- Nettoie le cache :
  ```bash
  cd android && ./gradlew clean
  ```
- Relance la synchronisation

### ❌ "App se lance mais écran blanc"

- Ouvre la console Android Studio : **Logcat**
- Cherche les erreurs rouges
- Vérifiede que le service worker charge bien

---

## 🎯 Une fois que ça fonctionne

### Tester les fonctionnalités

1. **Connexion** : Login avec test@example.com / password
2. **Formulaires** : Ajoute un client, une feuille de temps
3. **Offline** : Désactive le WiFi/données et vérifie que ça marche toujours
4. **LocalStorage** : Les données persistent après fermeture

### Déboguer sur l'appareil

- En USB, tu peux ouvrir Chrome DevTools :
  ```
  chrome://inspect/#devices
  ```
- Clique sur "Inspect" pour déboguer en live

---

## 🔄 Workflow de développement

Pour chaque changement de code :

1. **Modifie** le code (ex: `src/pages/HomePage.tsx`)
2. **Build** :
   ```bash
   npm run build
   npm run cap:sync
   ```
3. **Relance sur l'appareil** :
   ```
   Run 'app' dans Android Studio
   ```

---

## 📦 Préparer pour Google Play

Une fois que tu es satisfait du test :

1. **Version bump** dans `package.json` et `android/app/build.gradle`
2. **Générer une clé de signature** :
   ```bash
   keytool -genkey -v -keystore sap-sheet.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias sap-sheet
   ```
3. **Build en release** :
   ```bash
   cd android && ./gradlew bundleRelease
   ```
4. **Upload** sur Google Play Console

---

## ✨ Checklist rapide

- [ ] Java JDK installé
- [ ] Android SDK dans les variables d'environnement
- [ ] `adb devices` montre ton appareil
- [ ] `npm run build` réussit
- [ ] `npm run cap:add:android` réussit
- [ ] Android Studio ouvre le projet sans erreurs
- [ ] App s'installe et lance sur l'appareil
- [ ] L'écran de connexion s'affiche

---

**Tu es prêt ? Commence à l'étape 1 ! 🚀**
