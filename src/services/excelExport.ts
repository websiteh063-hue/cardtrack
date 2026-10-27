// src/services/excelExport.ts - Genuine .xlsx workbook exporter

import * as XLSX from 'xlsx';
import {
  Person,
  CreditCard,
  Transaction,
  Milestone,
  DashboardStats,
} from '../types';
import {
  paiseToRupees,
  formatINR,
  calculateMilestoneProgress,
  calculateDashboardStats,
} from './calculations';

export interface ExcelExportData {
  people: Person[];
  cards: CreditCard[];
  transactions: Transaction[];
  milestones: Milestone[];
}

/**
 * Builds a genuine multi-worksheet XLSX workbook.
 * Never includes CVC/CVV or full card numbers.
 */
export function buildExcelWorkbook(data: ExcelExportData): XLSX.WorkBook {
  const { people, cards, transactions, milestones } = data;

  const peopleMap = new Map<string, Person>();
  people.forEach(p => peopleMap.set(p.id, p));

  const cardsMap = new Map<string, CreditCard>();
  cards.forEach(c => cardsMap.set(c.id, c));

  const wb = XLSX.utils.book_new();

  // 1. People Worksheet
  const peopleRows = people.map(p => ({
    'Person ID': p.id,
    'Full Name': p.full_name,
    'Phone': p.phone || '',
    'Email': p.email || '',
    'Notes': p.notes || '',
    'Created Date': p.created_at ? p.created_at.split('T')[0] : '',
  }));
  const wsPeople = XLSX.utils.json_to_sheet(peopleRows.length > 0 ? peopleRows : [
    { 'Person ID': '', 'Full Name': '', 'Phone': '', 'Email': '', 'Notes': '', 'Created Date': '' }
  ]);
  wsPeople['!cols'] = [
    { wch: 38 }, // ID
    { wch: 24 }, // Name
    { wch: 16 }, // Phone
    { wch: 28 }, // Email
    { wch: 30 }, // Notes
    { wch: 14 }, // Created
  ];
  XLSX.utils.book_append_sheet(wb, wsPeople, 'People');

  // 2. Credit Cards Worksheet
  const cardRows = cards.map(c => {
    const person = peopleMap.get(c.person_id);
    return {
      'Card ID': c.id,
      'Person ID': c.person_id,
      'Person Name': person ? person.full_name : 'Unknown',
      'Cardholder Name': c.cardholder_name,
      'Card Nickname': c.card_nickname,
      'Bank Name': c.bank_name,
      'Card Issuer': c.card_issuer,
      'Card Network': c.card_network,
      'Last Four Digits': c.last_four_digits,
      'Expiry Month': c.expiry_month,
      'Expiry Year': c.expiry_year,
      'Total Credit Limit (INR)': paiseToRupees(c.total_credit_limit),
      'Annual Fee (INR)': paiseToRupees(c.annual_fee),
      'Opening Date': c.opening_date || '',
      'Statement Day': c.statement_generation_day ?? '',
      'Payment Due Day': c.payment_due_day ?? '',
      'Card Status': c.card_status,
      'Notes': c.notes || '',
    };
  });
  const wsCards = XLSX.utils.json_to_sheet(cardRows.length > 0 ? cardRows : [
    {
      'Card ID': '', 'Person ID': '', 'Person Name': '', 'Cardholder Name': '', 'Card Nickname': '',
      'Bank Name': '', 'Card Issuer': '', 'Card Network': '', 'Last Four Digits': '', 'Expiry Month': '',
      'Expiry Year': '', 'Total Credit Limit (INR)': 0, 'Annual Fee (INR)': 0, 'Opening Date': '',
      'Statement Day': '', 'Payment Due Day': '', 'Card Status': '', 'Notes': ''
    }
  ]);
  wsCards['!cols'] = [
    { wch: 38 }, { wch: 38 }, { wch: 22 }, { wch: 22 }, { wch: 20 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
    { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCards, 'Credit Cards');

  // 3. Transactions Worksheet
  const transactionRows = transactions.map(t => {
    const card = cardsMap.get(t.card_id);
    const person = peopleMap.get(t.person_id) || (card ? peopleMap.get(card.person_id) : undefined);
    return {
      'Transaction ID': t.id,
      'Card ID': t.card_id,
      'Person Name': person ? person.full_name : 'Unknown',
      'Card Nickname': card ? card.card_nickname : 'Unknown',
      'Transaction Date': t.transaction_date,
      'Merchant': t.merchant_name,
      'Description': t.description || '',
      'Amount (INR)': paiseToRupees(t.amount),
      'Transaction Type': t.transaction_type,
      'Transaction Status': t.transaction_status,
      'Milestone Eligibility': t.is_milestone_eligible ? 'Yes' : 'No',
      'Notes': t.notes || '',
    };
  });
  const wsTx = XLSX.utils.json_to_sheet(transactionRows.length > 0 ? transactionRows : [
    {
      'Transaction ID': '', 'Card ID': '', 'Person Name': '', 'Card Nickname': '', 'Transaction Date': '',
      'Merchant': '', 'Description': '', 'Amount (INR)': 0, 'Transaction Type': '', 'Transaction Status': '',
      'Milestone Eligibility': '', 'Notes': ''
    }
  ]);
  wsTx['!cols'] = [
    { wch: 38 }, { wch: 38 }, { wch: 22 }, { wch: 20 }, { wch: 16 },
    { wch: 24 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 20 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');

  // 4. Milestones Worksheet
  const milestoneRows = milestones.map(m => {
    const card = cardsMap.get(m.card_id);
    const person = peopleMap.get(m.person_id) || (card ? peopleMap.get(card.person_id) : undefined);
    const progress = calculateMilestoneProgress(
      m,
      transactions,
      card ? card.card_nickname : '',
      card ? card.bank_name : '',
      person ? person.full_name : ''
    );
    return {
      'Milestone ID': m.id,
      'Card ID': m.card_id,
      'Person Name': person ? person.full_name : 'Unknown',
      'Card Nickname': card ? card.card_nickname : 'Unknown',
      'Milestone Name': m.milestone_name,
      'Milestone Type': m.milestone_type,
      'Target Amount (INR)': paiseToRupees(m.target_amount),
      'Target Transaction Count': m.target_transaction_count || 0,
      'Current Eligible Spending (INR)': paiseToRupees(progress.eligibleSpending),
      'Remaining Amount (INR)': paiseToRupees(progress.remainingAmount),
      'Progress Percentage': `${progress.progressPercentage}%`,
      'Start Date': m.start_date || '',
      'End Date': m.end_date || '',
      'Reward Description': m.reward_description || '',
      'Status': progress.isCompleted ? 'Completed' : (progress.isExpired ? 'Expired' : 'In Progress'),
      'Notes': m.notes || '',
    };
  });
  const wsMilestones = XLSX.utils.json_to_sheet(milestoneRows.length > 0 ? milestoneRows : [
    {
      'Milestone ID': '', 'Card ID': '', 'Person Name': '', 'Card Nickname': '', 'Milestone Name': '',
      'Milestone Type': '', 'Target Amount (INR)': 0, 'Target Transaction Count': 0,
      'Current Eligible Spending (INR)': 0, 'Remaining Amount (INR)': 0, 'Progress Percentage': '0%',
      'Start Date': '', 'End Date': '', 'Reward Description': '', 'Status': '', 'Notes': ''
    }
  ]);
  wsMilestones['!cols'] = [
    { wch: 38 }, { wch: 38 }, { wch: 22 }, { wch: 20 }, { wch: 28 },
    { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 28 }, { wch: 22 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 16 },
    { wch: 26 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMilestones, 'Milestones');

  // 5. Summary Report Worksheet
  const stats: DashboardStats = calculateDashboardStats(people, cards, transactions, milestones);
  const summaryRows = [
    { Metric: 'Report Generation Date', Value: new Date().toISOString() },
    { Metric: 'Total People Profiles', Value: stats.totalPeople },
    { Metric: 'Total Credit Cards Managed', Value: stats.totalCards },
    { Metric: 'Total Recorded Transactions', Value: stats.totalTransactions },
    { Metric: 'Total Recorded Purchases (INR)', Value: formatINR(stats.totalPurchasesAmount) },
    { Metric: 'Net Recorded Spending (INR)', Value: formatINR(stats.totalSpendingAmount) },
    { Metric: 'Active Milestones', Value: stats.activeMilestonesCount },
    { Metric: 'Completed Milestones', Value: stats.completedMilestonesCount },
    { Metric: 'Pending / Expired Milestones', Value: stats.pendingMilestonesCount },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Report');

  return wb;
}

/**
 * Generates an empty Excel template workbook with sample headers and clear instructions.
 */
export function buildExcelTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // People Template
  const samplePeople = [
    {
      'Person ID': 'P-101',
      'Full Name': 'John Doe',
      'Phone': '+91 9876543210',
      'Email': 'john.doe@example.com',
      'Notes': 'Primary account holder',
    },
    {
      'Person ID': 'P-102',
      'Full Name': 'Jane Doe',
      'Phone': '+91 9876543211',
      'Email': 'jane.doe@example.com',
      'Notes': 'Secondary account',
    },
  ];
  const wsPeople = XLSX.utils.json_to_sheet(samplePeople);
  wsPeople['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 26 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsPeople, 'People');

  // Cards Template
  const sampleCards = [
    {
      'Card ID': 'C-201',
      'Person ID': 'P-101',
      'Person Name': 'John Doe',
      'Cardholder Name': 'John Doe',
      'Card Nickname': 'HDFC Infinia',
      'Bank Name': 'HDFC Bank',
      'Card Issuer': 'HDFC Bank',
      'Card Network': 'Visa',
      'Last Four Digits': '1234',
      'Expiry Month': 12,
      'Expiry Year': 2028,
      'Total Credit Limit (INR)': 500000,
      'Annual Fee (INR)': 12500,
      'Opening Date': '2023-01-15',
      'Statement Day': 18,
      'Payment Due Day': 6,
      'Card Status': 'Active',
      'Notes': 'Metal credit card',
    },
  ];
  const wsCards = XLSX.utils.json_to_sheet(sampleCards);
  wsCards['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCards, 'Credit Cards');

  // Transactions Template
  const sampleTransactions = [
    {
      'Transaction ID': 'T-301',
      'Card ID': 'C-201',
      'Transaction Date': '2026-10-15',
      'Merchant': 'Apple Store',
      'Description': 'MacBook Purchase',
      'Amount (INR)': 150000,
      'Transaction Type': 'Purchase',
      'Transaction Status': 'Cleared',
      'Milestone Eligibility': 'Yes',
      'Notes': 'Eligible for quarterly milestone',
    },
    {
      'Transaction ID': 'T-302',
      'Card ID': 'C-201',
      'Transaction Date': '2026-10-16',
      'Merchant': 'Apple Store',
      'Description': 'AppleCare Refund',
      'Amount (INR)': 15000,
      'Transaction Type': 'Refund',
      'Transaction Status': 'Cleared',
      'Milestone Eligibility': 'Yes',
      'Notes': 'Refund reduces eligible milestone spending',
    },
  ];
  const wsTx = XLSX.utils.json_to_sheet(sampleTransactions);
  wsTx['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 32 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');

  // Milestones Template
  const sampleMilestones = [
    {
      'Milestone ID': 'M-401',
      'Card ID': 'C-201',
      'Milestone Name': 'Q4 Spend Milestone',
      'Milestone Type': 'Spending',
      'Target Amount (INR)': 300000,
      'Target Transaction Count': 0,
      'Start Date': '2026-10-01',
      'End Date': '2026-12-31',
      'Reward Description': '10,000 Bonus Reward Points',
      'Notes': 'Spend ₹3 Lakhs between Oct and Dec',
    },
  ];
  const wsMilestones = XLSX.utils.json_to_sheet(sampleMilestones);
  wsMilestones['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 20 },
    { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 32 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMilestones, 'Milestones');

  return wb;
}

/**
 * Serializes the workbook to a Base64 string or Uint8Array.
 */
export function writeWorkbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
