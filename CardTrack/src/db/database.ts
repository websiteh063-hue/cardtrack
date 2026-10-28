// src/db/database.ts - Database connection, migrations & transactions

import { CURRENT_SCHEMA_VERSION, SQL_CREATE_TABLES, SQL_CREATE_INDEXES } from './schema';

export interface IDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ rowsAffected: number; insertId?: number }>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync(callback: () => Promise<void>): Promise<void>;
  closeAsync?(): Promise<void>;
}

// In-Memory SQLite Implementation for Tests and Environments without Native Expo SQLite
export class InMemoryDatabase implements IDatabase {
  public tables: Map<string, any[]> = new Map();
  private inTransaction = false;
  private transactionSnapshot: Map<string, any[]> | null = null;

  constructor() {
    this.tables.set('schema_migrations', []);
    this.tables.set('people', []);
    this.tables.set('credit_cards', []);
    this.tables.set('transactions', []);
    this.tables.set('milestones', []);
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        if (match && match[1]) {
          const tableName = match[1].toLowerCase();
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, []);
          }
        }
      } else if (stmt.toUpperCase().startsWith('DROP TABLE')) {
        const match = stmt.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
        if (match && match[1]) {
          this.tables.delete(match[1].toLowerCase());
        }
      }
    }
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ rowsAffected: number; insertId?: number }> {
    const upper = sql.trim().toUpperCase();

    if (upper.startsWith('INSERT INTO')) {
      const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const columns = match[2].split(',').map(c => c.trim().toLowerCase());
        const row: Record<string, any> = {};

        columns.forEach((col, idx) => {
          row[col] = params[idx] !== undefined ? params[idx] : null;
        });

        const table = this.tables.get(tableName) || [];
        table.push(row);
        this.tables.set(tableName, table);
        return { rowsAffected: 1 };
      }
    } else if (upper.startsWith('UPDATE')) {
      const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const setPart = match[2];
        const wherePart = match[3];

        const setCols = setPart.split(',').map(s => s.replace(/\s+/g, ' ').trim().split('=')[0].trim().toLowerCase());
        const whereMatch = wherePart.match(/(\w+)\s*=\s*\?/i);
        const whereCol = whereMatch ? whereMatch[1].toLowerCase() : 'id';

        const setParamCount = setCols.length;
        const setValues = params.slice(0, setParamCount);
        const whereVal = params[setParamCount];

        const table = this.tables.get(tableName) || [];
        let count = 0;

        for (const row of table) {
          if (row[whereCol] === whereVal) {
            setCols.forEach((col, i) => {
              row[col] = setValues[i];
            });
            count++;
          }
        }
        return { rowsAffected: count };
      }
    } else if (upper.startsWith('DELETE FROM')) {
      const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const wherePart = match[2];

        if (!wherePart) {
          const count = (this.tables.get(tableName) || []).length;
          this.tables.set(tableName, []);
          return { rowsAffected: count };
        }

        const whereMatch = wherePart.match(/(\w+)\s*=\s*\?/i);
        const whereCol = whereMatch ? whereMatch[1].toLowerCase() : 'id';
        const whereVal = params[0];

        const table = this.tables.get(tableName) || [];
        const filtered = table.filter(r => r[whereCol] !== whereVal);
        const count = table.length - filtered.length;
        this.tables.set(tableName, filtered);
        return { rowsAffected: count };
      }
    }

    return { rowsAffected: 0 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const match = sql.match(/FROM\s+(\w+)/i);
    if (!match) return [];
    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName) || [];

    // Filter by single WHERE condition if present
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const col = whereMatch[1].toLowerCase();
      const val = params[0];
      return table.filter(r => r[col] === val).map(r => ({ ...r })) as T[];
    }

    return table.map(r => ({ ...r })) as T[];
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    this.inTransaction = true;
    // Snapshot state for rollback
    this.transactionSnapshot = new Map();
    for (const [key, val] of this.tables.entries()) {
      this.transactionSnapshot.set(key, JSON.parse(JSON.stringify(val)));
    }

    try {
      await callback();
      this.transactionSnapshot = null;
    } catch (err) {
      if (this.transactionSnapshot) {
        this.tables = this.transactionSnapshot;
        this.transactionSnapshot = null;
      }
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  async closeAsync(): Promise<void> {
    this.tables.clear();
  }
}

// Global active database instance
let activeDb: IDatabase | null = null;

/**
 * Initializes and opens the SQLite database.
 * Sets up PRAGMA, runs schema migrations, and returns IDatabase.
 */
export async function getDatabase(): Promise<IDatabase> {
  if (activeDb) {
    return activeDb;
  }

  try {
    // Attempt to load expo-sqlite if in React Native / Expo environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SQLite = require('expo-sqlite');
    if (SQLite && typeof SQLite.openDatabaseAsync === 'function') {
      const nativeDb = await SQLite.openDatabaseAsync('cardtrack.db');

      const adapter: IDatabase = {
        async execAsync(sql: string) {
          await nativeDb.execAsync(sql);
        },
        async runAsync(sql: string, params: any[] = []) {
          const res = await nativeDb.runAsync(sql, params);
          return { rowsAffected: res.changes, insertId: res.lastInsertRowId };
        },
        async getAllAsync<T>(sql: string, params: any[] = []) {
          return await nativeDb.getAllAsync(sql, params);
        },
        async getFirstAsync<T>(sql: string, params: any[] = []) {
          return await nativeDb.getFirstAsync(sql, params);
        },
        async withTransactionAsync(callback: () => Promise<void>) {
          await nativeDb.withTransactionAsync(callback);
        },
        async closeAsync() {
          await nativeDb.closeAsync();
        },
      };

      activeDb = adapter;
      await initDatabase(activeDb);
      return activeDb;
    }
  } catch {
    // In-memory fallback for test and non-native environments
  }

  const memoryDb = new InMemoryDatabase();
  activeDb = memoryDb;
  await initDatabase(activeDb);
  return activeDb;
}

/**
 * Sets a custom database instance (useful for unit testing).
 */
export function setDatabaseInstance(db: IDatabase | null): void {
  activeDb = db;
}

/**
 * Runs DDL and schema migrations to bring database up to date.
 */
export async function initDatabase(db: IDatabase): Promise<void> {
  // Enable foreign keys
  try {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  } catch {
    // Ignored in mock DB
  }

  // Create tables
  for (const tableSql of SQL_CREATE_TABLES) {
    await db.execAsync(tableSql);
  }

  // Create indexes
  for (const indexSql of SQL_CREATE_INDEXES) {
    await db.execAsync(indexSql);
  }

  // Record migration version if not already applied
  const migration = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = ?',
    [CURRENT_SCHEMA_VERSION]
  );

  if (!migration) {
    await db.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [CURRENT_SCHEMA_VERSION, new Date().toISOString()]
    );
  }
}

/**
 * Resets the entire local database.
 * Deletes all records from all tables safely.
 */
export async function resetDatabase(db: IDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM milestones;');
    await db.runAsync('DELETE FROM transactions;');
    await db.runAsync('DELETE FROM credit_cards;');
    await db.runAsync('DELETE FROM people;');
  });
}
