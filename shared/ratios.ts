import { trialBalance, type Entry, type Ledger } from './accounting';

// Debt-equity per RULES_v1 R1 (ICAI GN Div I Annexure B): total debt / shareholders' equity. Integer paise.
// Debt = Secured Loans + Unsecured Loans + Bank OD A/c. Equity = Capital Account + Reserves & Surplus + profit before tax as booked
// (tax rate is not supplied, so no tax is deducted; the screen must say "before tax").
const DEBT_GROUPS = ['Secured Loans', 'Unsecured Loans', 'Bank OD A/c'];
const EQUITY_GROUPS = ['Capital Account', 'Reserves & Surplus'];
export type DebtEquity = { debt: number; equity: number; ratio: number };

function figures(ledgers: Ledger[], entries: Entry[]) {
  const tb = trialBalance(ledgers, entries);
  const group = new Map(ledgers.map(l => [l.ledger_name, l.tally_group]));
  let debt = 0, equity = tb.pbt, creditors = 0;
  for (const [name, balance] of tb.balances) {
    const g = group.get(name)!;
    if (DEBT_GROUPS.includes(g)) debt -= balance;
    if (EQUITY_GROUPS.includes(g)) equity -= balance;
    if (g === 'Sundry Creditors') creditors -= balance;
  }
  return { debt, equity, creditors };
}

function build(debt: number, equity: number): DebtEquity {
  if (equity <= 0) throw new Error('Debt-equity needs positive shareholders equity.');
  return { debt, equity, ratio: debt / equity };
}

export function debtEquity(ledgers: Ledger[], entries: Entry[]): DebtEquity {
  const f = figures(ledgers, entries);
  return build(f.debt, f.equity);
}

// A reclass from trade payables to borrowings moves the amount into debt and leaves equity unchanged.
export function debtEquityAfterReclass(ledgers: Ledger[], entries: Entry[], amountPaise: number, ledgerName?: string): DebtEquity {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('Reclass amount must be whole paise above zero.');
  const f = figures(ledgers, entries);
  if (amountPaise > f.creditors) throw new Error('Reclass amount is larger than the trade payables it comes from.');
  if (ledgerName !== undefined) {
    const own = trialBalance(ledgers, entries).balances.get(ledgerName);
    if (own === undefined || amountPaise > -own) throw new Error('Reclass amount is larger than the balance of the ledger it comes from.');
  }
  return build(f.debt + amountPaise, f.equity);
}

export function covenantCheck(ratio: number, maxDebtEquity: number): 'within' | 'breach' {
  return ratio <= maxDebtEquity ? 'within' : 'breach';
}

// Current ratio per RULES_v1 R3 (ICAI GN Div I Annexure B): current assets / current liabilities. Integer paise.
// Current assets = debtors, stock, cash, bank, deposits, loans and advances (asset), other current assets.
// Current liabilities = creditors, duties and taxes, other current liabilities, provisions and bank OD.
const CURRENT_ASSET_GROUPS = ['Sundry Debtors', 'Stock-in-Hand', 'Cash-in-Hand', 'Bank Accounts', 'Deposits (Asset)', 'Loans & Advances (Asset)', 'Current Assets'];
const CURRENT_LIABILITY_GROUPS = ['Sundry Creditors', 'Duties & Taxes', 'Current Liabilities', 'Provisions', 'Bank OD A/c'];
export type CurrentRatio = { assets: number; liabilities: number; ratio: number };

function currentFigures(ledgers: Ledger[], entries: Entry[]) {
  const tb = trialBalance(ledgers, entries);
  const group = new Map(ledgers.map(l => [l.ledger_name, l.tally_group]));
  let assets = 0, liabilities = 0;
  for (const [name, balance] of tb.balances) {
    const g = group.get(name)!;
    if (CURRENT_ASSET_GROUPS.includes(g)) assets += balance;
    if (CURRENT_LIABILITY_GROUPS.includes(g)) liabilities -= balance;
  }
  return { assets, liabilities, tb, group };
}
function buildCurrent(assets: number, liabilities: number): CurrentRatio {
  if (liabilities <= 0) throw new Error('Current ratio needs positive current liabilities.');
  return { assets, liabilities, ratio: assets / liabilities };
}
export function currentRatio(ledgers: Ledger[], entries: Entry[]): CurrentRatio {
  const f = currentFigures(ledgers, entries);
  return buildCurrent(f.assets, f.liabilities);
}
// Splitting out the part of a term loan due within 12 months adds it to current liabilities; current assets do not change.
export function currentRatioAfterSplit(ledgers: Ledger[], entries: Entry[], amountPaise: number): CurrentRatio {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('Split amount must be whole paise above zero.');
  const f = currentFigures(ledgers, entries);
  const termLoans = [...f.tb.balances].filter(([name]) => ['Secured Loans', 'Unsecured Loans'].includes(f.group.get(name)!)).reduce((s, [, b]) => s - b, 0);
  if (amountPaise > termLoans) throw new Error('Split amount is larger than the loans it comes from.');
  return buildCurrent(f.assets, f.liabilities + amountPaise);
}

// The current-ratio covenant is a floor (RULES_v1: at least 1.20); the debt-equity covenant above is a ceiling.
export function covenantFloor(ratio: number, minCurrentRatio: number): 'within' | 'breach' {
  return ratio >= minCurrentRatio ? 'within' : 'breach';
}
