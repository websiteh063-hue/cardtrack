// src/services/calculations.ts - Financial calculations and Milestone progress engine

import {
  Milestone,
  MilestoneProgress,
  Transaction,
  DashboardStats,
  Person,
  CreditCard,
} from '../types';

/**
 * Converts integer paise into fractional rupees (e.g., 10050 paise -> 100.50 rupees).
 */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/**
 * Converts rupees (number or string representation) into integer paise safely.
 * e.g., "1250.75" or 1250.75 -> 125075 paise
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Formats paise into Indian Rupee currency format (e.g. ₹1,25,000.00).
 * Supports standard Indian comma separation (Lakhs, Crores).
 */
export function formatINR(paise: number, includeSymbol: boolean = true): string {
  if (!Number.isFinite(paise)) {
    return includeSymbol ? '₹0.00' : '0.00';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  const paiseStr = remainingPaise.toString().padStart(2, '0');

  // Indian comma formatting: last 3 digits, then groups of 2 digits
  const rupeeStr = rupees.toString();
  let formattedRupees = '';

  if (rupeeStr.length <= 3) {
    formattedRupees = rupeeStr;
  } else {
    const last3 = rupeeStr.slice(-3);
    const rest = rupeeStr.slice(0, -3);
    const groups: string[] = [];
    for (let i = rest.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      groups.unshift(rest.slice(start, i));
    }
    formattedRupees = groups.join(',') + ',' + last3;
  }

  const sign = isNegative ? '-' : '';
  const prefix = includeSymbol ? '₹' : '';
  return `${sign}${prefix}${formattedRupees}.${paiseStr}`;
}

/**
 * Checks if a transaction is within the milestone's date boundaries.
 */
export function isTransactionInMilestoneDateRange(
  transactionDate: string,
  startDate?: string | null,
  endDate?: string | null
): boolean {
  if (!transactionDate) return false;
  if (startDate && transactionDate < startDate) {
    return false;
  }
  if (endDate && transactionDate > endDate) {
    return false;
  }
  return true;
}

/**
 * Calculates net eligible spending and count for a specific card within milestone criteria.
 * Calculation rules:
 * - Purchases add to eligible spending
 * - Refunds and Reversals REDUCE eligible spending
 * - Adjustments add or subtract according to amount
 * - Transactions must be marked as milestone eligible
 */
export function calculateEligibleSpendingForMilestone(
  milestone: Milestone,
  transactions: Transaction[]
): { eligibleSpending: number; eligibleCount: number } {
  let eligibleSpending = 0;
  let eligibleCount = 0;

  for (const tx of transactions) {
    // Must belong to this card
    if (tx.card_id !== milestone.card_id) continue;

    // Must be flagged as milestone eligible
    if (!tx.is_milestone_eligible) continue;

    // Must fall within milestone date range
    if (!isTransactionInMilestoneDateRange(tx.transaction_date, milestone.start_date, milestone.end_date)) {
      continue;
    }

    if (tx.transaction_type === 'Purchase') {
      eligibleSpending += tx.amount;
      eligibleCount += 1;
    } else if (tx.transaction_type === 'Refund' || tx.transaction_type === 'Reversal') {
      // Refunds and reversals reduce eligible spending
      eligibleSpending -= tx.amount;
    } else if (tx.transaction_type === 'Adjustment') {
      eligibleSpending += tx.amount;
    }
  }

  // Prevent negative net spending in milestone tracking
  return {
    eligibleSpending: Math.max(0, eligibleSpending),
    eligibleCount: Math.max(0, eligibleCount),
  };
}

/**
 * Calculates complete milestone progress, completion, remaining amount, and percentage.
 */
export function calculateMilestoneProgress(
  milestone: Milestone,
  transactions: Transaction[],
  cardNickname: string = '',
  bankName: string = '',
  personName: string = ''
): MilestoneProgress {
  const { eligibleSpending, eligibleCount } = calculateEligibleSpendingForMilestone(milestone, transactions);

  let remainingAmount = 0;
  let remainingCount = 0;
  let progressPercentage = 0;
  let isCompleted = false;

  if (milestone.milestone_type === 'Spending') {
    const target = milestone.target_amount || 0;
    if (target > 0) {
      remainingAmount = Math.max(0, target - eligibleSpending);
      progressPercentage = Math.min(100, Math.round((eligibleSpending / target) * 100));
      isCompleted = eligibleSpending >= target;
    } else {
      progressPercentage = 100;
      isCompleted = true;
    }
  } else if (milestone.milestone_type === 'TransactionCount') {
    const targetCount = milestone.target_transaction_count || 0;
    if (targetCount > 0) {
      remainingCount = Math.max(0, targetCount - eligibleCount);
      progressPercentage = Math.min(100, Math.round((eligibleCount / targetCount) * 100));
      isCompleted = eligibleCount >= targetCount;
    } else {
      progressPercentage = 100;
      isCompleted = true;
    }
  } else {
    // Custom milestone: if target amount exists, use amount, otherwise count
    if (milestone.target_amount > 0) {
      remainingAmount = Math.max(0, milestone.target_amount - eligibleSpending);
      progressPercentage = Math.min(100, Math.round((eligibleSpending / milestone.target_amount) * 100));
      isCompleted = eligibleSpending >= milestone.target_amount;
    } else {
      isCompleted = milestone.status === 'Completed';
      progressPercentage = isCompleted ? 100 : 0;
    }
  }

  // Check deadline expiration
  let isExpired = false;
  let daysRemaining: number | null = null;
  if (milestone.end_date) {
    const today = new Date().toISOString().split('T')[0];
    isExpired = !isCompleted && today > milestone.end_date;

    const msPerDay = 1000 * 60 * 60 * 24;
    const endMs = new Date(milestone.end_date).getTime();
    const todayMs = new Date(today).getTime();
    daysRemaining = Math.ceil((endMs - todayMs) / msPerDay);
  }

  return {
    milestone,
    cardNickname,
    bankName,
    personName,
    eligibleSpending,
    eligibleCount,
    remainingAmount,
    remainingCount,
    progressPercentage,
    isCompleted,
    isExpired,
    daysRemaining,
  };
}

/**
 * Calculates dashboard statistics from local state.
 */
export function calculateDashboardStats(
  people: Person[],
  cards: CreditCard[],
  transactions: Transaction[],
  milestones: Milestone[]
): DashboardStats {
  let totalPurchasesAmount = 0;
  let totalSpendingAmount = 0;

  for (const tx of transactions) {
    if (tx.transaction_type === 'Purchase') {
      totalPurchasesAmount += tx.amount;
      totalSpendingAmount += tx.amount;
    } else if (tx.transaction_type === 'Refund' || tx.transaction_type === 'Reversal') {
      // Refunds reduce overall net spending
      totalSpendingAmount -= tx.amount;
    } else if (tx.transaction_type === 'Adjustment') {
      totalSpendingAmount += tx.amount;
    }
  }

  // Calculate milestone status counts
  let activeMilestonesCount = 0;
  let completedMilestonesCount = 0;
  let pendingMilestonesCount = 0;

  for (const m of milestones) {
    const progress = calculateMilestoneProgress(m, transactions);
    if (progress.isCompleted) {
      completedMilestonesCount++;
    } else if (progress.isExpired) {
      pendingMilestonesCount++;
    } else {
      activeMilestonesCount++;
    }
  }

  return {
    totalPeople: people.length,
    totalCards: cards.length,
    totalTransactions: transactions.length,
    totalPurchasesAmount: Math.max(0, totalPurchasesAmount),
    totalSpendingAmount: Math.max(0, totalSpendingAmount),
    activeMilestonesCount,
    completedMilestonesCount,
    pendingMilestonesCount,
  };
}
