import type { Entry, Ledger } from './accounting';
import { covenantCheck, debtEquity, debtEquityAfterReclass, type DebtEquity } from './ratios';
import { r1Outcome, type R1Answer, type R1Outcome } from './outcomes';

export type DecisionSnapshot = {
  outcome: R1Outcome; before: DebtEquity; after?: DebtEquity;
  covenantMax: number; covenantBefore: 'within' | 'breach'; covenantAfter?: 'within' | 'breach';
};

// What the controller sees and what is stored on approval. Computed from the books on the server, never taken from the browser.
export function decisionSnapshot(answer: R1Answer, flag: { ledger: string; amount: number; related?: boolean }, ledgers: Ledger[], entries: Entry[], covenantMax: number): DecisionSnapshot {
  let outcome = r1Outcome(answer, flag);
  // Only trade payables move into borrowings. A flagged ledger that is already a loan ledger has nothing to move and no ratio change.
  const group = ledgers.find(l => l.ledger_name === flag.ledger)?.tally_group;
  if (outcome.kind === 'reclass' && group !== 'Sundry Creditors') {
    outcome = { kind: 'no_change', relatedPartyDisclosure: outcome.relatedPartyDisclosure, legalReview: outcome.legalReview, note: 'This ledger is already shown under borrowings, so there is nothing to move and the ratio does not change.' };
  }
  const before = debtEquity(ledgers, entries);
  const snapshot: DecisionSnapshot = { outcome, before, covenantMax, covenantBefore: covenantCheck(before.ratio, covenantMax) };
  if (outcome.kind === 'reclass') {
    snapshot.after = debtEquityAfterReclass(ledgers, entries, flag.amount, flag.ledger);
    snapshot.covenantAfter = covenantCheck(snapshot.after.ratio, covenantMax);
  }
  return snapshot;
}

// Which outcomes the controller may not approve (only send back). Returns the refusal reason, or null.
export const r1ApprovalBlock = (s: DecisionSnapshot): string | null => (s.outcome.kind === 'ask_more' || s.outcome.kind === 'escalate' ? 'answer_incomplete' : null);
