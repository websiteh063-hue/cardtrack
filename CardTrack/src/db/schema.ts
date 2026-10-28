// src/db/schema.ts - Database Schema DDL & Migrations

export const CURRENT_SCHEMA_VERSION = 1;

export const SQL_CREATE_TABLES = [
  // Migrations table
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`,

  // People table
  `CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // Credit Cards table
  // SECURITY REQUIREMENT: No CVC/CVV column exists!
  `CREATE TABLE IF NOT EXISTS credit_cards (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    cardholder_name TEXT NOT NULL,
    card_nickname TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    card_issuer TEXT NOT NULL,
    card_network TEXT NOT NULL,
    last_four_digits TEXT NOT NULL,
    encrypted_full_number TEXT,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    total_credit_limit INTEGER NOT NULL,
    annual_fee INTEGER NOT NULL,
    opening_date TEXT,
    statement_generation_day INTEGER,
    payment_due_day INTEGER,
    card_status TEXT NOT NULL DEFAULT 'Active',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // Transactions table
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    transaction_date TEXT NOT NULL,
    merchant_name TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    transaction_status TEXT NOT NULL,
    is_milestone_eligible INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // Milestones table
  `CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    milestone_name TEXT NOT NULL,
    description TEXT,
    milestone_type TEXT NOT NULL,
    target_amount INTEGER NOT NULL DEFAULT 0,
    target_transaction_count INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    reward_description TEXT,
    status TEXT NOT NULL DEFAULT 'In Progress',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];

export const SQL_CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_people_name ON people(full_name);`,
  `CREATE INDEX IF NOT EXISTS idx_cards_person ON credit_cards(person_id);`,
  `CREATE INDEX IF NOT EXISTS idx_cards_nickname ON credit_cards(card_nickname);`,
  `CREATE INDEX IF NOT EXISTS idx_cards_last4 ON credit_cards(last_four_digits);`,
  `CREATE INDEX IF NOT EXISTS idx_cards_bank ON credit_cards(bank_name);`,
  `CREATE INDEX IF NOT EXISTS idx_tx_card ON transactions(card_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tx_person ON transactions(person_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);`,
  `CREATE INDEX IF NOT EXISTS idx_tx_eligible ON transactions(is_milestone_eligible);`,
  `CREATE INDEX IF NOT EXISTS idx_milestones_card ON milestones(card_id);`,
  `CREATE INDEX IF NOT EXISTS idx_milestones_person ON milestones(person_id);`,
];
