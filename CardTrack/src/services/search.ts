// src/services/search.ts - Global Search Engine across People, Cards, and Entities

import { IDatabase } from '../db/database';
import { Person, CreditCard, Transaction, Milestone, MilestoneProgress } from '../types';
import { getAllPeople } from '../db/peopleRepo';
import { getAllCards } from '../db/cardsRepo';
import { getAllTransactions } from '../db/transactionsRepo';
import { getAllMilestones } from '../db/milestonesRepo';
import { calculateMilestoneProgress } from './calculations';

export interface GlobalSearchResult {
  matchedPeople: Person[];
  matchedCards: (CreditCard & { personName: string })[];
}

export interface PersonDetailedOverview {
  person: Person;
  cards: CreditCard[];
  totalCardsCount: number;
  milestones: MilestoneProgress[];
  totalMilestonesCount: number;
  completedMilestonesCount: number;
  pendingMilestonesCount: number;
  totalRecordedPurchases: number; // in paise
  totalQualifyingSpending: number; // in paise
  remainingMilestoneRequirements: number; // in paise
  recentTransactions: (Transaction & { cardNickname: string })[];
}

/**
 * Performs fast, offline search across multiple fields:
 * - Person's name (partial or full)
 * - Cardholder name
 * - Card nickname
 * - Bank name
 * - Card issuer
 * - Last four digits of a card
 * (Never exposes full card number in search)
 */
export async function executeGlobalSearch(db: IDatabase, rawQuery: string): Promise<GlobalSearchResult> {
  const query = rawQuery.toLowerCase().trim();
  if (!query) {
    return { matchedPeople: [], matchedCards: [] };
  }

  const people = await getAllPeople(db);
  const cards = await getAllCards(db);

  const peopleMap = new Map<string, string>();
  people.forEach(p => peopleMap.set(p.id, p.full_name));

  // Match people
  const matchedPeople = people.filter(p => {
    return (
      p.full_name.toLowerCase().includes(query) ||
      (p.phone && p.phone.toLowerCase().includes(query)) ||
      (p.email && p.email.toLowerCase().includes(query)) ||
      (p.notes && p.notes.toLowerCase().includes(query))
    );
  });

  // Match cards
  const matchedCards = cards
    .filter(c => {
      const personName = peopleMap.get(c.person_id) || '';
      return (
        c.card_nickname.toLowerCase().includes(query) ||
        c.bank_name.toLowerCase().includes(query) ||
        c.card_issuer.toLowerCase().includes(query) ||
        c.cardholder_name.toLowerCase().includes(query) ||
        c.last_four_digits.includes(query) ||
        personName.toLowerCase().includes(query) ||
        (c.notes && c.notes.toLowerCase().includes(query))
      );
    })
    .map(c => ({
      ...c,
      personName: peopleMap.get(c.person_id) || 'Unknown',
    }));

  return {
    matchedPeople,
    matchedCards,
  };
}

/**
 * Builds the comprehensive overview for a person as mandated in Section 5 of the requirements:
 * - Profile details
 * - Total cards & card list
 * - Total milestones, completed, pending
 * - Total recorded purchases & total qualifying spending
 * - Remaining milestone requirements
 * - Recent transactions
 */
export async function getPersonDetailedOverview(db: IDatabase, personId: string): Promise<PersonDetailedOverview | null> {
  const people = await getAllPeople(db);
  const person = people.find(p => p.id === personId);
  if (!person) return null;

  const cards = (await getAllCards(db)).filter(c => c.person_id === personId);
  const cardIds = new Set(cards.map(c => c.id));
  const cardMap = new Map<string, CreditCard>();
  cards.forEach(c => cardMap.set(c.id, c));

  const allTransactions = await getAllTransactions(db);
  const personTransactions = allTransactions.filter(t => t.person_id === personId || cardIds.has(t.card_id));

  const allMilestones = await getAllMilestones(db);
  const personMilestones = allMilestones.filter(m => m.person_id === personId || cardIds.has(m.card_id));

  let totalRecordedPurchases = 0;
  let totalQualifyingSpending = 0;

  for (const tx of personTransactions) {
    if (tx.transaction_type === 'Purchase') {
      totalRecordedPurchases += tx.amount;
      if (tx.is_milestone_eligible) {
        totalQualifyingSpending += tx.amount;
      }
    } else if (tx.transaction_type === 'Refund' || tx.transaction_type === 'Reversal') {
      if (tx.is_milestone_eligible) {
        totalQualifyingSpending -= tx.amount;
      }
    }
  }

  // Calculate milestones
  const milestoneProgressList: MilestoneProgress[] = personMilestones.map(m => {
    const card = cardMap.get(m.card_id);
    return calculateMilestoneProgress(
      m,
      personTransactions,
      card ? card.card_nickname : 'Card',
      card ? card.bank_name : 'Bank',
      person.full_name
    );
  });

  let completedMilestonesCount = 0;
  let pendingMilestonesCount = 0;
  let remainingMilestoneRequirements = 0;

  for (const mp of milestoneProgressList) {
    if (mp.isCompleted) {
      completedMilestonesCount++;
    } else {
      pendingMilestonesCount++;
      remainingMilestoneRequirements += mp.remainingAmount;
    }
  }

  const recentTransactions = personTransactions.slice(0, 10).map(t => ({
    ...t,
    cardNickname: cardMap.get(t.card_id)?.card_nickname || 'Card',
  }));

  return {
    person,
    cards,
    totalCardsCount: cards.length,
    milestones: milestoneProgressList,
    totalMilestonesCount: milestoneProgressList.length,
    completedMilestonesCount,
    pendingMilestonesCount,
    totalRecordedPurchases,
    totalQualifyingSpending: Math.max(0, totalQualifyingSpending),
    remainingMilestoneRequirements,
    recentTransactions,
  };
}
