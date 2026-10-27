// src/services/excelImport.ts - Comprehensive Excel .xlsx importer with validation & preview

import * as XLSX from 'xlsx';
import {
  Person,
  CreditCard,
  Transaction,
  Milestone,
  ExcelImportPreview,
  ExcelImportRowError,
  CardNetwork,
  CardStatus,
  TransactionType,
  TransactionStatus,
  MilestoneType,
  MilestoneStatus,
} from '../types';
import { rupeesToPaise } from './calculations';

/**
 * Normalizes Excel date or string into ISO YYYY-MM-DD string.
 */
export function normalizeExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    // Excel date serial number
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const y = parsed.y.toString().padStart(4, '0');
      const m = parsed.m.toString().padStart(2, '0');
      const d = parsed.d.toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Attempt standard date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Validates and parses an XLSX workbook into structured preview data.
 */
export function parseAndValidateExcelWorkbook(
  workbook: XLSX.WorkBook,
  existingData: {
    people: Person[];
    cards: CreditCard[];
    transactions: Transaction[];
    milestones: Milestone[];
  }
): ExcelImportPreview {
  const errors: ExcelImportRowError[] = [];
  const warnings: string[] = [];

  const existingPeopleIds = new Set(existingData.people.map(p => p.id));
  const existingCardIds = new Set(existingData.cards.map(c => c.id));
  const existingTxIds = new Set(existingData.transactions.map(t => t.id));
  const existingMilestoneIds = new Set(existingData.milestones.map(m => m.id));

  // Map from Person Name to ID for loose matching if ID missing
  const personNameToId = new Map<string, string>();
  existingData.people.forEach(p => personNameToId.set(p.full_name.toLowerCase().trim(), p.id));

  // Map from Card Nickname to ID
  const cardNicknameToId = new Map<string, string>();
  existingData.cards.forEach(c => cardNicknameToId.set(c.card_nickname.toLowerCase().trim(), c.id));

  const validPeople: Partial<Person>[] = [];
  const validCards: Partial<CreditCard>[] = [];
  const validTransactions: Partial<Transaction>[] = [];
  const validMilestones: Partial<Milestone>[] = [];

  const duplicateCount = {
    people: 0,
    cards: 0,
    transactions: 0,
    milestones: 0,
  };

  const newPeopleIds = new Set<string>();
  const newCardIds = new Set<string>();

  // 1. Process "People" sheet
  const peopleSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('people'));
  if (peopleSheetName) {
    const rawPeople = XLSX.utils.sheet_to_json<any>(workbook.Sheets[peopleSheetName]);

    rawPeople.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-based, header is row 1
      const fullName = (row['Full Name'] || row['Name'] || row['full_name'] || '').toString().trim();

      if (!fullName) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'People',
          field: 'Full Name',
          message: 'Full Name is required',
          data: row,
        });
        return;
      }

      let id = (row['Person ID'] || row['ID'] || row['id'] || '').toString().trim();
      if (!id) {
        id = `person_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      if (existingPeopleIds.has(id)) {
        duplicateCount.people++;
      }

      const person: Partial<Person> = {
        id,
        full_name: fullName,
        phone: row['Phone'] ? String(row['Phone']).trim() : null,
        email: row['Email'] ? String(row['Email']).trim() : null,
        notes: row['Notes'] ? String(row['Notes']).trim() : null,
        created_at: normalizeExcelDate(row['Created Date']) || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      newPeopleIds.add(id);
      personNameToId.set(fullName.toLowerCase(), id);
      validPeople.push(person);
    });
  }

  // 2. Process "Credit Cards" sheet
  const cardSheetName = workbook.SheetNames.find(s =>
    s.toLowerCase().includes('card') || s.toLowerCase().includes('credit')
  );

  if (cardSheetName) {
    const sheet = workbook.Sheets[cardSheetName];
    const rawCards = XLSX.utils.sheet_to_json<any>(sheet);

    // Security Check: Look for CVC/CVV columns
    const firstRow = rawCards[0] || {};
    const sensitiveKeys = Object.keys(firstRow).filter(k => /cvv|cvc|security.code/i.test(k));
    if (sensitiveKeys.length > 0) {
      warnings.push(
        `Security Notice: Columns [${sensitiveKeys.join(', ')}] were detected in Credit Cards sheet. CardTrack NEVER stores or imports CVC/CVV values. These columns have been discarded.`
      );
    }

    rawCards.forEach((row, idx) => {
      const rowNum = idx + 2;
      const nickname = (row['Card Nickname'] || row['Nickname'] || row['card_nickname'] || '').toString().trim();
      const bankName = (row['Bank Name'] || row['Bank'] || row['bank_name'] || '').toString().trim();

      if (!nickname) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'Credit Cards',
          field: 'Card Nickname',
          message: 'Card Nickname is required',
          data: row,
        });
        return;
      }

      let personId = (row['Person ID'] || row['person_id'] || '').toString().trim();
      const personName = (row['Person Name'] || row['person_name'] || '').toString().trim();

      if (!personId && personName && personNameToId.has(personName.toLowerCase())) {
        personId = personNameToId.get(personName.toLowerCase())!;
      }

      if (!personId && (existingPeopleIds.size > 0 || newPeopleIds.size > 0)) {
        // Fallback: if single person exists, assign to them, else error
        const allPeopleIds = [...existingPeopleIds, ...newPeopleIds];
        if (allPeopleIds.length === 1) {
          personId = allPeopleIds[0];
        } else {
          errors.push({
            rowNumber: rowNum,
            sheet: 'Credit Cards',
            field: 'Person ID',
            message: `Person ID or matched Person Name "${personName}" is missing or could not be found`,
            data: row,
          });
          return;
        }
      }

      let id = (row['Card ID'] || row['ID'] || row['id'] || '').toString().trim();
      if (!id) {
        id = `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      if (existingCardIds.has(id)) {
        duplicateCount.cards++;
      }

      const limitRaw = row['Total Credit Limit (INR)'] ?? row['Total Credit Limit'] ?? row['Credit Limit'] ?? 0;
      const feeRaw = row['Annual Fee (INR)'] ?? row['Annual Fee'] ?? 0;

      // Extract last 4 digits safely
      let last4 = (row['Last Four Digits'] || row['Last 4'] || row['last_four_digits'] || '').toString().trim();
      if (!last4 || last4.length !== 4) {
        last4 = '0000';
      }

      const networkInput = (row['Card Network'] || row['Network'] || 'Visa').toString().trim();
      const validNetworks: CardNetwork[] = ['Visa', 'Mastercard', 'RuPay', 'American Express', 'Diners Club', 'Discover', 'Other'];
      const cardNetwork: CardNetwork = validNetworks.find(n => n.toLowerCase() === networkInput.toLowerCase()) || 'Visa';

      const statusInput = (row['Card Status'] || row['Status'] || 'Active').toString().trim();
      const cardStatus: CardStatus = ['Active', 'Inactive', 'Closed'].find(s => s.toLowerCase() === statusInput.toLowerCase()) as CardStatus || 'Active';

      const card: Partial<CreditCard> = {
        id,
        person_id: personId,
        cardholder_name: (row['Cardholder Name'] || row['Cardholder'] || personName || 'Cardholder').toString().trim(),
        card_nickname: nickname,
        bank_name: bankName || 'Bank',
        card_issuer: (row['Card Issuer'] || row['Issuer'] || bankName || 'Issuer').toString().trim(),
        card_network: cardNetwork,
        last_four_digits: last4,
        expiry_month: Number(row['Expiry Month']) || 12,
        expiry_year: Number(row['Expiry Year']) || (new Date().getFullYear() + 3),
        total_credit_limit: rupeesToPaise(limitRaw),
        annual_fee: rupeesToPaise(feeRaw),
        opening_date: normalizeExcelDate(row['Opening Date']),
        statement_generation_day: Number(row['Statement Day']) || null,
        payment_due_day: Number(row['Payment Due Day']) || null,
        card_status: cardStatus,
        notes: row['Notes'] ? String(row['Notes']).trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      newCardIds.add(id);
      cardNicknameToId.set(nickname.toLowerCase(), id);
      validCards.push(card);
    });
  }

  // 3. Process "Transactions" sheet
  const txSheetName = workbook.SheetNames.find(s =>
    s.toLowerCase().includes('transaction')
  );

  if (txSheetName) {
    const rawTx = XLSX.utils.sheet_to_json<any>(workbook.Sheets[txSheetName]);

    rawTx.forEach((row, idx) => {
      const rowNum = idx + 2;
      let cardId = (row['Card ID'] || row['card_id'] || '').toString().trim();
      const cardNickname = (row['Card Nickname'] || row['card_nickname'] || '').toString().trim();

      if (!cardId && cardNickname && cardNicknameToId.has(cardNickname.toLowerCase())) {
        cardId = cardNicknameToId.get(cardNickname.toLowerCase())!;
      }

      if (!cardId) {
        const allCards = [...existingCardIds, ...newCardIds];
        if (allCards.length === 1) {
          cardId = allCards[0];
        } else {
          errors.push({
            rowNumber: rowNum,
            sheet: 'Transactions',
            field: 'Card ID',
            message: `Card ID or recognized Card Nickname "${cardNickname}" is missing`,
            data: row,
          });
          return;
        }
      }

      const txDate = normalizeExcelDate(row['Transaction Date'] || row['Date']);
      if (!txDate) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'Transactions',
          field: 'Transaction Date',
          message: 'Invalid or missing Transaction Date',
          data: row,
        });
        return;
      }

      const merchant = (row['Merchant'] || row['Merchant Name'] || row['merchant_name'] || '').toString().trim();
      if (!merchant) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'Transactions',
          field: 'Merchant',
          message: 'Merchant Name is required',
          data: row,
        });
        return;
      }

      const amountRaw = row['Amount (INR)'] ?? row['Amount'] ?? row['amount'];
      if (amountRaw === undefined || amountRaw === null || isNaN(Number(amountRaw))) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'Transactions',
          field: 'Amount',
          message: 'Numeric transaction amount is required',
          data: row,
        });
        return;
      }

      let id = (row['Transaction ID'] || row['ID'] || row['id'] || '').toString().trim();
      if (!id) {
        id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      if (existingTxIds.has(id)) {
        duplicateCount.transactions++;
      }

      const rawType = (row['Transaction Type'] || row['Type'] || 'Purchase').toString().trim();
      const validTypes: TransactionType[] = ['Purchase', 'Refund', 'Reversal', 'Adjustment'];
      const transactionType: TransactionType =
        validTypes.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Purchase';

      const rawStatus = (row['Transaction Status'] || row['Status'] || 'Cleared').toString().trim();
      const validStatuses: TransactionStatus[] = ['Cleared', 'Pending', 'Disputed'];
      const transactionStatus: TransactionStatus =
        validStatuses.find(s => s.toLowerCase() === rawStatus.toLowerCase()) || 'Cleared';

      const rawEligible = (row['Milestone Eligibility'] || row['Eligible'] || 'Yes').toString().toLowerCase();
      const isMilestoneEligible = rawEligible === 'yes' || rawEligible === 'true' || rawEligible === '1';

      // Find person ID from card
      const targetCard = existingData.cards.find(c => c.id === cardId) ||
        validCards.find(c => c.id === cardId);
      const personId = targetCard?.person_id || '';

      const tx: Partial<Transaction> = {
        id,
        card_id: cardId,
        person_id: personId,
        transaction_date: txDate,
        merchant_name: merchant,
        description: row['Description'] ? String(row['Description']).trim() : null,
        amount: Math.abs(rupeesToPaise(amountRaw)),
        transaction_type: transactionType,
        transaction_status: transactionStatus,
        is_milestone_eligible: isMilestoneEligible,
        notes: row['Notes'] ? String(row['Notes']).trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      validTransactions.push(tx);
    });
  }

  // 4. Process "Milestones" sheet
  const milestoneSheetName = workbook.SheetNames.find(s =>
    s.toLowerCase().includes('milestone')
  );

  if (milestoneSheetName) {
    const rawMilestones = XLSX.utils.sheet_to_json<any>(workbook.Sheets[milestoneSheetName]);

    rawMilestones.forEach((row, idx) => {
      const rowNum = idx + 2;
      const milestoneName = (row['Milestone Name'] || row['Name'] || row['milestone_name'] || '').toString().trim();

      if (!milestoneName) {
        errors.push({
          rowNumber: rowNum,
          sheet: 'Milestones',
          field: 'Milestone Name',
          message: 'Milestone Name is required',
          data: row,
        });
        return;
      }

      let cardId = (row['Card ID'] || row['card_id'] || '').toString().trim();
      const cardNickname = (row['Card Nickname'] || row['card_nickname'] || '').toString().trim();

      if (!cardId && cardNickname && cardNicknameToId.has(cardNickname.toLowerCase())) {
        cardId = cardNicknameToId.get(cardNickname.toLowerCase())!;
      }

      if (!cardId) {
        const allCards = [...existingCardIds, ...newCardIds];
        if (allCards.length === 1) {
          cardId = allCards[0];
        } else {
          errors.push({
            rowNumber: rowNum,
            sheet: 'Milestones',
            field: 'Card ID',
            message: `Card ID or recognized Card Nickname "${cardNickname}" is missing`,
            data: row,
          });
          return;
        }
      }

      let id = (row['Milestone ID'] || row['ID'] || row['id'] || '').toString().trim();
      if (!id) {
        id = `milestone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }

      if (existingMilestoneIds.has(id)) {
        duplicateCount.milestones++;
      }

      const targetAmountRaw = row['Target Amount (INR)'] ?? row['Target Amount'] ?? 0;
      const targetCountRaw = Number(row['Target Transaction Count'] ?? row['Target Count'] ?? 0);

      const rawType = (row['Milestone Type'] || row['Type'] || 'Spending').toString().trim();
      const validTypes: MilestoneType[] = ['Spending', 'TransactionCount', 'Custom'];
      const milestoneType: MilestoneType =
        validTypes.find(t => t.toLowerCase() === rawType.toLowerCase()) || 'Spending';

      const targetCard = existingData.cards.find(c => c.id === cardId) ||
        validCards.find(c => c.id === cardId);
      const personId = targetCard?.person_id || '';

      const milestone: Partial<Milestone> = {
        id,
        card_id: cardId,
        person_id: personId,
        milestone_name: milestoneName,
        description: row['Description'] ? String(row['Description']).trim() : null,
        milestone_type: milestoneType,
        target_amount: rupeesToPaise(targetAmountRaw),
        target_transaction_count: targetCountRaw,
        start_date: normalizeExcelDate(row['Start Date']),
        end_date: normalizeExcelDate(row['End Date']),
        reward_description: row['Reward Description'] ? String(row['Reward Description']).trim() : null,
        status: 'In Progress',
        notes: row['Notes'] ? String(row['Notes']).trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      validMilestones.push(milestone);
    });
  }

  return {
    validPeople,
    validCards,
    validTransactions,
    validMilestones,
    errors,
    warnings,
    duplicateCount,
  };
}
