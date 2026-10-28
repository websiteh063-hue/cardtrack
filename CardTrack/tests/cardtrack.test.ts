// tests/cardtrack.test.ts - Verification suite covering all 20 requirements

import { InMemoryDatabase, initDatabase, resetDatabase, IDatabase } from '../src/db/database';
import { createPerson, getAllPeople, getPersonById, updatePerson, deletePerson, searchPeople } from '../src/db/peopleRepo';
import { createCard, getAllCards, getCardById, updateCard, deleteCard } from '../src/db/cardsRepo';
import { createTransaction, getAllTransactions, getTransactionById, updateTransaction, deleteTransaction, filterTransactions } from '../src/db/transactionsRepo';
import { createMilestone, getAllMilestones, getMilestonesByCardId, updateMilestone, deleteMilestone } from '../src/db/milestonesRepo';
import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  calculateMilestoneProgress,
  calculateDashboardStats,
} from '../src/services/calculations';
import {
  maskCardNumber,
  formatFullCardNumber,
  encryptText,
  decryptText,
  computeSHA256Checksum,
} from '../src/services/crypto';
import {
  buildExcelWorkbook,
  buildExcelTemplateWorkbook,
  writeWorkbookToBase64,
} from '../src/services/excelExport';
import {
  parseAndValidateExcelWorkbook,
} from '../src/services/excelImport';
import {
  createEncryptedBackupPayload,
  previewEncryptedBackup,
  restoreRecordsIntoDatabase,
} from '../src/services/googleDrive';
import { executeGlobalSearch, getPersonDetailedOverview } from '../src/services/search';
import * as XLSX from 'xlsx';

