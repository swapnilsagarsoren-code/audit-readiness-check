export type Ledger = { ledger_name: string; tally_group: string; opening_dr: number; opening_cr: number };
export type Entry = { date: string; voucher_no: string; voucher_type: string; ledger: string; dr: number; cr: number; party: string; narration: string; entered_by: string; entered_at: string };
export type Supplier = { supplier: string; msme_status: string; written_credit_days: number | null };
export function trialBalance(ledgers: Ledger[], entries: Entry[]) {
  const balances = new Map(ledgers.map(l => [l.ledger_name, l.opening_dr - l.opening_cr]));
  for (const e of entries) {
    if (!balances.has(e.ledger)) throw new Error('Unknown ledger in daybook.');
    balances.set(e.ledger, balances.get(e.ledger)! + e.dr - e.cr);
  }
  let dr = 0, cr = 0, revenue = 0, expenses = 0, otherIncome = 0;
  for (const l of ledgers) {
    const b = balances.get(l.ledger_name)!;
    if (b >= 0) dr += b; else cr -= b;
    if (l.tally_group === 'Sales Accounts') revenue -= b;
    if (['Purchase Accounts', 'Direct Expenses', 'Indirect Expenses'].includes(l.tally_group)) expenses += b;
    if (l.tally_group === 'Indirect Incomes') otherIncome -= b;
  }
  return { dr, cr, revenue, pbt: revenue + otherIncome - expenses, balances };
}
