import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TermLoanDetailPage, type TermLoanData, type TermLoanState } from '../../src/TermLoanDetail.tsx';
import { R3_QUESTION } from '../../shared/r3-outcome.ts';

const noop = () => {};
const detail: TermLoanData = {
  flag: { flagKey: 'R3:Meridian Co-operative Bank Term Loan', party: 'Meridian Co-operative Bank', ledger: 'Meridian Co-operative Bank Term Loan', amount: 96_00_00_000_00 / 10, band: 'flagged' },
  context: 'The books show a term loan from Meridian Co-operative Bank with a closing balance of ₹9,60,00,000. The loan was received on 1 April 2025 with 60 monthly instalments, and 12 principal instalments of ₹20,00,000 have been paid. There is no current-maturities ledger.',
  question: R3_QUESTION, evidence: [{ id: 'R3-SANCTION', label: 'Sanction letter' }, { id: 'R3-REPAYMENT-SCHEDULE', label: 'Repayment schedule' }],
  answer: null, snapshot: null, decision: null,
};
const split = { balance: 9_60_00_000_00, totalInstalments: 60, paid: 12, remaining: 48, instalment: 20_00_000_00, due12: 2_40_00_000_00 };
const snap = {
  kind: 'split' as const, split, entry: { debit: 'Meridian Co-operative Bank Term Loan', credit: 'Current maturities of long-term borrowings', amount: 2_40_00_000_00 },
  currentBefore: { assets: 37_00_00_000_00, liabilities: 30_10_00_000_00, ratio: 1.2292 }, currentAfter: { assets: 37_00_00_000_00, liabilities: 32_50_00_000_00, ratio: 1.1385 },
  covenantMin: 1.2, covenantBefore: 'within' as const, covenantAfter: 'breach' as const,
  notes: ['Show the part due within 12 months as "Current maturities of long-term borrowings" under short-term borrowings (Schedule III Division I); controller to confirm against the repayment schedule.', 'Debt-equity does not change; the current ratio falls because current liabilities rise.'],
};
const html = (state: TermLoanState, selection = {}, extra = {}) => renderToStaticMarkup(createElement(TermLoanDetailPage, { state, selection, passcode: '', busy: false, message: '', onSelect: noop, onPasscode: noop, onSave: noop, onDecide: noop, ...extra }));

test('detail: back link, lender, facts, one question with five buttons and nothing pre-selected', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('href="#/"') && out.includes('Meridian Co-operative Bank'));
  assert.ok(out.includes('What the books show') && out.includes('The books show a term loan from Meridian Co-operative Bank'));
  assert.ok(out.includes('Are the sanction letter and the repayment schedule on file?'));
  for (const b of R3_QUESTION.buttons) assert.ok(out.includes(`>${b.label}<`), b.label);
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 0);
  assert.ok(out.includes('Sanction letter') && out.includes('Repayment schedule'));
  assert.ok(out.includes('Edit passcode') && out.includes('Needed to save an answer or a decision.'));
});

test('outcome: split, entry, current ratio before and after against the floor in words, debt-equity note', () => {
  const out = html({ status: 'ready', data: { ...detail, answer: { documents: 'both' }, snapshot: snap } }, { documents: 'both' });
  assert.ok(out.includes('What this means for the accounts'));
  assert.ok(out.includes('Current ratio, before and after'));
  assert.ok(out.includes('1.23') && out.includes('1.14'));
  assert.ok(out.includes('Within the 1.20 floor') && out.includes('Below the 1.20 floor'));
  assert.ok(out.includes('Due within 12 months') && out.includes('₹2,40,00,000'));
  assert.ok(out.includes('Proposed entry') && out.includes('Current maturities of long-term borrowings'));
  assert.ok(out.includes('Nothing is written to the books. This records your decision only.'));
  assert.match(out, /<button type="button" disabled="">Approve<\/button>/); // no passcode typed yet
});

test('an estimate (schedule not on file) offers Send back only and says so', () => {
  const est = { ...snap, kind: 'estimate' as const, notes: [...snap.notes, 'Ask for the repayment schedule: the split is an estimate from the books until it is on file.'] };
  const out = html({ status: 'ready', data: { ...detail, answer: { documents: 'neither' }, snapshot: est } }, { documents: 'neither' });
  assert.ok(out.includes('Ask for the repayment schedule'));
  assert.ok(!out.includes('>Approve<') && out.includes('>Send back<'));
});

test('cannot compute: no ratio table, no entry, Send back only', () => {
  const none = { kind: 'cannot_compute' as const, split: null, notes: ['The books do not give the instalment terms, so no split is worked out. Ask for the repayment schedule.'] };
  const out = html({ status: 'ready', data: { ...detail, answer: { documents: 'both' }, snapshot: none } }, { documents: 'both' });
  assert.ok(!out.includes('Current ratio, before and after') && !out.includes('Proposed entry'));
  assert.ok(!out.includes('>Approve<') && out.includes('>Send back<'));
});

test('unsaved choice disables both buttons and says why; a recorded decision is shown; ask-more shows no buttons', () => {
  const saved = { ...detail, answer: { documents: 'both' }, snapshot: snap };
  const changed = html({ status: 'ready', data: saved }, { documents: 'neither' }, { passcode: 'x' });
  assert.match(changed, /Save the answer first/);
  assert.match(changed, /<button type="button" disabled="">Approve<\/button>/);
  const same = html({ status: 'ready', data: { ...saved, decision: { decision: 'approved' as const, decidedAt: 1 } } }, { documents: 'both' }, { passcode: 'x' });
  assert.match(same, /<button type="button">Approve<\/button>/);
  assert.ok(same.includes('Approved'));
  const ask = { kind: 'ask_more' as const, split: null, notes: ['An answer is needed before an outcome can be shown.'] };
  assert.ok(!html({ status: 'ready', data: { ...saved, snapshot: ask } }).includes('>Send back<'));
});

test('loading, error and missing states; no banned wording', () => {
  assert.doesNotMatch(html({ status: 'loading' }), /₹/);
  assert.match(html({ status: 'error' }, {}, { onRetry: noop }), /role="alert"/);
  assert.ok(html({ status: 'missing' }).includes('Nothing to review here.'));
  assert.doesNotMatch(html({ status: 'ready', data: { ...detail, answer: { documents: 'both' }, snapshot: snap } }), /fraud|forensic|platform|continuously tracks|red flag|error found|AI decided/i);
});
