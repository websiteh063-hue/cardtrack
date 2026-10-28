# CardTrack — Personal Credit Card and Milestone Manager

[![React Native](https://img.shields.io/badge/React%20Native-0.88.0-blue.svg)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2058-black.svg)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/Database-Local%20SQLite-003B57.svg)](https://www.sqlite.org)
[![Security](https://img.shields.io/badge/Security-Zero%20CVC%20%7C%20AES--256--GCM-green.svg)](#security-guarantees)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

A production-ready Android mobile application engineered to manage multi-person credit card portfolios, manual financial transactions, milestone-based reward tracking, and automated spend calculations. 

CardTrack prioritizes **complete local privacy**, **100% offline functionality**, **independent local SQLite storage**, **genuine multi-worksheet Excel (.xlsx) import/export**, and **authenticated AES-256-GCM Google Drive backups**.

---

## Key Features

### 1. Multi-Person & Credit Card Portfolio Management
- **Multiple Profiles**: Manage separate profiles for family members, business partners, or dependents.
- **Card Association**: Assign multiple cards per person with detailed card attributes (Bank, Issuer, Network, Credit Limit, Annual Fee, Statement Date, Due Date, Status).
- **Cascade Deletion Safeguards**: Deleting a person prompts an explicit impact review detailing all cards, transactions, and milestones that will be removed.

### 2. Manual Transaction Tracking & Monetary Integrity
- **Manual Input**: Zero scraping or banking credential requests. Enter purchases, refunds, reversals, and adjustments manually.
- **Decimal-Safe Minor Units**: Stored as integer paise (`₹1 = 100 paise`) to eliminate floating-point rounding inaccuracies.
- **Refund Logic**: Refunds and reversals automatically reduce eligible milestone spending.
- **Milestone Eligibility**: Toggle eligibility flags to match bank reward exclusions (fuel, wallet loads, rent).

### 3. Automated Milestone Calculations & Reward Tracking
- **Spending & Count Milestones**: Automatic tracking against target amounts or transaction counts.
- **Dynamic Recalculation**: Adding, editing, or deleting a transaction instantly recalculates milestone progress and completion status.
- **Deadline Tracking**: Countdown badges for approaching deadlines.

### 4. Global Instant Offline Search
- Search across people names, cardholder names, card nicknames, bank names, issuers, and last 4 card digits with debounced instant results.
- Tapping a profile generates a full financial dossier (total cards, spending, recent transactions, milestone status).

### 5. Genuine Multi-Worksheet Excel (.xlsx) Import & Export
- **Export**: Generates a genuine `.xlsx` workbook containing 5 worksheets:
  1. `People`
  2. `Credit Cards` (strictly last 4 digits only; no CVC/CVV)
  3. `Transactions`
  4. `Milestones`
  5. `Summary Report`
- **Import**: Multi-worksheet parser with validation report, error rows breakdown, duplicate detection, and transactional rollback.
- **Downloadable Template**: Built-in template generator with sample records.

### 6. Authenticated Encrypted Google Drive Backup
- **End-to-End Encryption**: Authenticated AES-256-GCM encryption with PBKDF2 (100,000 iterations).
- **Integrity Check**: SHA-256 checksums verify backups before restoration.
- **Non-Destructive Restoration**: Safe merging prevents data loss or duplicates.

### 7. App Lock & Biometric Protection
- Protect app access and full card numbers with Android BiometricPrompt (fingerprint/face) or device PIN.

---

## Security Guarantees

| Requirement | Implementation in CardTrack |
| :--- | :--- |
| **CVC / CVV Storage** | **STRICT ZERO PERSISTENCE.** No database column exists. Stripped on import. |
| **Full Card Number** | Masked by default (`•••• •••• •••• 1234`). Full storage is optional and encrypted with AES-256-GCM. Unlocking requires biometric authentication. |
| **Local Storage** | SQLite database stored in Android's private, sandboxed app directory (`Context.getFilesDir()`). |
| **Cloud Backups** | Client-side encrypted with AES-256-GCM before upload. Keys never touch Google Drive. |
| **No Analytics/Tracking** | Zero telemetry, zero tracking, zero third-party analytics SDKs. |

---

## Project Structure

```
CardTrack/
├── App.tsx                     # Main application entry & tab navigation shell
├── app.json                    # Expo configuration & Android permissions
├── eas.json                    # EAS build configuration for APK distribution
├── src/
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces & domain models
│   ├── db/
│   │   ├── schema.ts           # SQLite DDL tables, indexes & migration registry
│   │   ├── database.ts         # Database connection, transactions & in-memory mock
│   │   ├── peopleRepo.ts       # People profile CRUD & cascade queries
│   │   ├── cardsRepo.ts        # Credit card CRUD & filtering
│   │   ├── transactionsRepo.ts # Transaction CRUD & milestone triggers
│   │   ├── milestonesRepo.ts   # Milestone CRUD & progress queries
│   │   └── statsRepo.ts        # Dashboard statistics & portfolio aggregations
│   ├── services/
│   │   ├── calculations.ts     # Pure financial math, INR formatting & progress
│   │   ├── crypto.ts           # AES-256-GCM, PBKDF2, SHA-256, and card masking
│   │   ├── excelExport.ts      # Multi-worksheet .xlsx generator & template builder
│   │   ├── excelImport.ts      # .xlsx parser, validation & duplicate handling
│   │   ├── googleDrive.ts      # Encrypted backup serialization & Drive API v3
│   │   ├── search.ts           # Global search engine & personal dossier builder
│   │   └── auth.ts             # Biometrics & PIN lock via LocalAuthentication
│   ├── context/
│   │   ├── AppContext.tsx      # Reactive application state & SQLite sync
│   │   └── ThemeContext.tsx    # Luxury dark & clean light theme provider
│   ├── components/
│   │   ├── common/             # Button, Input, ProgressBar, ConfirmationModal
│   │   ├── CreditCardView.tsx  # Luxury visual credit card component
│   │   ├── MilestoneCard.tsx   # Milestone progress visualizer
│   │   └── TransactionRow.tsx  # Transaction list item with status indicators
│   └── screens/
│       ├── DashboardScreen.tsx # Financial dashboard & approaching goals
│       ├── PeopleScreen.tsx    # People management & profile dossiers
│       ├── CardsScreen.tsx     # Card portfolio & secure reveal
│       ├── TransactionsScreen.tsx # Manual transactions & filtering
│       ├── MilestonesScreen.tsx# Milestone tracking & progress bars
│       ├── SearchScreen.tsx    # Global instant search modal
│       └── SettingsScreen.tsx  # App lock, Excel import/export & Drive backup
├── tests/
│   └── cardtrack.test.ts       # Comprehensive automated test suite (20 tests)
└── docs/
    ├── GOOGLE_OAUTH_SETUP.md   # Google Cloud OAuth & Drive configuration
    ├── ANDROID_BUILD_GUIDE.md  # Local Gradle & EAS APK build instructions
    └── SECURITY_ARCHITECTURE.md# Security design & cryptographic guarantees
```

---

## Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Running in Development
Start the Expo development server:
```bash
npm start
```
- Press `a` to open on an Android emulator or connected device via USB.
- Press `w` to open in a web browser.

### 3. Running Automated Tests
Execute the comprehensive test suite verifying all 20 project requirements:
```bash
npm test
```

---

## Building a Standalone Android APK

See [docs/ANDROID_BUILD_GUIDE.md](docs/ANDROID_BUILD_GUIDE.md) for detailed instructions.

**Quick EAS Build (Cloud):**
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

**Quick Local Gradle Build:**
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
The distributable `.apk` file is located at `android/app/build/outputs/apk/release/app-release.apk`.

---

## Google Drive Setup

See [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md) for full instructions on setting up Google Cloud OAuth 2.0 client credentials and restricting access to the private `drive.appdata` application folder.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
