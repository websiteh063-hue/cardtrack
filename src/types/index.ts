// src/types/index.ts - Core types for CardTrack

export type CardNetwork = 'Visa' | 'Mastercard' | 'RuPay' | 'American Express' | 'Diners Club' | 'Discover' | 'Other';
export type CardStatus = 'Active' | 'Inactive' | 'Closed';

export type TransactionType = 'Purchase' | 'Refund' | 'Reversal' | 'Adjustment';
export type TransactionStatus = 'Cleared' | 'Pending' | 'Disputed';

export type MilestoneType = 'Spending' | 'TransactionCount' | 'Custom';
export type MilestoneStatus = 'In Progress' | 'Completed' | 'Expired';

export interface Person {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface CreditCard {
  id: string;
  person_id: string;
  cardholder_name: string;
  card_nickname: string; // e.g. "HDFC Regalia", "SBI Cashback"
  bank_name: string;
  card_issuer: string;
  card_network: CardNetwork;
  last_four_digits: string;
  encrypted_full_number?: string | null; // AES-GCM encrypted string, empty if user stores last-4 only
  expiry_month: number; // 1-12
  expiry_year: number; // e.g. 2028
  total_credit_limit: number; // Stored in paise (integer minor units, ₹100,000 = 10000000)
  annual_fee: number; // Stored in paise
  opening_date?: string | null; // YYYY-MM-DD
  statement_generation_day?: number | null; // Day of month 1-31
  payment_due_day?: number | null; // Day of month 1-31
  card_status: CardStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  card_id: string;
  person_id: string; // Denormalized for fast queries & relationship validation
  transaction_date: string; // YYYY-MM-DD
  merchant_name: string;
  description?: string | null;
  amount: number; // Stored in paise (integer minor units)
  transaction_type: TransactionType;
  transaction_status: TransactionStatus;
  is_milestone_eligible: boolean; // Flag if this qualifies for reward milestones
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  card_id: string;
  person_id: string;
  milestone_name: string;
  description?: string | null;
  milestone_type: MilestoneType;
  target_amount: number; // In paise (for Spending milestones)
  target_transaction_count: number; // For TransactionCount milestones
  start_date?: string | null; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  reward_description?: string | null;
  status: MilestoneStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneProgress {
  milestone: Milestone;
  cardNickname: string;
  bankName: string;
  personName: string;
  eligibleSpending: number; // In paise
  eligibleCount: number;
  remainingAmount: number; // In paise
  remainingCount: number;
  progressPercentage: number; // 0 to 100
  isCompleted: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

export interface DashboardStats {
  totalPeople: number;
  totalCards: number;
  totalTransactions: number;
  totalPurchasesAmount: number; // In paise
  totalSpendingAmount: number; // Net spending (purchases - refunds + adjustments) in paise
  activeMilestonesCount: number;
  completedMilestonesCount: number;
  pendingMilestonesCount: number;
}

export interface SearchResultItem {
  id: string;
  type: 'person' | 'card' | 'transaction' | 'milestone';
  title: string;
  subtitle: string;
  details: string;
  payload: any;
}

export interface ExcelImportRowError {
  rowNumber: number;
  sheet: string;
  field: string;
  message: string;
  data: any;
}

export interface ExcelImportPreview {
  validPeople: Partial<Person>[];
  validCards: Partial<CreditCard>[];
  validTransactions: Partial<Transaction>[];
  validMilestones: Partial<Milestone>[];
  errors: ExcelImportRowError[];
  warnings: string[];
  duplicateCount: {
    people: number;
    cards: number;
    transactions: number;
    milestones: number;
  };
}

export type ImportMode = 'new_records' | 'update_existing' | 'skip_duplicates' | 'import_valid';

export interface BackupMetadata {
  version: number;
  appName: string;
  exportDate: string;
  databaseSchemaVersion: number;
  peopleCount: number;
  cardsCount: number;
  transactionsCount: number;
  milestonesCount: number;
  checksum: string;
}

export interface EncryptedBackupPayload {
  version: number;
  encrypted: boolean;
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  tag?: string; // Base64 GCM tag if separate
  metadata: BackupMetadata;
}
