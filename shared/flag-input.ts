import { getEvidence } from './evidence';
import type { EvidenceItem, RuleId } from './evidence.ts';
import { getQuestionGoal, getRouting } from './routing';
import { getTheme } from './themes';

export type { RuleId } from './evidence.ts';

export interface RawFlagEntry {
  date: string;
  party: string;
  narration: string;
  amountPaise: number;
  voucherNo: string;
  lineNo: number;
}

export interface RawFlag {
  flagKey: string;
  ruleId: RuleId;
  ledgerName: string;
  tallyGroup: string;
  entries: RawFlagEntry[];
}

export interface FlagInputEntry {
  date: string;
  party: string;
  narration: string;
  amount: string;
}

export interface FlagInput {
  ruleId: RuleId;
  /** The rule-owned question goal replaces the theme facets in the AI input. */
  theme: { title: string; goal: string; options: string[] };
  evidence: EvidenceItem[];
  ledger: string;
  tallyGroup: string;
  /** Computed by code so the AI never counts or adds; present only when a total is unambiguous (see buildFlagInput). */
  entryCount?: string;
  totalAmount?: string;
  entries: FlagInputEntry[];
}

export function formatIndianRupees(amountPaise: number): string {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
    throw new Error('Question input refused: amount must be non-negative integer paise.');
  }
  const rupees = Math.floor(amountPaise / 100).toString();
  const leading = rupees.slice(0, -3).replace(/\B(?=(?:\d{2})+$)/g, ',');
  const grouped = leading ? `${leading},${rupees.slice(-3)}` : rupees;
  const paise = amountPaise % 100;
  return `₹${grouped}${paise ? `.${paise.toString().padStart(2, '0')}` : ''}`;
}

// Money in the table: whole paise to rupees with two decimals, Indian grouping.
export function rupeesAndPaise(paise: number): string {
  const rupees = Math.floor(paise / 100).toString(), p = (paise % 100).toString().padStart(2, '0');
  const lead = rupees.slice(0, -3).replace(/\B(?=(?:\d{2})+$)/g, ',');
  return `₹${lead ? `${lead},` : ''}${rupees.slice(-3)}.${p}`;
}

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function orderFlagEntries(flag: RawFlag): RawFlagEntry[] {
  const entries = [...flag.entries].sort((a, b) =>
    compareText(a.date, b.date) || compareText(a.voucherNo, b.voucherNo) ||
    a.lineNo - b.lineNo || compareText(a.party, b.party) ||
    compareText(a.narration, b.narration) || a.amountPaise - b.amountPaise,
  );
  if (flag.ruleId !== 'R2') return entries;
  const bill = entries.find(entry => !entry.narration.startsWith('Payment against invoice '));
  if (!bill) return entries;
  const payment = entries.find(entry => entry.narration === `Payment against invoice ${bill.voucherNo}`);
  return [bill, ...(payment ? [payment] : []), ...entries.filter(entry => entry !== bill && entry !== payment)];
}

/**
 * A count is supplied for any multi-entry flag where every entry is from one party, so it cannot be
 * attributed to the wrong party. A total is supplied only for R1 receipts, which are additive by
 * construction (allowlist), so it cannot net mixed directions.
 */
const ADDITIVE_RULES: ReadonlySet<RuleId> = new Set(['R1']);
function countAndTotal(flag: RawFlag): { entryCount?: string; totalAmount?: string } {
  if (flag.entries.length < 2 || new Set(flag.entries.map(entry => entry.party)).size !== 1) return {};
  return {
    entryCount: String(flag.entries.length),
    ...(ADDITIVE_RULES.has(flag.ruleId)
      ? { totalAmount: formatIndianRupees(flag.entries.reduce((sum, entry) => sum + entry.amountPaise, 0)) } : {}),
  };
}

export function buildFlagInput(flag: RawFlag): FlagInput {
  const theme = getTheme(getRouting(flag.ruleId).theme);
  return {
    ruleId: flag.ruleId,
    theme: { title: theme.title, goal: getQuestionGoal(flag.ruleId), options: flag.ruleId === 'R1' ? [] : theme.options },
    evidence: getEvidence(flag.ruleId),
    ledger: flag.ledgerName,
    tallyGroup: flag.tallyGroup,
    ...countAndTotal(flag),
    entries: orderFlagEntries(flag).slice(0, 10).map(entry => ({
      date: entry.date,
      party: entry.party,
      narration: entry.narration,
      amount: formatIndianRupees(entry.amountPaise),
    })),
  };
}
