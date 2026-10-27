// src/services/googleDrive.ts - Google Drive Backup & Authenticated AES-GCM Encryption Engine

import { IDatabase } from '../db/database';
import {
  Person,
  CreditCard,
  Transaction,
  Milestone,
  EncryptedBackupPayload,
  BackupMetadata,
} from '../types';
import { getAllPeople, createPerson } from '../db/peopleRepo';
import { getAllCards, createCard } from '../db/cardsRepo';
import { getAllTransactions, createTransaction } from '../db/transactionsRepo';
import { getAllMilestones, createMilestone } from '../db/milestonesRepo';
import { CURRENT_SCHEMA_VERSION } from '../db/schema';
import {
  encryptText,
  decryptText,
  computeSHA256Checksum,
} from './crypto';

export interface DriveFileInfo {
  id: string;
  name: string;
  createdTime: string;
  size: number;
}

/**
 * Generates an encrypted backup payload using AES-256-GCM and PBKDF2.
 * Never includes CVC/CVV (since app never stores it).
 */
export async function createEncryptedBackupPayload(
  db: IDatabase,
  passphrase: string
): Promise<{ payload: EncryptedBackupPayload; jsonString: string }> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('A strong passphrase of at least 4 characters is required to encrypt your backup.');
  }

  const people = await getAllPeople(db);
  const cards = await getAllCards(db);
  const transactions = await getAllTransactions(db);
  const milestones = await getAllMilestones(db);

  const rawData = {
    version: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    people,
    cards,
    transactions,
    milestones,
  };

  const rawJson = JSON.stringify(rawData);
  const checksum = await computeSHA256Checksum(rawJson);

  // Authenticated encryption (AES-256-GCM)
  const { ciphertext, iv, salt } = await encryptText(rawJson, passphrase);

  const metadata: BackupMetadata = {
    version: 1,
    appName: 'CardTrack',
    exportDate: new Date().toISOString(),
    databaseSchemaVersion: CURRENT_SCHEMA_VERSION,
    peopleCount: people.length,
    cardsCount: cards.length,
    transactionsCount: transactions.length,
    milestonesCount: milestones.length,
    checksum,
  };

  const payload: EncryptedBackupPayload = {
    version: 1,
    encrypted: true,
    salt,
    iv,
    ciphertext,
    metadata,
  };

  return {
    payload,
    jsonString: JSON.stringify(payload, null, 2),
  };
}

/**
 * Validates, decrypts and previews an encrypted backup file before restoration.
 */
export async function previewEncryptedBackup(
  backupJson: string,
  passphrase: string
): Promise<{
  metadata: BackupMetadata;
  people: Person[];
  cards: CreditCard[];
  transactions: Transaction[];
  milestones: Milestone[];
}> {
  let parsedPayload: EncryptedBackupPayload;
  try {
    parsedPayload = JSON.parse(backupJson);
  } catch {
    throw new Error('Malformed backup file: Invalid JSON format.');
  }

  if (!parsedPayload.encrypted || !parsedPayload.ciphertext || !parsedPayload.iv || !parsedPayload.salt) {
    throw new Error('Invalid backup file structure: Missing cryptographic fields.');
  }

  let decryptedJson: string;
  try {
    decryptedJson = await decryptText(
      parsedPayload.ciphertext,
      parsedPayload.iv,
      parsedPayload.salt,
      passphrase
    );
  } catch {
    throw new Error('Decryption failed: Incorrect passphrase or corrupted backup file.');
  }

  // Integrity Check: Verify SHA-256 checksum
  const computedChecksum = await computeSHA256Checksum(decryptedJson);
  if (parsedPayload.metadata?.checksum && parsedPayload.metadata.checksum !== computedChecksum) {
    throw new Error('Integrity check failed: Backup data checksum mismatch. The file may have been tampered with or corrupted.');
  }

  const data = JSON.parse(decryptedJson);
  return {
    metadata: parsedPayload.metadata,
    people: data.people || [],
    cards: data.cards || [],
    transactions: data.transactions || [],
    milestones: data.milestones || [],
  };
}

/**
 * Restores decrypted records into the local database safely within a transaction.
 */
export async function restoreRecordsIntoDatabase(
  db: IDatabase,
  records: {
    people: Person[];
    cards: CreditCard[];
    transactions: Transaction[];
    milestones: Milestone[];
  },
  replaceExisting: boolean = false
): Promise<{ people: number; cards: number; transactions: number; milestones: number }> {
  let restored = { people: 0, cards: 0, transactions: 0, milestones: 0 };

  await db.withTransactionAsync(async () => {
    if (replaceExisting) {
      await db.runAsync('DELETE FROM milestones;');
      await db.runAsync('DELETE FROM transactions;');
      await db.runAsync('DELETE FROM credit_cards;');
      await db.runAsync('DELETE FROM people;');
    }

    const existingPeople = await getAllPeople(db);
    const existingPeopleIds = new Set(existingPeople.map(p => p.id));
    for (const p of records.people) {
      if (!existingPeopleIds.has(p.id)) {
        await createPerson(db, p);
        restored.people++;
      }
    }

    const existingCards = await getAllCards(db);
    const existingCardIds = new Set(existingCards.map(c => c.id));
    for (const c of records.cards) {
      if (!existingCardIds.has(c.id)) {
        await createCard(db, c);
        restored.cards++;
      }
    }

    const existingTx = await getAllTransactions(db);
    const existingTxIds = new Set(existingTx.map(t => t.id));
    for (const t of records.transactions) {
      if (!existingTxIds.has(t.id)) {
        await createTransaction(db, t);
        restored.transactions++;
      }
    }

    const existingMilestones = await getAllMilestones(db);
    const existingMilestoneIds = new Set(existingMilestones.map(m => m.id));
    for (const m of records.milestones) {
      if (!existingMilestoneIds.has(m.id)) {
        await createMilestone(db, m);
        restored.milestones++;
      }
    }
  });

  return restored;
}

/**
 * Google Drive REST API Client for CardTrack Backups
 * Uses application data folder or drive.file scope for maximum user privacy.
 */
export class GoogleDriveBackupService {
  private accessToken: string | null = null;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || null;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Lists backup files stored in Google Drive appDataFolder.
   */
  async listBackups(): Promise<DriveFileInfo[]> {
    if (!this.accessToken) {
      throw new Error('Google Drive is not authenticated.');
    }

    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime,size)&orderBy=createdTime desc',
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to list Google Drive backups: ${err}`);
    }

    const data = await response.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      size: Number(f.size || 0),
    }));
  }

  /**
   * Uploads an encrypted backup file to Google Drive.
   */
  async uploadBackup(fileName: string, backupContent: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Google Drive is not authenticated.');
    }

    const metadata = {
      name: fileName,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      backupContent +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to upload backup to Google Drive: ${err}`);
    }

    const result = await response.json();
    return result.id;
  }

  /**
   * Downloads a backup file's content from Google Drive by file ID.
   */
  async downloadBackup(fileId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Google Drive is not authenticated.');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to download backup from Google Drive: ${err}`);
    }

    return await response.text();
  }

  /**
   * Deletes a backup file from Google Drive.
   */
  async deleteBackup(fileId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Google Drive is not authenticated.');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const err = await response.text();
      throw new Error(`Failed to delete backup from Google Drive: ${err}`);
    }
  }
}
