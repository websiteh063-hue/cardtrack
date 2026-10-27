// src/db/peopleRepo.ts - People Profile Repository

import { IDatabase } from './database';
import { Person } from '../types';

export async function getAllPeople(db: IDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM people ORDER BY full_name ASC;');
  return rows.map(mapRowToPerson);
}

export async function getPersonById(db: IDatabase, id: string): Promise<Person | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM people WHERE id = ?;', [id]);
  return row ? mapRowToPerson(row) : null;
}

export async function createPerson(
  db: IDatabase,
  input: Omit<Person, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
): Promise<Person> {
  const now = new Date().toISOString();
  const person: Person = {
    id: input.id || `person_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };

  await db.runAsync(
    `INSERT INTO people (id, full_name, phone, email, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      person.id,
      person.full_name,
      person.phone,
      person.email,
      person.notes,
      person.created_at,
      person.updated_at,
    ]
  );

  return person;
}

export async function updatePerson(
  db: IDatabase,
  input: Partial<Person> & { id: string }
): Promise<void> {
  const existing = await getPersonById(db, input.id);
  if (!existing) {
    throw new Error(`Person with id ${input.id} not found`);
  }

  const updated: Person = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE people SET full_name = ?, phone = ?, email = ?, notes = ?, updated_at = ? WHERE id = ?;`,
    [
      updated.full_name,
      updated.phone,
      updated.email,
      updated.notes,
      updated.updated_at,
      updated.id,
    ]
  );
}

export async function getPersonCascadeImpact(
  db: IDatabase,
  personId: string
): Promise<{ cardsCount: number; transactionsCount: number; milestonesCount: number }> {
  const cards = await db.getAllAsync<any>('SELECT id FROM credit_cards WHERE person_id = ?;', [personId]);
  const transactions = await db.getAllAsync<any>('SELECT id FROM transactions WHERE person_id = ?;', [personId]);
  const milestones = await db.getAllAsync<any>('SELECT id FROM milestones WHERE person_id = ?;', [personId]);

  return {
    cardsCount: cards.length,
    transactionsCount: transactions.length,
    milestonesCount: milestones.length,
  };
}

export async function deletePerson(db: IDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Delete cascade
    await db.runAsync('DELETE FROM milestones WHERE person_id = ?;', [id]);
    await db.runAsync('DELETE FROM transactions WHERE person_id = ?;', [id]);
    await db.runAsync('DELETE FROM credit_cards WHERE person_id = ?;', [id]);
    await db.runAsync('DELETE FROM people WHERE id = ?;', [id]);
  });
}

export async function searchPeople(db: IDatabase, query: string): Promise<Person[]> {
  const all = await getAllPeople(db);
  const q = query.toLowerCase().trim();
  if (!q) return all;
  return all.filter(
    p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
  );
}

function mapRowToPerson(row: any): Person {
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone || null,
    email: row.email || null,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
