// src/db/statsRepo.ts - Dashboard Statistics and Analytics Repository

import { IDatabase } from './database';
import { DashboardStats, MilestoneProgress, CreditCard, Transaction } from '../types';
import { getAllPeople } from './peopleRepo';
import { getAllCards } from './cardsRepo';
import { getAllTransactions } from './transactionsRepo';
import { getAllMilestones } from './milestonesRepo';
import { calculateDashboardStats, calculateMilestoneProgress } from '../services/calculations';

export interface DashboardSummaryData {
  stats: DashboardStats;
  recentTransactions: (Transaction & { cardNickname: string; bankName: string; personName: string })[];
  upcomingMilestones: MilestoneProgress[];
  cardsWithPendingMilestones: (CreditCard & { personName: string; pendingCount: number })[];
}

export async function getDashboardSummary(db: IDatabase): Promise<DashboardSummaryData> {
  const people = await getAllPeople(db);
  const cards = await getAllCards(db);
  const transactions = await getAllTransactions(db);
  const milestones = await getAllMilestones(db);

  const peopleMap = new Map<string, string>();
  people.forEach(p => peopleMap.set(p.id, p.full_name));

  const cardMap = new Map<string, CreditCard>();
  cards.forEach(c => cardMap.set(c.id, c));

  const stats = calculateDashboardStats(people, cards, transactions, milestones);

  // Recent transactions enriched with card and person info
  const recentTransactions = transactions.slice(0, 8).map(tx => {
    const card = cardMap.get(tx.card_id);
    const personName = peopleMap.get(tx.person_id) || (card ? peopleMap.get(card.person_id) : undefined) || 'Unknown';
    return {
      ...tx,
      cardNickname: card ? card.card_nickname : 'Unknown Card',
      bankName: card ? card.bank_name : 'Unknown Bank',
      personName,
    };
  });

  // Calculate milestone progress for all milestones
  const allMilestoneProgress: MilestoneProgress[] = milestones.map(m => {
    const card = cardMap.get(m.card_id);
    const personName = peopleMap.get(m.person_id) || (card ? peopleMap.get(card.person_id) : undefined) || 'Unknown';
    return calculateMilestoneProgress(
      m,
      transactions,
      card ? card.card_nickname : 'Unknown Card',
      card ? card.bank_name : 'Unknown Bank',
      personName
    );
  });

  // Milestones nearing their deadlines: active milestones sorted by daysRemaining
  const upcomingMilestones = allMilestoneProgress
    .filter(mp => !mp.isCompleted && mp.daysRemaining !== null && mp.daysRemaining >= 0)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    .slice(0, 5);

  // Cards with incomplete milestones
  const cardIncompleteMap = new Map<string, number>();
  allMilestoneProgress.forEach(mp => {
    if (!mp.isCompleted) {
      cardIncompleteMap.set(mp.milestone.card_id, (cardIncompleteMap.get(mp.milestone.card_id) || 0) + 1);
    }
  });

  const cardsWithPendingMilestones = cards
    .filter(c => (cardIncompleteMap.get(c.id) || 0) > 0)
    .map(c => ({
      ...c,
      personName: peopleMap.get(c.person_id) || 'Unknown',
      pendingCount: cardIncompleteMap.get(c.id) || 0,
    }));

  return {
    stats,
    recentTransactions,
    upcomingMilestones,
    cardsWithPendingMilestones,
  };
}
