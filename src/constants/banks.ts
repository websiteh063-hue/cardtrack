// src/constants/banks.ts - Indian Banks List & Card Number Utilities

export interface IndianBank {
  name: string;
  popularName: string;
  shortCode: string;
  category: 'Major Private' | 'Public Sector' | 'Foreign / Fintech' | 'Small Finance';
  defaultNetwork?: 'Visa' | 'Mastercard' | 'RuPay' | 'American Express';
}

export const INDIAN_BANKS: IndianBank[] = [
  // Major Private Banks
  { name: 'HDFC Bank', popularName: 'HDFC Bank', shortCode: 'HDFC', category: 'Major Private' },
  { name: 'ICICI Bank', popularName: 'ICICI Bank', shortCode: 'ICICI', category: 'Major Private' },
  { name: 'Axis Bank', popularName: 'Axis Bank', shortCode: 'AXIS', category: 'Major Private' },
  { name: 'Kotak Mahindra Bank', popularName: 'Kotak Bank', shortCode: 'KOTAK', category: 'Major Private' },
  { name: 'IDFC FIRST Bank', popularName: 'IDFC FIRST', shortCode: 'IDFC', category: 'Major Private' },
  { name: 'IndusInd Bank', popularName: 'IndusInd Bank', shortCode: 'INDUS', category: 'Major Private' },
  { name: 'Yes Bank', popularName: 'Yes Bank', shortCode: 'YES', category: 'Major Private' },
  { name: 'RBL Bank', popularName: 'RBL Bank', shortCode: 'RBL', category: 'Major Private' },
  { name: 'Federal Bank', popularName: 'Federal Bank', shortCode: 'FED', category: 'Major Private' },
  { name: 'Bandhan Bank', popularName: 'Bandhan Bank', shortCode: 'BANDHAN', category: 'Major Private' },
  { name: 'South Indian Bank', popularName: 'South Indian Bank', shortCode: 'SIB', category: 'Major Private' },
  { name: 'City Union Bank', popularName: 'City Union Bank', shortCode: 'CUB', category: 'Major Private' },
  { name: 'Karnataka Bank', popularName: 'Karnataka Bank', shortCode: 'KBL', category: 'Major Private' },
  { name: 'Karur Vysya Bank', popularName: 'Karur Vysya Bank', shortCode: 'KVB', category: 'Major Private' },
  { name: 'IDBI Bank', popularName: 'IDBI Bank', shortCode: 'IDBI', category: 'Major Private' },
  { name: 'Jammu & Kashmir Bank', popularName: 'J&K Bank', shortCode: 'JKB', category: 'Major Private' },

  // Public Sector Banks
  { name: 'State Bank of India', popularName: 'SBI', shortCode: 'SBI', category: 'Public Sector' },
  { name: 'Punjab National Bank', popularName: 'PNB', shortCode: 'PNB', category: 'Public Sector' },
  { name: 'Bank of Baroda', popularName: 'BOB', shortCode: 'BOB', category: 'Public Sector' },
  { name: 'Canara Bank', popularName: 'Canara Bank', shortCode: 'CANARA', category: 'Public Sector' },
  { name: 'Union Bank of India', popularName: 'Union Bank', shortCode: 'UBI', category: 'Public Sector' },
  { name: 'Bank of India', popularName: 'Bank of India', shortCode: 'BOI', category: 'Public Sector' },
  { name: 'Indian Bank', popularName: 'Indian Bank', shortCode: 'INDBK', category: 'Public Sector' },
  { name: 'Central Bank of India', popularName: 'Central Bank', shortCode: 'CBI', category: 'Public Sector' },
  { name: 'UCO Bank', popularName: 'UCO Bank', shortCode: 'UCO', category: 'Public Sector' },
  { name: 'Indian Overseas Bank', popularName: 'IOB', shortCode: 'IOB', category: 'Public Sector' },
  { name: 'Punjab & Sind Bank', popularName: 'Punjab & Sind Bank', shortCode: 'PSB', category: 'Public Sector' },
  { name: 'Bank of Maharashtra', popularName: 'Bank of Maharashtra', shortCode: 'BOM', category: 'Public Sector' },

  // Foreign & Fintech / Co-branded Cards
  { name: 'American Express India', popularName: 'Amex', shortCode: 'AMEX', category: 'Foreign / Fintech', defaultNetwork: 'American Express' },
  { name: 'Standard Chartered Bank', popularName: 'Standard Chartered', shortCode: 'SC', category: 'Foreign / Fintech' },
  { name: 'HSBC India', popularName: 'HSBC', shortCode: 'HSBC', category: 'Foreign / Fintech' },
  { name: 'Citibank India', popularName: 'Citi', shortCode: 'CITI', category: 'Foreign / Fintech' },
  { name: 'DBS Bank India', popularName: 'DBS Bank', shortCode: 'DBS', category: 'Foreign / Fintech' },
  { name: 'OneCard', popularName: 'OneCard (BOB/Federal/SBM)', shortCode: 'ONECARD', category: 'Foreign / Fintech' },
  { name: 'SBM Bank India', popularName: 'SBM Bank', shortCode: 'SBM', category: 'Foreign / Fintech' },

  // Small Finance Banks
  { name: 'AU Small Finance Bank', popularName: 'AU Small Finance', shortCode: 'AU', category: 'Small Finance' },
  { name: 'Equitas Small Finance Bank', popularName: 'Equitas', shortCode: 'EQUITAS', category: 'Small Finance' },
  { name: 'Ujjivan Small Finance Bank', popularName: 'Ujjivan', shortCode: 'UJJIVAN', category: 'Small Finance' },
  { name: 'Jana Small Finance Bank', popularName: 'Jana Small Finance', shortCode: 'JANA', category: 'Small Finance' },
];

/**
 * Detects Card Network from card number prefix.
 */
export function detectCardNetwork(digits: string): 'Visa' | 'Mastercard' | 'RuPay' | 'American Express' | 'Diners Club' {
  const clean = digits.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard';
  if (/^(60|65|81|82|508)/.test(clean)) return 'RuPay';
  if (/^(34|37)/.test(clean)) return 'American Express';
  if (/^(30|36|38)/.test(clean)) return 'Diners Club';
  return 'Visa';
}

/**
 * Formats digits into standard spaced card representation:
 * 4532 1234 5678 9012 or 3742 123456 78901
 */
export function formatCardNumberInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 19);
  // American Express 15-digit format: 4-6-5
  if (/^(34|37)/.test(digits)) {
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 10);
    const part3 = digits.slice(10, 15);
    return [part1, part2, part3].filter(Boolean).join(' ');
  }
  // Standard 16-digit format: 4-4-4-4
  const chunks = digits.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : digits;
}