describe('CardTrack — Personal Credit Card and Milestone Manager Comprehensive Test Suite', () => {
  let db: IDatabase;

  beforeEach(async () => {
    db = new InMemoryDatabase();
    await initDatabase(db);
  });

  // TEST 1: Fresh installation creates an empty database
  test('TEST 1: Fresh installation creates an empty database with no hardcoded or shared data', async () => {
    const people = await getAllPeople(db);
    const cards = await getAllCards(db);
    const transactions = await getAllTransactions(db);
    const milestones = await getAllMilestones(db);

    expect(people).toHaveLength(0);
    expect(cards).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(milestones).toHaveLength(0);
  });

  // TEST 2: Adding a person and multiple cards works correctly
  test('TEST 2: Adding a person and multiple cards under that person works correctly', async () => {
    const person = await createPerson(db, {
      id: 'p_rajesh',
      full_name: 'Rajesh Sharma',
      phone: '+91 9876543210',
      email: 'rajesh@example.com',
      notes: 'Primary cardholder',
    });

    expect(person.id).toBe('p_rajesh');
    expect(person.full_name).toBe('Rajesh Sharma');

    const card1 = await createCard(db, {
      id: 'card_hdfc',
      person_id: person.id,
      cardholder_name: 'Rajesh Sharma',
      card_nickname: 'HDFC Regalia Gold',
      bank_name: 'HDFC Bank',
      card_issuer: 'HDFC Bank',
      card_network: 'Visa',
      last_four_digits: '5432',
      expiry_month: 12,
      expiry_year: 2028,
      total_credit_limit: rupeesToPaise(400000), // ₹4,00,000
      annual_fee: rupeesToPaise(2500),
      card_status: 'Active',
    });

    const card2 = await createCard(db, {
      id: 'card_sbi',
      person_id: person.id,
      cardholder_name: 'Rajesh Sharma',
      card_nickname: 'SBI Cashback',
      bank_name: 'State Bank of India',
      card_issuer: 'SBI Cards',
      card_network: 'Mastercard',
      last_four_digits: '9876',
      expiry_month: 6,
      expiry_year: 2029,
      total_credit_limit: rupeesToPaise(200000), // ₹2,00,000
      annual_fee: rupeesToPaise(999),
      card_status: 'Active',
    });

    const allCards = await getAllCards(db);
    expect(allCards).toHaveLength(2);
    expect(allCards.map(c => c.person_id)).toEqual(['p_rajesh', 'p_rajesh']);
  });

  // TEST 3: Searching a person's name displays all associated cards
  test('TEST 3: Searching a person name displays all associated cards and financial overview', async () => {
    const person = await createPerson(db, {
      id: 'p_ananya',
      full_name: 'Ananya Verma',
    });

    await createCard(db, {
      id: 'card_icici',
      person_id: person.id,
      cardholder_name: 'Ananya Verma',
      card_nickname: 'ICICI Sapphiro',
      bank_name: 'ICICI Bank',
      card_issuer: 'ICICI Bank',
      card_network: 'Mastercard',
      last_four_digits: '1122',
      expiry_month: 8,
      expiry_year: 2027,
      total_credit_limit: rupeesToPaise(500000),
      annual_fee: 0,
      card_status: 'Active',
    });

    const searchResults = await executeGlobalSearch(db, 'Ananya');
    expect(searchResults.matchedPeople).toHaveLength(1);
    expect(searchResults.matchedCards).toHaveLength(1);
    expect(searchResults.matchedCards[0].card_nickname).toBe('ICICI Sapphiro');

    const overview = await getPersonDetailedOverview(db, person.id);
    expect(overview).not.toBeNull();
    expect(overview!.totalCardsCount).toBe(1);
    expect(overview!.cards[0].card_nickname).toBe('ICICI Sapphiro');
  });

  // TEST 4: Transactions can be added, edited, and deleted
  test('TEST 4: Transactions can be added, edited, and deleted with proper history', async () => {
    const person = await createPerson(db, { id: 'p_1', full_name: 'User 1' });
    const card = await createCard(db, {
      id: 'c_1',
      person_id: person.id,
      cardholder_name: 'User 1',
      card_nickname: 'Amex Plat',
      bank_name: 'Amex',
      card_issuer: 'Amex',
      card_network: 'American Express',
      last_four_digits: '1001',
      expiry_month: 5,
      expiry_year: 2028,
      total_credit_limit: rupeesToPaise(300000),
      annual_fee: 0,
      card_status: 'Active',
    });

    const tx = await createTransaction(db, {
      id: 'tx_1',
      card_id: card.id,
      person_id: person.id,
      transaction_date: '2026-10-15',
      merchant_name: 'Croma Electronics',
      description: 'OLED TV',
      amount: rupeesToPaise(75000),
      transaction_type: 'Purchase',
      transaction_status: 'Cleared',
      is_milestone_eligible: true,
    });

    expect(tx.amount).toBe(7500000); // 75000 * 100 paise

    // Edit transaction
    await updateTransaction(db, {
      id: 'tx_1',
      merchant_name: 'Croma Flagship Store',
      amount: rupeesToPaise(72000),
    });

    const updated = await getTransactionById(db, 'tx_1');
    expect(updated!.merchant_name).toBe('Croma Flagship Store');
    expect(updated!.amount).toBe(7200000);

    // Delete transaction
    await deleteTransaction(db, 'tx_1');
    const remaining = await getAllTransactions(db);
    expect(remaining).toHaveLength(0);
  });

  // TEST 5: Milestone calculations update correctly after transaction changes
  test('TEST 5: Milestone calculations update automatically when purchases, refunds, and edits occur', async () => {
    const person = await createPerson(db, { id: 'p_m', full_name: 'Milestone User' });
    const card = await createCard(db, {
      id: 'c_m',
      person_id: person.id,
      cardholder_name: 'Milestone User',
      card_nickname: 'Axis Atlas',
      bank_name: 'Axis Bank',
      card_issuer: 'Axis Bank',
      card_network: 'Visa',
      last_four_digits: '4455',
      expiry_month: 10,
      expiry_year: 2028,
      total_credit_limit: rupeesToPaise(500000),
      annual_fee: 0,
      card_status: 'Active',
    });

    // Milestone: Spend ₹1,00,000 between Oct 1 and Dec 31
    const milestone = await createMilestone(db, {
      id: 'm_1',
      card_id: card.id,
      person_id: person.id,
      milestone_name: 'Spend ₹1 Lakh for 5000 Edge Miles',
      milestone_type: 'Spending',
      target_amount: rupeesToPaise(100000), // 10000000 paise
      target_transaction_count: 0,
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      status: 'In Progress',
    });

    // Initial progress
    let allTx = await getAllTransactions(db);
    let prog = calculateMilestoneProgress(milestone, allTx);
    expect(prog.eligibleSpending).toBe(0);
    expect(prog.remainingAmount).toBe(rupeesToPaise(100000));
    expect(prog.progressPercentage).toBe(0);
    expect(prog.isCompleted).toBe(false);

    // Purchase 1: ₹65,000
    const tx1 = await createTransaction(db, {
      id: 'tx_spend_1',
      card_id: card.id,
      person_id: person.id,
      transaction_date: '2026-10-10',
      merchant_name: 'MakeMyTrip',
      amount: rupeesToPaise(65000),
      transaction_type: 'Purchase',
      transaction_status: 'Cleared',
      is_milestone_eligible: true,
    });

    allTx = await getAllTransactions(db);
    prog = calculateMilestoneProgress(milestone, allTx);
    expect(prog.eligibleSpending).toBe(rupeesToPaise(65000));
    expect(prog.remainingAmount).toBe(rupeesToPaise(35000));
    expect(prog.progressPercentage).toBe(65);
    expect(prog.isCompleted).toBe(false);

    // Refund: ₹15,000 (Refund MUST reduce eligible spending!)
    const txRefund = await createTransaction(db, {
      id: 'tx_refund_1',
      card_id: card.id,
      person_id: person.id,
      transaction_date: '2026-10-12',
      merchant_name: 'MakeMyTrip Refund',
      amount: rupeesToPaise(15000),
      transaction_type: 'Refund',
      transaction_status: 'Cleared',
      is_milestone_eligible: true,
    });

    allTx = await getAllTransactions(db);
    prog = calculateMilestoneProgress(milestone, allTx);
    // Net = 65,000 - 15,000 = ₹50,000
    expect(prog.eligibleSpending).toBe(rupeesToPaise(50000));
    expect(prog.remainingAmount).toBe(rupeesToPaise(50000));
    expect(prog.progressPercentage).toBe(50);
    expect(prog.isCompleted).toBe(false);

    // Purchase 2: ₹55,000 -> Total Net = ₹1,05,000 -> Goal reached!
    await createTransaction(db, {
      id: 'tx_spend_2',
      card_id: card.id,
      person_id: person.id,
      transaction_date: '2026-10-20',
      merchant_name: 'Tanishq Jewellery',
      amount: rupeesToPaise(55000),
      transaction_type: 'Purchase',
      transaction_status: 'Cleared',
      is_milestone_eligible: true,
    });

    allTx = await getAllTransactions(db);
    prog = calculateMilestoneProgress(milestone, allTx);
    expect(prog.eligibleSpending).toBe(rupeesToPaise(105000));
    expect(prog.remainingAmount).toBe(0);
    expect(prog.progressPercentage).toBe(100);
    expect(prog.isCompleted).toBe(true);

    // Delete purchase 2 -> progress must automatically recalculate back to incomplete!
    await deleteTransaction(db, 'tx_spend_2');
    allTx = await getAllTransactions(db);
    prog = calculateMilestoneProgress(milestone, allTx);
    expect(prog.eligibleSpending).toBe(rupeesToPaise(50000));
    expect(prog.isCompleted).toBe(false);
  });

  // TEST 6: The application works offline
  test('TEST 6: Application performs all operations locally without internet access', async () => {
    // All repositories and calculations execute directly on in-memory / local SQLite
    const person = await createPerson(db, { id: 'p_offline', full_name: 'Offline Tester' });
    const card = await createCard(db, {
      id: 'c_offline',
      person_id: person.id,
      cardholder_name: 'Offline Tester',
      card_nickname: 'Offline Card',
      bank_name: 'Local Bank',
      card_issuer: 'Local Bank',
      card_network: 'RuPay',
      last_four_digits: '7788',
      expiry_month: 1,
      expiry_year: 2030,
      total_credit_limit: rupeesToPaise(100000),
      annual_fee: 0,
      card_status: 'Active',
    });

    const searchResult = await executeGlobalSearch(db, 'Offline');
    expect(searchResult.matchedPeople).toHaveLength(1);
    expect(searchResult.matchedCards).toHaveLength(1);
  });

  // TEST 7: Restarting the application preserves all records
  test('TEST 7: Restarting the application preserves records', async () => {
    await createPerson(db, { id: 'p_persist', full_name: 'Persistent User' });
    const peopleBefore = await getAllPeople(db);
    expect(peopleBefore).toHaveLength(1);

    // Simulate app restart by re-initializing the database layer
    await initDatabase(db);
    const peopleAfter = await getAllPeople(db);
    expect(peopleAfter).toHaveLength(1);
    expect(peopleAfter[0].full_name).toBe('Persistent User');
  });

  // TEST 8 & 9: Google Drive backup creates valid AES-256-GCM encrypted backup & recovers saved records
  test('TEST 8 & 9: Google Drive backup creates valid encrypted backup and restores correctly', async () => {
    const person = await createPerson(db, { id: 'p_sec', full_name: 'Security User' });
    await createCard(db, {
      id: 'c_sec',
      person_id: person.id,
      cardholder_name: 'Security User',
      card_nickname: 'Secure Gold',
      bank_name: 'Secure Bank',
      card_issuer: 'Secure Bank',
      card_network: 'Visa',
      last_four_digits: '9999',
      expiry_month: 11,
      expiry_year: 2028,
      total_credit_limit: rupeesToPaise(250000),
      annual_fee: 0,
      card_status: 'Active',
    });

    const passphrase = 'MySuperSecurePassphrase123!';
    const { payload, jsonString } = await createEncryptedBackupPayload(db, passphrase);

    expect(payload.encrypted).toBe(true);
    expect(payload.ciphertext).toBeDefined();
    expect(payload.salt).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.metadata.peopleCount).toBe(1);
    expect(payload.metadata.cardsCount).toBe(1);

    // Verify decrypt & restore
    const preview = await previewEncryptedBackup(jsonString, passphrase);
    expect(preview.people).toHaveLength(1);
    expect(preview.people[0].full_name).toBe('Security User');
    expect(preview.cards[0].card_nickname).toBe('Secure Gold');
  });

  // TEST 10: Restoring a backup does not silently overwrite existing data
  test('TEST 10: Restoring backup verifies records and avoids silent overwriting', async () => {
    const person1 = await createPerson(db, { id: 'p_10', full_name: 'Existing Person' });

    const newRecords = {
      people: [{ id: 'p_restore', full_name: 'Restored Person', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      cards: [],
      transactions: [],
      milestones: [],
    };

    // Safe merge without replacing
    const restored = await restoreRecordsIntoDatabase(db, newRecords, false);
    expect(restored.people).toBe(1);

    const allPeople = await getAllPeople(db);
    expect(allPeople).toHaveLength(2);
    expect(allPeople.map(p => p.full_name)).toContain('Existing Person');
    expect(allPeople.map(p => p.full_name)).toContain('Restored Person');
  });

  // TEST 11: Excel export produces a valid .xlsx workbook
  test('TEST 11: Excel export produces a genuine .xlsx workbook with 5 worksheets', async () => {
    const person = await createPerson(db, { id: 'p_ex', full_name: 'Excel Export Tester' });
    const card = await createCard(db, {
      id: 'c_ex',
      person_id: person.id,
      cardholder_name: 'Excel Tester',
      card_nickname: 'SBI Elite',
      bank_name: 'SBI',
      card_issuer: 'SBI',
      card_network: 'Visa',
      last_four_digits: '3322',
      expiry_month: 4,
      expiry_year: 2029,
      total_credit_limit: rupeesToPaise(500000),
      annual_fee: rupeesToPaise(4999),
      card_status: 'Active',
    });

    const wb = buildExcelWorkbook({
      people: [person],
      cards: [card],
      transactions: [],
      milestones: [],
    });

    expect(wb.SheetNames).toEqual([
      'People',
      'Credit Cards',
      'Transactions',
      'Milestones',
      'Summary Report',
    ]);

    const base64 = writeWorkbookToBase64(wb);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);

    // Verify it can be read back as genuine XLSX
    const parsed = XLSX.read(base64, { type: 'base64' });
    expect(parsed.SheetNames).toContain('People');
    expect(parsed.SheetNames).toContain('Credit Cards');
  });

  // TEST 12: Excel import correctly reconstructs relationships
  test('TEST 12: Excel import correctly reconstructs relationships between people, cards, transactions, and milestones', async () => {
    const templateWb = buildExcelTemplateWorkbook();
    const preview = parseAndValidateExcelWorkbook(templateWb, {
      people: [],
      cards: [],
      transactions: [],
      milestones: [],
    });

    expect(preview.validPeople.length).toBeGreaterThanOrEqual(1);
    expect(preview.validCards.length).toBeGreaterThanOrEqual(1);
    expect(preview.validTransactions.length).toBeGreaterThanOrEqual(1);
    expect(preview.validMilestones.length).toBeGreaterThanOrEqual(1);
    expect(preview.errors).toHaveLength(0);

    // Verify card belongs to the person
    const card = preview.validCards[0];
    const person = preview.validPeople[0];
    expect(card.person_id).toBe(person.id);
  });

  // TEST 13: Invalid Excel rows are reported clearly
  test('TEST 13: Invalid Excel rows report row numbers and clear failure messages', async () => {
    const badWb = XLSX.utils.book_new();
    const badPeople = [
      { 'Person ID': 'P-1', 'Full Name': '' }, // Missing full name
      { 'Person ID': 'P-2', 'Full Name': 'Valid User' },
    ];
    const ws = XLSX.utils.json_to_sheet(badPeople);
    XLSX.utils.book_append_sheet(badWb, ws, 'People');

    const preview = parseAndValidateExcelWorkbook(badWb, { people: [], cards: [], transactions: [], milestones: [] });
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.errors[0].sheet).toBe('People');
    expect(preview.errors[0].rowNumber).toBe(2);
    expect(preview.errors[0].field).toBe('Full Name');
  });

  // TEST 14: Duplicate records are handled properly
  test('TEST 14: Duplicate records are detected during import preview', async () => {
    const person = await createPerson(db, { id: 'P-101', full_name: 'Existing John' });
    const templateWb = buildExcelTemplateWorkbook(); // contains P-101
    const preview = parseAndValidateExcelWorkbook(templateWb, {
      people: [person],
      cards: [],
      transactions: [],
      milestones: [],
    });

    expect(preview.duplicateCount.people).toBe(1);
  });

  // TEST 15: Import failures do not leave database partially modified
  test('TEST 15: Transaction rollback ensures failures leave database clean', async () => {
    await createPerson(db, { id: 'p_original', full_name: 'Original Person' });

    await expect(
      db.withTransactionAsync(async () => {
        await createPerson(db, { id: 'p_temp', full_name: 'Temp Person' });
        throw new Error('Simulated network or parsing failure');
      })
    ).rejects.toThrow('Simulated network or parsing failure');

    const people = await getAllPeople(db);
    expect(people).toHaveLength(1);
    expect(people[0].full_name).toBe('Original Person');
  });

  // TEST 16: Normal app updates preserve existing data
  test('TEST 16: Database schema migration preserves existing records', async () => {
    await createPerson(db, { id: 'p_v1', full_name: 'Version 1 User' });
    // Re-run migration
    await initDatabase(db);
    const people = await getAllPeople(db);
    expect(people).toHaveLength(1);
    expect(people[0].id).toBe('p_v1');
  });

  // TEST 17: Full card numbers are masked by default
  test('TEST 17: Card numbers are masked by default across display interfaces', () => {
    const maskedWithLast4 = maskCardNumber(null, '8899');
    expect(maskedWithLast4).toBe('•••• •••• •••• 8899');

    const maskedFromFull = maskCardNumber('4111222233334444');
    expect(maskedFromFull).toBe('•••• •••• •••• 4444');
  });

  // TEST 18: CVC/CVV values are never persisted, logged, or exported
  test('TEST 18: CVC/CVV values are strictly prohibited in database and Excel export', async () => {
    const person = await createPerson(db, { id: 'p_cvv', full_name: 'CVV Test' });
    const card = await createCard(db, {
      id: 'c_nocvv',
      person_id: person.id,
      cardholder_name: 'CVV Test',
      card_nickname: 'Safe Card',
      bank_name: 'Bank',
      card_issuer: 'Bank',
      card_network: 'Visa',
      last_four_digits: '1234',
      expiry_month: 12,
      expiry_year: 2028,
      total_credit_limit: rupeesToPaise(100000),
      annual_fee: 0,
      card_status: 'Active',
    });

    // Check database object has NO cvv or cvc field
    expect((card as any).cvv).toBeUndefined();
    expect((card as any).cvc).toBeUndefined();

    // Check Excel export has NO cvv or cvc column
    const wb = buildExcelWorkbook({ people: [person], cards: [card], transactions: [], milestones: [] });
    const cardSheet = wb.Sheets['Credit Cards'];
    const sheetData = XLSX.utils.sheet_to_json(cardSheet);
    const exportedRow = sheetData[0] as Record<string, any>;
    const keys = Object.keys(exportedRow);
    const hasCvv = keys.some(k => /cvv|cvc|security.code/i.test(k));
    expect(hasCvv).toBe(false);
  });

  // TEST 19: Sensitive card information is protected according to security design
  test('TEST 19: AES-256-GCM encryption and decryption operates securely', async () => {
    const sensitiveNumber = '4111222233334444';
    const secret = 'Device_Hardware_Key_789!';

    const { ciphertext, iv, salt } = await encryptText(sensitiveNumber, secret);
    expect(ciphertext).not.toBe(sensitiveNumber);

    const decrypted = await decryptText(ciphertext, iv, salt, secret);
    expect(decrypted).toBe(sensitiveNumber);
  });

  // TEST 20: Decimal-safe monetary calculations in INR
  test('TEST 20: Decimal-safe monetary calculations in Indian Rupees', () => {
    expect(rupeesToPaise(100.5)).toBe(10050);
    expect(paiseToRupees(10050)).toBe(100.5);

    expect(formatINR(12500000)).toBe('₹1,25,000.00'); // ₹1 Lakh 25 Thousand
    expect(formatINR(100000000)).toBe('₹10,00,000.00'); // ₹10 Lakhs
    expect(formatINR(1000000000)).toBe('₹1,00,00,000.00'); // ₹1 Crore
  });
});
