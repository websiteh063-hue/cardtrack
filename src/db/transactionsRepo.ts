// src/db/transactionsRepo.ts - Manual Transaction Repository & Milestone Trigger

import { IDatabase } from './database';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { getMilestonesByCardId, updateMilestone } from './milestonesRepo';
import { calculateMilestoneProgress } from '../services/calculations';

export interface TransactionFilter {
  personId?: string;
  cardId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number; // In paise
  maxAmount?: number; // In paise
  transactionType?: TransactionType;
  isMilestoneEligible?: boolean;
  searchQuery?: string;
}

export async function getAllTransactions(db: IDatabase): Promise<Transaction[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM transactions ORDER BY transaction_date DESC, created_at DESC;');
  return rows.map(mapRowToTransaction);
}

export async function getTransactionsByCardId(db: IDatabase, cardId: string): Promise<Transaction[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions WHERE card_id = ? ORDER BY transaction_date DESC, created_at DESC;',
    [cardId]
  );
  return rows.map(mapRowToTransaction);
}

export async function getTransactionsByPersonId(db: IDatabase, personId: string): Promise<Transaction[]> {
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date DESC, created_at DESC;',
    [personId]
  );
  return rows.map(mapRowToTransaction);
}

export async function getTransactionById(db: IDatabase, id: string): Promise<Transaction | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?;', [id]);
  return row ? mapRowToTransaction(row) : null;
}

export async function filterTransactions(db: IDatabase, filter: TransactionFilter): Promise<Transaction[]> {
  const all = await getAllTransactions(db);

  return all.filter(tx => {
    if (filter.personId && tx.person_id !== filter.personId) return false;
    if (filter.cardId && tx.card_id !== filter.cardId) return false;
    if (filter.startDate && tx.transaction_date < filter.startDate) return false;
    if (filter.endDate && tx.transaction_date > filter.endDate) return false;
    if (filter.minAmount !== undefined && tx.amount < filter.minAmount) return false;
    if (filter.maxAmount !== undefined && tx.amount > filter.maxAmount) return false;
    if (filter.transactionType && tx.transaction_type !== filter.transactionType) return false;
    if (filter.isMilestoneEligible !== undefined && tx.is_milestone_eligible !== filter.isMilestoneEligible) return false;

    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase().trim();
      const matchMerchant = tx.merchant_name.toLowerCase().includes(q);
      const matchDesc = tx.description ? tx.description.toLowerCase().includes(q) : false;
      const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
      if (!matchMerchant && !matchDesc && !matchNotes) return false;
    }

    return true;
  });
}

export async function createTransaction(
  db: IDatabase,
  input: Omit<Transaction, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
): Promise<Transaction> {
  const now = new Date().toISOString();
  const tx: Transaction = {
    id: input.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    card_id: input.card_id,
    person_id: input.person_id,
    transaction_date: input.transaction_date,
    merchant_name: input.merchant_name.trim(),
    description: input.description?.trim() || null,
    amount: Math.abs(Math.round(input.amount)),
    transaction_type: input.transaction_type,
    transaction_status: input.transaction_status || 'Cleared',
    is_milestone_eligible: Boolean(input.is_milestone_eligible),
    notes: input.notes?.trim() || null,
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transactions (
        id, card_id, person_id, transaction_date, merchant_name,
        description, amount, transaction_type, transaction_status,
        is_milestone_eligible, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        tx.id,
        tx.card_id,
        tx.person_id,
        tx.transaction_date,
        tx.merchant_name,
        tx.description,
        tx.amount,
        tx.transaction_type,
        tx.transaction_status,
        tx.is_milestone_eligible ? 1 : 0,
        tx.notes,
        tx.created_at,
        tx.updated_at,
      ]
    );

    // Automatically recalculate milestones for this card
    await refreshMilestonesForCard(db, tx.card_id);
  });

  return tx;
}

export async function updateTransaction(
  db: IDatabase,
  input: Partial<Transaction> & { id: string }
): Promise<void> {
  const existing = await getTransactionById(db, input.id);
  if (!existing) {
    throw new Error(`Transaction with id ${input.id} not found`);
  }

  const updated: Transaction = {
    ...existing,
    ...input,
    amount: input.amount !== undefined ? Math.abs(Math.round(input.amount)) : existing.amount,
    updated_at: new Date().toISOString(),
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET
        card_id = ?, person_id = ?, transaction_date = ?, merchant_name = ?,
        description = ?, amount = ?, transaction_type = ?, transaction_status = ?,
        is_milestone_eligible = ?, notes = ?, updated_at = ?
       WHERE id = ?;`,
      [
        updated.card_id,
        updated.person_id,
        updated.transaction_date,
        updated.merchant_name,
        updated.description,
        updated.amount,
        updated.transaction_type,
        updated.transaction_status,
        updated.is_milestone_eligible ? 1 : 0,
        updated.notes,
        updated.updated_at,
        updated.id,
      ]
    );

    // Refresh milestones on the new card (and old card if card changed)
    await refreshMilestonesForCard(db, updated.card_id);
    if (existing.card_id !== updated.card_id) {
      await refreshMilestonesForCard(db, existing.card_id);
    }
  });
}

export async function deleteTransaction(db: IDatabase, id: string): Promise<void> {
  const existing = await getTransactionById(db, id);
  if (!existing) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
    // Refresh milestones for this card
    await refreshMilestonesForCard(db, existing.card_id);
  });
}

/**
 * Recalculates milestone completion status for all milestones on a credit card.
 */
export async function refreshMilestonesForCard(db: IDatabase, cardId: string): Promise<void> {
  const milestones = await getMilestonesByCardId(db, cardId);
  if (milestones.length === 0) return;

  const cardTransactions = await getTransactionsByCardId(db, cardId);

  for (const m of milestones) {
    const progress = calculateMilestoneProgress(m, cardTransactions);
    const newStatus = progress.isCompleted ? 'Completed' : (progress.isExpired ? 'Expired' : 'In Progress');

    if (m.status !== newStatus) {
      await updateMilestone(db, { id: m.id, status: newStatus });
    }
  }
}

function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    card_id: row.card_id,
    person_id: row.person_id,
    transaction_date: row.transaction_date,
    merchant_name: row.merchant_name,
    description: row.description || null,
    amount: Number(row.amount),
    transaction_type: row.transaction_type as TransactionType,
    transaction_status: row.transaction_status as TransactionStatus,
    is_milestone_eligible: Boolean(Number(row.is_milestone_eligible)),
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
