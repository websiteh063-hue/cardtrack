# CardTrack Security and Financial Data Protection Architecture

CardTrack is engineered as an offline-first financial manager prioritizing user privacy, cryptographic integrity, and adherence to international security standards.

---

## 1. Zero CVC/CVV Persistence Guarantee

**Policy:** CardTrack strictly prohibits saving, caching, logging, exporting, or backing up Card Verification Codes (CVC/CVV).

### Architectural Implementation:
1. **No Database Schema Column:** The `credit_cards` SQLite table contains no column for CVC or CVV. Attempting to pass a CVC value to the data access layer has no target column.
2. **Import Sanitization:** The Excel import engine actively inspects incoming worksheets for any column names matching `/cvv|cvc|security.code/i`. If detected, those columns are immediately stripped and discarded in memory, and the user is presented with a prominent security notification.
3. **Export Sanitization:** The multi-worksheet `.xlsx` generator completely omits any verification codes.
4. **Log & Crash Hygiene:** CardTrack contains no logging interceptors that print payment authentication values.

---

## 2. Card Number Protection & Default Masking

1. **Default Safer Storage (Last 4 Digits):**
   - By default, CardTrack stores only the last 4 digits of a credit card (e.g., `5432`).
   - This provides sufficient identification for statement matching and milestone management without creating unnecessary financial vulnerability.
2. **Optional Full Card Storage:**
   - If the user explicitly enables full card number storage, the number is encrypted before insertion into the local database using AES-256-GCM.
   - Plaintext card numbers are never stored in SQLite.
3. **Interface Masking:**
   - On all screens, search results, and portfolio cards, the card number is masked by default (`•••• •••• •••• 5432`).
4. **Biometric / PIN Reveal Barrier:**
   - Tapping "Reveal" on a card invokes the Android BiometricPrompt framework (`expo-local-authentication`). The user must authenticate with a fingerprint, face scan, or device PIN before the number is decrypted and displayed on screen.

---

## 3. Local SQLite Storage Isolation

1. **Private Sandbox Directory:**
   - The SQLite database file (`cardtrack.db`) is stored in the application's internal private storage directory (`Context.getFilesDir()` / `FileSystem.documentDirectory`).
   - On Android, application private directories are sandboxed by the Linux kernel using unique Unix UIDs. Other apps on the device cannot access or read the CardTrack database without root privileges.
2. **Fresh Installation Guarantee:**
   - Each new installation initializes an empty database with no shared records or hardcoded mock data.
   - All financial figures and milestone progress bars reflect the user's authentic local transactions.

---

## 4. Authenticated Cloud Backups (AES-256-GCM)

1. **Passphrase-Derived Keys (PBKDF2):**
   - Backups are encrypted client-side using a user-selected passphrase.
   - PBKDF2 runs 100,000 iterations with a 16-byte cryptographically secure random salt to derive a 256-bit AES key.
2. **Authenticated Encryption (AES-GCM):**
   - The backup payload is encrypted using AES-GCM with a 12-byte random IV.
   - An authentication tag verifies that the backup cannot be tampered with in transit.
3. **SHA-256 Checksum:**
   - A SHA-256 digest is embedded in the encrypted payload metadata.
   - Upon restoration, CardTrack verifies the checksum before committing records into the local database.

---

## 5. Decimal-Safe Minor Unit Monetary Arithmetic

To prevent floating-point rounding errors common in IEEE 754 arithmetic (e.g. `0.1 + 0.2 !== 0.3`):
- All monetary amounts in the database are stored as **integer minor units (paise)**.
- `₹100.50` is stored as `10050`.
- Indian numbering system formatting (`₹1,00,000.00`) is handled during view rendering and Excel export.
