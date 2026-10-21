import type { Entry, Ledger, Supplier } from './accounting';
import type { SeedEntry } from './seed-records.ts';

// Code signals for RULES_v1 R1-R3 (Gate A). Pure functions; amounts are integer paise.
export type RuleData = {
  company: { start: string; end: string; directors: string[]; relatives: { name: string }[]; shareholders: string[] };
  ledgers: Ledger[]; entries: (Entry | SeedEntry)[]; suppliers: Supplier[];
};
export type EntryRef = { voucher_no: string; ledger: string };
export type RuleFlag = {
  ruleId: 'R1' | 'R2' | 'R3'; party: string; ledger: string; amount: number; entryRefs: EntryRef[];
  related: boolean;      // R1: party is on the directors / relatives / shareholders list
  statusKnown: boolean;  // R2: supplier has an MSME status in the master
  note: string;
};

const ROUND_PAISE = 10_000_000; // a whole multiple of Rs 1 lakh counts as round
const DAY = 86_400_000;
const day = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY; };
const ref = (e: Entry): EntryRef => ({ voucher_no: e.voucher_no, ledger: e.ledger });
const groupOf = (data: RuleData) => new Map(data.ledgers.map(l => [l.ledger_name, l.tally_group]));

export function r1Flags(data: RuleData): RuleFlag[] {
  const group = groupOf(data);
  const banks = new Set(data.ledgers.filter(l => l.tally_group === 'Bank Accounts').map(l => l.ledger_name));
  const bankVouchers = new Set(data.entries.filter(e => banks.has(e.ledger) && e.dr > 0).map(e => e.voucher_no));
  const norm = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();
  const related = new Set([...data.company.directors, ...data.company.relatives.map(r => r.name), ...data.company.shareholders].map(norm));
  const hits = new Map<string, Entry[]>();
  for (const e of data.entries) {
    const g = group.get(e.ledger);
    if (g !== 'Sundry Creditors' && g !== 'Unsecured Loans') continue;
    const bankReceipt = e.cr > 0 && e.cr % ROUND_PAISE === 0 && e.voucher_type === 'Receipt' && bankVouchers.has(e.voucher_no);
    const interest = e.dr > 0 && /interest/i.test(e.narration);
    if (bankReceipt || interest) hits.set(e.ledger, [...(hits.get(e.ledger) ?? []), e as Entry]);
  }
  return [...hits].map(([ledger, es]) => ({
    ruleId: 'R1' as const, party: ledger, ledger, amount: es.reduce((s, e) => s + e.cr + e.dr, 0), entryRefs: es.map(ref),
    related: related.has(norm(ledger)), statusKnown: true,
    note: 'Round-amount bank receipts or interest on a creditor or unsecured-loan ledger.',
  }));
}

export type LateBill = { voucher_no: string; ledger: string; billDate: string; amount: number; paidDate: string | null; daysLate: number };
const isoDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);

// Bills of one micro or small supplier (or one with no status) paid, or still unpaid at year end, beyond the allowed days from the bill date.
// Written terms are capped at 45 days; blank or 0 days means the 15-day default. A payment settles one whole bill (known limit).
export function msmeLateBills(data: RuleData, s: Supplier, allowedOverride?: number): { allowed: number; bills: LateBill[] } {
  const yearEnd = day(data.company.end);
  const allowed = allowedOverride ?? (s.written_credit_days ? Math.min(s.written_credit_days, 45) : 15);
  const bills = data.entries.filter(e => e.ledger === s.supplier && e.cr > 0 && e.voucher_type === 'Purchase');
  const pays = data.entries.filter(e => e.ledger === s.supplier && e.dr > 0 && e.voucher_type === 'Payment');
  const paidOn = new Map<string, number>(); // bill voucher -> payment day
  const spare = [...pays].sort((a, b) => day(a.date) - day(b.date));
  for (const p of pays) { const b = (p.narration.match(/[A-Z]+-?\d+/g) ?? []).map(t => bills.find(x => x.voucher_no === t)).find(Boolean); if (b) { paidOn.set(b.voucher_no, day(p.date)); spare.splice(spare.indexOf(p), 1); } }
  for (const b of [...bills].sort((a, c) => day(a.date) - day(c.date))) if (!paidOn.has(b.voucher_no) && spare.length) paidOn.set(b.voucher_no, day(spare.shift()!.date));
  const late: LateBill[] = [];
  for (const b of bills) {
    const end = paidOn.get(b.voucher_no) ?? yearEnd, daysLate = end - day(b.date) - allowed;
    if (daysLate > 0) late.push({ voucher_no: b.voucher_no, ledger: b.ledger, billDate: b.date.slice(0, 10), amount: b.cr, paidDate: paidOn.has(b.voucher_no) ? isoDay(end) : null, daysLate });
  }
  return { allowed, bills: late };
}

export function r2Flags(data: RuleData): RuleFlag[] {
  const status = new Map(data.suppliers.map(s => [s.supplier, s]));
  const flags: RuleFlag[] = [];
  for (const s of data.suppliers) {
    if (s.msme_status === 'Medium' || s.msme_status === 'Not registered') continue;
    const { allowed, bills: late } = msmeLateBills(data, s);
    if (late.length === 0) continue;
    flags.push({
      ruleId: 'R2', party: s.supplier, ledger: s.supplier, amount: late.reduce((t, b) => t + b.amount, 0), entryRefs: late.map(b => ({ voucher_no: b.voucher_no, ledger: b.ledger })),
      related: false, statusKnown: status.get(s.supplier)!.msme_status !== '',
      note: `Paid or unpaid beyond ${allowed} days from the bill date.`,
    });
  }
  return flags;
}

export function r3Flags(data: RuleData): RuleFlag[] {
  const splits = data.ledgers.filter(l => /current maturit/i.test(l.ledger_name));
  const loans = data.ledgers.filter(l => (l.tally_group === 'Secured Loans' || l.tally_group === 'Unsecured Loans') && /term[\s-]*loan|\bTL\b/i.test(l.ledger_name));
  const stem = (name: string) => name.replace(/term[\s-]*loan|\bTL\b/gi, '').trim().toLowerCase();
  const named = (loan: Ledger) => splits.some(sp => stem(loan.ledger_name) !== '' && sp.ledger_name.toLowerCase().includes(stem(loan.ledger_name)));
  // A split ledger naming the lender clears that loan; a generic one clears only the single term loan it can refer to.
  const generic = splits.some(sp => !loans.some(l => sp.ledger_name.toLowerCase().includes(stem(l.ledger_name))));
  return loans.filter(l => !named(l) && !(generic && loans.length === 1)).map(l => {
    const es = data.entries.filter(e => e.ledger === l.ledger_name);
    const balance = l.opening_cr - l.opening_dr + es.reduce((s, e) => s + e.cr - e.dr, 0);
    return {
      ruleId: 'R3' as const, party: es[0]?.party ?? l.ledger_name, ledger: l.ledger_name, amount: Math.max(balance, 0), entryRefs: es.map(ref),
      related: false, statusKnown: true, note: 'Term loan with no current-maturities ledger. Size shown is the closing balance, not the amount due within 12 months.',
    };
  });
}

// Known limits of the Gate A signals (logged, not hidden): R2 treats each payment as settling one whole bill and ignores
// opening payables and debit notes; R1 does not test "no purchase vouchers"; R3 size is the closing balance.
