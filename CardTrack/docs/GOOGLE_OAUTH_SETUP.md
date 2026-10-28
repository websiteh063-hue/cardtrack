# Google Cloud OAuth & Google Drive Backup Configuration Guide

CardTrack features an optional, end-to-end encrypted backup and restore engine that synchronizes your private financial records with Google Drive. Normal app usage is 100% offline and never requires Google Drive.

---

## 1. Google Cloud Project Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** > **New Project**.
3. Name your project (e.g., `CardTrack-Personal-Backup`) and click **Create**.
4. In the left navigation menu, navigate to **APIs & Services** > **Library**.
5. Search for **Google Drive API** and click **Enable**.

---

## 2. Configure OAuth Consent Screen

1. In the left navigation menu, go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace) and click **Create**.
3. Provide the App information:
   - **App name**: `CardTrack`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**.
6. Select the minimum required Google Drive scopes:
   - `https://www.googleapis.com/auth/drive.appdata` — Allows CardTrack to create and manage its own private, isolated backup files in the user's hidden Application Data folder. CardTrack **cannot** view, read, or modify the user's personal documents, photos, or files.
   - `https://www.googleapis.com/auth/drive.file` — View and manage Google Drive files that you have opened or created with this app.
7. Click **Save and Continue**.
8. Under **Test Users**, add your personal Google account email address so you can authorize backups during testing.
9. Click **Save and Continue** > **Back to Dashboard**.

---

## 3. Create OAuth 2.0 Client IDs

### A. Android Client ID
1. In the left navigation menu, go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Android** as Application type.
4. Set the Package name to match CardTrack's Android package:
   ```
   com.cardtrack.app
   ```
5. Retrieve your SHA-1 certificate fingerprint from your local debug or production keystore:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
6. Paste the SHA-1 fingerprint and click **Create**.

### B. Web / Redirect Client ID (for Expo AuthSession)
1. In **Credentials**, click **Create Credentials** > **OAuth client ID**.
2. Select **Web application**.
3. Name: `CardTrack Web Redirect Client`.
4. Under **Authorized redirect URIs**, add:
   - `https://auth.expo.io/@your-expo-username/cardtrack`
   - `cardtrack://oauthredirect`
5. Click **Create**. Copy the **Client ID** (do not commit Client Secrets into public Git repositories).

---

## 4. End-to-End Authenticated Encryption Workflow

CardTrack employs an authenticated cryptographic pipeline before uploading any data to Google Drive:

```
[ Local SQLite Database ]
            │
            ▼
[ JSON Serialization: People, Cards, Transactions, Milestones ]
            │
            ▼
[ Compute SHA-256 Checksum ]
            │
            ▼
[ User Passphrase + 16-byte Random Salt ] ──> PBKDF2 (100,000 iterations) ──> AES-256 Key
            │
            ▼
[ AES-256-GCM Authenticated Encryption ] ──> Encrypted Ciphertext + 12-byte IV + Auth Tag
            │
            ▼
[ Multipart Upload to Google Drive /appDataFolder ]
```

### Safety and Restoration Guarantees
- **No Plaintext Cloud Storage:** Credit card details and financial balances are never transmitted in plaintext.
- **Separate Encryption Keys:** Encryption keys are derived on the fly from the user's passphrase and are never uploaded alongside the backup.
- **Integrity Verification:** During restoration, CardTrack verifies the SHA-256 checksum and AES-GCM authentication tag. If tampering or corruption is detected, restoration is safely aborted.
- **No Silent Overwrites:** Restoring a backup merges records safely using unique IDs and prevents accidental data duplication.
