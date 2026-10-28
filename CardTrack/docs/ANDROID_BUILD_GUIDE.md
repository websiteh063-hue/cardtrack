# CardTrack — Android Build and APK Distribution Guide

This guide describes how to build, package, test, and distribute CardTrack as a standalone native Android application (`.apk` or `.aab`).

---

## 1. Prerequisites

Ensure your development environment contains:
- **Node.js**: v20+ or v24+
- **Package Manager**: `npm` or `pnpm`
- **Java Development Kit**: OpenJDK 17 or Eclipse Temurin 17
- **Android SDK**: Build Tools `34.0.0`+, Platform `android-34`+
- **Environment Variables**:
  ```powershell
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17..."
  $env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:PATH"
  ```

---

## 2. Option A: Build Standalone APK with Expo Application Services (EAS Build)

EAS Build provides cloud and local containerized builds to produce distributable APK files without requiring complex local Android Studio setups.

### Step 1: Install EAS CLI and Log In
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure Project
Verify that `eas.json` exists in your project root with the `preview` profile configured for APK output:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Step 3: Trigger APK Build
Run:
```bash
eas build --platform android --profile preview
```

### Step 4: Download and Install APK
Once the build completes, EAS outputs a direct download link for the standalone `.apk`.
Transfer it to your Android device or install via ADB:
```bash
adb install CardTrack_Preview.apk
```

---

## 3. Option B: Local Android Native Build (Gradle)

If you have Android SDK and Gradle installed locally:

### Step 1: Generate Native Android Project Files
Run Expo Prebuild:
```bash
npx expo prebuild --platform android
```
This generates the native `android/` directory containing the Gradle build scripts and Android manifest.

### Step 2: Build Release APK
Navigate to the `android/` directory and run Gradle:
```bash
cd android
./gradlew assembleRelease
```
*(On Windows PowerShell: `.\gradlew.bat assembleRelease`)*

### Step 3: Locate Distributable APK
The generated release APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 4: Sideload onto Android Phone
Connect your phone via USB with USB Debugging enabled, then execute:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Option C: Run in Local Development Mode

To test live in the Expo Go client or on a connected Android device:
```bash
npm start
# or
npm run android
```
Press `a` in the terminal to open the application automatically on the connected Android emulator or USB device.
