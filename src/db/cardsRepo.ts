// src/db/cardsRepo.ts - Credit Card Repository

import { IDatabase } from './database';
import { CreditCard, CardNetwork, CardStatus } from '../types';

export async function getAllCards(db: IDatabase): Promise<CreditCard[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM credit_cards ORDER BY card_nickname ASC;');
  return rows.map(mapRowToCard);
}

export async function getCardsByPersonId(db: IDatabase, personId: string): Promise<CreditCard[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM credit_cards WHERE person_id = ? ORDER BY card_nickname ASC;', [personId]);
  return rows.map(mapRowToCard);
}

export async function getCardById(db: IDatabase, id: string): Promise<CreditCard | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM credit_cards WHERE id = ?;', [id]);
  return row ? mapRowToCard(row) : null;
}

export async function createCard(
  db: IDatabase,
  input: Omit<CreditCard, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
): Promise<CreditCard> {
  const now = new Date().toISOString();
  const card: CreditCard = {
    id: input.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    person_id: input.person_id,
    cardholder_name: input.cardholder_name.trim(),
    card_nickname: input.card_nickname.trim(),
    bank_name: input.bank_name.trim(),
    card_issuer: input.card_issuer.trim(),
    card_network: input.card_network,
    last_four_digits: input.last_four_digits.trim(),
    encrypted_full_number: input.encrypted_full_number || null,
    expiry_month: input.expiry_month,
    expiry_year: input.expiry_year,
    total_credit_limit: Math.max(0, Math.round(input.total_credit_limit)),
    annual_fee: Math.max(0, Math.round(input.annual_fee)),
    opening_date: input.opening_date || null,
    statement_generation_day: input.statement_generation_day || null,
    payment_due_day: input.payment_due_day || null,
    card_status: input.card_status || 'Active',
    notes: input.notes?.trim() || null,
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };

  await db.runAsync(
    `INSERT INTO credit_cards (
      id, person_id, cardholder_name, card_nickname, bank_name,
      card_issuer, card_network, last_four_digits, encrypted_full_number,
      expiry_month, expiry_year, total_credit_limit, annual_fee,
      opening_date, statement_generation_day, payment_due_day,
      card_status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      card.id,
      card.person_id,
      card.cardholder_name,
      card.card_nickname,
      card.bank_name,
      card.card_issuer,
      card.card_network,
      card.last_four_digits,
      card.encrypted_full_number,
      card.expiry_month,
      card.expiry_year,
      card.total_credit_limit,
      card.annual_fee,
      card.opening_date,
      card.statement_generation_day,
      card.payment_due_day,
      card.card_status,
      card.notes,
      card.created_at,
      card.updated_at,
    ]
  );

  return card;
}

export async function updateCard(
  db: IDatabase,
  input: Partial<CreditCard> & { id: string }
): Promise<void> {
  const existing = await getCardById(db, input.id);
  if (!existing) {
    throw new Error(`Credit card with id ${input.id} not found`);
  }

  const updated: CreditCard = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE credit_cards SET
      person_id = ?, cardholder_name = ?, card_nickname = ?, bank_name = ?,
      card_issuer = ?, card_network = ?, last_four_digits = ?, encrypted_full_number = ?,
      expiry_month = ?, expiry_year = ?, total_credit_limit = ?, annual_fee = ?,
      opening_date = ?, statement_generation_day = ?, payment_due_day = ?,
      card_status = ?, notes = ?, updated_at = ?
     WHERE id = ?;`,
    [
      updated.person_id,
      updated.cardholder_name,
      updated.card_nickname,
      updated.bank_name,
      updated.card_issuer,
      updated.card_network,
      updated.last_four_digits,
      updated.encrypted_full_number,
      updated.expiry_month,
      updated.expiry_year,
      updated.total_credit_limit,
      updated.annual_fee,
      updated.opening_date,
      updated.statement_generation_day,
      updated.payment_due_day,
      updated.card_status,
      updated.notes,
      updated.updated_at,
      updated.id,
    ]
  );
}

export async function deleteCard(db: IDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM milestones WHERE card_id = ?;', [id]);
    await db.runAsync('DELETE FROM transactions WHERE card_id = ?;', [id]);
    await db.runAsync('DELETE FROM credit_cards WHERE id = ?;', [id]);
  });
}

function mapRowToCard(row: any): CreditCard {
  return {
    id: row.id,
    person_id: row.person_id,
    cardholder_name: row.cardholder_name,
    card_nickname: row.card_nickname,
    bank_name: row.bank_name,
    card_issuer: row.card_issuer,
    card_network: row.card_network as CardNetwork,
    last_four_digits: row.last_four_digits,
    encrypted_full_number: row.encrypted_full_number || null,
    expiry_month: Number(row.expiry_month),
    expiry_year: Number(row.expiry_year),
    total_credit_limit: Number(row.total_credit_limit),
    annual_fee: Number(row.annual_fee),
    opening_date: row.opening_date || null,
    statement_generation_day: row.statement_generation_day ? Number(row.statement_generation_day) : null,
    payment_due_day: row.payment_due_day ? Number(row.payment_due_day) : null,
    card_status: row.card_status as CardStatus,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
