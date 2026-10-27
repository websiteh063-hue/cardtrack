// src/db/milestonesRepo.ts - Milestones Repository & Calculations

import { IDatabase } from './database';
import { Milestone, MilestoneProgress, MilestoneType, MilestoneStatus } from '../types';
import { calculateMilestoneProgress } from '../services/calculations';

export async function getAllMilestones(db: IDatabase): Promise<Milestone[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM milestones ORDER BY created_at DESC;');
  return rows.map(mapRowToMilestone);
}

export async function getMilestonesByCardId(db: IDatabase, cardId: string): Promise<Milestone[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM milestones WHERE card_id = ? ORDER BY created_at DESC;', [cardId]);
  return rows.map(mapRowToMilestone);
}

export async function getMilestonesByPersonId(db: IDatabase, personId: string): Promise<Milestone[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM milestones WHERE person_id = ? ORDER BY created_at DESC;', [personId]);
  return rows.map(mapRowToMilestone);
}

export async function getMilestoneById(db: IDatabase, id: string): Promise<Milestone | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM milestones WHERE id = ?;', [id]);
  return row ? mapRowToMilestone(row) : null;
}

export async function createMilestone(
  db: IDatabase,
  input: Omit<Milestone, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
): Promise<Milestone> {
  const now = new Date().toISOString();
  const milestone: Milestone = {
    id: input.id || `milestone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    card_id: input.card_id,
    person_id: input.person_id,
    milestone_name: input.milestone_name.trim(),
    description: input.description?.trim() || null,
    milestone_type: input.milestone_type,
    target_amount: Math.max(0, Math.round(input.target_amount || 0)),
    target_transaction_count: Math.max(0, Math.round(input.target_transaction_count || 0)),
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    reward_description: input.reward_description?.trim() || null,
    status: input.status || 'In Progress',
    notes: input.notes?.trim() || null,
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };

  await db.runAsync(
    `INSERT INTO milestones (
      id, card_id, person_id, milestone_name, description,
      milestone_type, target_amount, target_transaction_count,
      start_date, end_date, reward_description, status,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      milestone.id,
      milestone.card_id,
      milestone.person_id,
      milestone.milestone_name,
      milestone.description,
      milestone.milestone_type,
      milestone.target_amount,
      milestone.target_transaction_count,
      milestone.start_date,
      milestone.end_date,
      milestone.reward_description,
      milestone.status,
      milestone.notes,
      milestone.created_at,
      milestone.updated_at,
    ]
  );

  return milestone;
}

export async function updateMilestone(
  db: IDatabase,
  input: Partial<Milestone> & { id: string }
): Promise<void> {
  const existing = await getMilestoneById(db, input.id);
  if (!existing) {
    throw new Error(`Milestone with id ${input.id} not found`);
  }

  const updated: Milestone = {
    ...existing,
    ...input,
    target_amount: input.target_amount !== undefined ? Math.max(0, Math.round(input.target_amount)) : existing.target_amount,
    target_transaction_count: input.target_transaction_count !== undefined ? Math.max(0, Math.round(input.target_transaction_count)) : existing.target_transaction_count,
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE milestones SET
      card_id = ?, person_id = ?, milestone_name = ?, description = ?,
      milestone_type = ?, target_amount = ?, target_transaction_count = ?,
      start_date = ?, end_date = ?, reward_description = ?, status = ?,
      notes = ?, updated_at = ?
     WHERE id = ?;`,
    [
      updated.card_id,
      updated.person_id,
      updated.milestone_name,
      updated.description,
      updated.milestone_type,
      updated.target_amount,
      updated.target_transaction_count,
      updated.start_date,
      updated.end_date,
      updated.reward_description,
      updated.status,
      updated.notes,
      updated.updated_at,
      updated.id,
    ]
  );
}

export async function deleteMilestone(db: IDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM milestones WHERE id = ?;', [id]);
}

export async function getAllMilestonesWithProgress(db: IDatabase): Promise<MilestoneProgress[]> {
  const milestones = await getAllMilestones(db);
  const cards = await db.getAllAsync<any>('SELECT id, card_nickname, bank_name, person_id FROM credit_cards;');
  const people = await db.getAllAsync<any>('SELECT id, full_name FROM people;');
  const transactions = await db.getAllAsync<any>('SELECT * FROM transactions;');

  const cardMap = new Map<string, any>();
  cards.forEach(c => cardMap.set(c.id, c));

  const peopleMap = new Map<string, any>();
  people.forEach(p => peopleMap.set(p.id, p));

  const parsedTx = transactions.map((row: any) => ({
    id: row.id,
    card_id: row.card_id,
    person_id: row.person_id,
    transaction_date: row.transaction_date,
    merchant_name: row.merchant_name,
    description: row.description,
    amount: Number(row.amount),
    transaction_type: row.transaction_type,
    transaction_status: row.transaction_status,
    is_milestone_eligible: Boolean(Number(row.is_milestone_eligible)),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return milestones.map(m => {
    const card = cardMap.get(m.card_id);
    const person = peopleMap.get(m.person_id) || (card ? peopleMap.get(card.person_id) : undefined);
    return calculateMilestoneProgress(
      m,
      parsedTx,
      card ? card.card_nickname : 'Unknown Card',
      card ? card.bank_name : 'Unknown Bank',
      person ? person.full_name : 'Unknown Person'
    );
  });
}

function mapRowToMilestone(row: any): Milestone {
  return {
    id: row.id,
    card_id: row.card_id,
    person_id: row.person_id,
    milestone_name: row.milestone_name,
    description: row.description || null,
    milestone_type: row.milestone_type as MilestoneType,
    target_amount: Number(row.target_amount),
    target_transaction_count: Number(row.target_transaction_count),
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    reward_description: row.reward_description || null,
    status: row.status as MilestoneStatus,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
