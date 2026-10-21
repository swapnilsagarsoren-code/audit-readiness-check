import type { Entry } from './accounting';
import { formatIndianRupees } from './flag-input';
import { plainDate } from './r1-question';
import { covenantFloor, currentRatio, currentRatioAfterSplit, type CurrentRatio } from './ratios';
import type { RuleData } from './rules';

// R3 (term loan, no current-maturity split): the question is written by code, the split is computed by code from the instalments in the books,
// and the outcome is fixed from RULES_v1 R3. The split is only confirmed once the repayment schedule is on file.
export const DOCUMENT_OPTIONS = ['both', 'sanction_only', 'schedule_only', 'neither', 'not_sure'] as const;
export type R3Answer = { documents?: (typeof DOCUMENT_OPTIONS)[number] };
export type Split = { balance: number; totalInstalments: number; paid: number; remaining: number; instalment: number; due12: number };
export type R3Snapshot = {
  kind: 'split' | 'estimate' | 'cannot_compute' | 'ask_more';
  split: Split | null; entry?: { debit: string; credit: string; amount: number };
  currentBefore?: CurrentRatio; currentAfter?: CurrentRatio; covenantMin?: number; covenantBefore?: 'within' | 'breach'; covenantAfter?: 'within' | 'breach';
  notes: string[];
};
const CAPTION = 'Current maturities of long-term borrowings';
export const R3_QUESTION = {
  question: 'Are the sanction letter and the repayment schedule on file?',
  buttons: [['both', 'Both on file'], ['sanction_only', 'Only the sanction letter'], ['schedule_only', 'Only the repayment schedule'], ['neither', 'Neither'], ['not_sure', 'Not sure']].map(([value, label]) => ({ value, label })),
};

export function computeSplit(data: RuleData, loan: string): Split | null {
  const es = [...data.entries].filter(e => e.ledger === loan).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) as Entry[];
  const ledger = data.ledgers.find(l => l.ledger_name === loan);
  if (!ledger || es.length === 0) return null;
  const total = es.map(e => /(\d+)\s+monthly\s+instalments?/i.exec(e.narration)).find(Boolean);
  const principal = es.filter(e => e.dr > 0 && /principal instalment/i.test(e.narration));
  if (!total || principal.length === 0) return null;
  const totalInstalments = Number(total[1]), instalment = principal[principal.length - 1].dr;
  const balance = ledger.opening_cr - ledger.opening_dr + es.reduce((s, e) => s + e.cr - e.dr, 0);
  if (!(balance > 0) || !(totalInstalments > 0)) return null;
  const remaining = Math.max(totalInstalments - principal.length, 0);
  return { balance, totalInstalments, paid: principal.length, remaining, instalment, due12: Math.min(balance, instalment * Math.min(12, remaining)) };
}

export function fixedR3Context(data: RuleData, loan: string): string {
  const s = computeSplit(data, loan);
  const es = data.entries.filter(e => e.ledger === loan && e.cr > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const lender = es[0]?.party ?? loan;
  if (!s || !es[0]) return `The books show a term loan from ${lender}. The instalment terms are not stated in the books. There is no current-maturities ledger.`;
  return `The books show a term loan from ${lender} with a closing balance of ${formatIndianRupees(s.balance)}. The loan was received on ${plainDate(es[0].date)} with ${s.totalInstalments} monthly instalments, and ${s.paid} principal instalments of ${formatIndianRupees(s.instalment)} have been paid. There is no current-maturities ledger.`;
}

export function r3Snapshot(answer: R3Answer, data: RuleData, loan: string, covenantMin: number): R3Snapshot {
  if (answer.documents !== undefined && !(DOCUMENT_OPTIONS as readonly string[]).includes(answer.documents)) throw new Error('Unknown answer.');
  if (!data.ledgers.some(l => l.ledger_name === loan)) throw new Error('Unknown loan.');
  if (!answer.documents) return { kind: 'ask_more', split: null, notes: ['An answer is needed before an outcome can be shown.'] };
  const split = computeSplit(data, loan);
  if (!split) return { kind: 'cannot_compute', split: null, notes: ['The books do not give the instalment terms, so no split is worked out. Ask for the repayment schedule.'] };
  if (split.due12 <= 0) return { kind: 'cannot_compute', split, notes: ['The books show no instalments left to pay, yet the loan still has a balance. No split is worked out. Ask for the repayment schedule.'] };
  const ledgers = data.ledgers, entries = data.entries as unknown as Entry[];
  const before = currentRatio(ledgers, entries), after = currentRatioAfterSplit(ledgers, entries, split.due12);
  const confirmed = answer.documents === 'both' || answer.documents === 'schedule_only';
  const notes = [
    `Show the part due within 12 months as "${CAPTION}" under short-term borrowings (Schedule III Division I); controller to confirm against the repayment schedule.`,
    'Debt-equity does not change; the current ratio falls because current liabilities rise.',
    'Equal instalments are assumed, each the same as the latest principal instalment in the books, and only instalments booked in this year are counted; a moratorium, step-up or balloon schedule, interest inside an instalment, or earlier years would change the split.',
    confirmed ? 'The split is worked out from the instalments in the books and the repayment schedule is on file.' : 'Ask for the repayment schedule: the split is an estimate from the books until it is on file.',
  ];
  return {
    kind: confirmed ? 'split' : 'estimate', split, entry: { debit: loan, credit: CAPTION, amount: split.due12 },
    currentBefore: before, currentAfter: after, covenantMin, covenantBefore: covenantFloor(before.ratio, covenantMin), covenantAfter: covenantFloor(after.ratio, covenantMin), notes,
  };
}

// Only a split confirmed by the schedule on file may be approved; an estimate or a missing split may only be sent back.
export const r3ApprovalBlock = (s: R3Snapshot): string | null => (s.kind !== 'split' ? 'answer_incomplete' : null);
