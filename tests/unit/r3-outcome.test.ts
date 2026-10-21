import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData } from '../../scripts/seed-data.ts';
import type { RuleData } from '../../shared/rules.ts';
import { computeSplit, r3Snapshot, R3_QUESTION, fixedR3Context } from '../../shared/r3-outcome.ts';

const data = (await loadSeedData('.')) as unknown as RuleData;
const LOAN = 'Meridian Co-operative Bank Term Loan';
const CR = 1_00_00_000_00;

test('split from the books: 60 instalments, 12 paid of Rs 20 lakh, so Rs 2.4 cr falls due within 12 months of 31 March 2026', () => {
  const s = computeSplit(data, LOAN)!;
  assert.equal(s.balance, 96 * CR / 10);
  assert.equal(s.totalInstalments, 60);
  assert.equal(s.paid, 12);
  assert.equal(s.remaining, 48);
  assert.equal(s.instalment, 20_00_000_00);
  assert.equal(s.due12, 24 * CR / 10);
});

test('the split never exceeds the balance (few instalments left) and is null when the books do not give the terms', () => {
  const near = { ...data, entries: data.entries.filter(e => !(e.ledger === LOAN && /principal instalment/i.test(e.narration) && e.date > '2025-06')) };
  assert.ok(computeSplit(near as unknown as RuleData, LOAN)!.due12 <= computeSplit(near as unknown as RuleData, LOAN)!.balance);
  const noTerms = { ...data, entries: data.entries.map(e => e.ledger === LOAN ? { ...e, narration: e.narration.replace(/\d+ monthly instalments/i, 'instalments') } : e) };
  assert.equal(computeSplit(noTerms as unknown as RuleData, LOAN), null);
  assert.equal(computeSplit(data, 'Nobody Loan'), null);
});

test('both on file: split of Rs 2.4 cr, current ratio 1.23 to 1.14 against the 1.20 floor, entry into current maturities', () => {
  const s = r3Snapshot({ documents: 'both' }, data, LOAN, 1.2);
  assert.equal(s.kind, 'split');
  assert.equal(s.split!.due12, 24 * CR / 10);
  assert.equal(s.currentBefore!.ratio.toFixed(2), '1.23');
  assert.equal(s.currentAfter!.ratio.toFixed(2), '1.14');
  assert.equal(s.covenantBefore, 'within');
  assert.equal(s.covenantAfter, 'breach');
  assert.deepEqual(s.entry, { debit: LOAN, credit: 'Current maturities of long-term borrowings', amount: 24 * CR / 10 });
  assert.ok(s.notes.some(n => /Schedule III Division I/.test(n)) && s.notes.some(n => /controller to confirm/.test(n)));
  assert.ok(s.notes.some(n => /Debt-equity does not change/.test(n)));
  assert.ok(s.notes.some(n => /Equal instalments are assumed/.test(n) && /only instalments booked in this year/.test(n)));
});

test('schedule on file counts as confirmed; without the schedule the split is only an estimate and cannot be approved', () => {
  assert.equal(r3Snapshot({ documents: 'schedule_only' }, data, LOAN, 1.2).kind, 'split');
  for (const documents of ['sanction_only', 'neither', 'not_sure'] as const) {
    const s = r3Snapshot({ documents }, data, LOAN, 1.2);
    assert.equal(s.kind, 'estimate', documents);
    assert.ok(s.notes.some(n => /Ask for the repayment schedule/.test(n)));
    assert.equal(s.split!.due12, 24 * CR / 10);
  }
});

test('terms the books do not give: no split is guessed, the schedule is asked for', () => {
  const noTerms = { ...data, entries: data.entries.map(e => e.ledger === LOAN ? { ...e, narration: e.narration.replace(/\d+ monthly instalments/i, 'instalments') } : e) } as unknown as RuleData;
  const s = r3Snapshot({ documents: 'both' }, noTerms, LOAN, 1.2);
  assert.equal(s.kind, 'cannot_compute');
  assert.equal(s.split, null);
  assert.equal(s.entry, undefined);
});

test('a loan with a balance but no instalments left is cannot_compute, not a crash', () => {
  const over = { ...data, entries: data.entries.map(e => e.ledger === LOAN ? { ...e, narration: e.narration.replace(/60 monthly instalments/i, '10 monthly instalments') } : e) } as unknown as RuleData;
  const s = r3Snapshot({ documents: 'both' }, over, LOAN, 1.2);
  assert.equal(s.kind, 'cannot_compute');
  assert.equal(s.entry, undefined);
  assert.ok(s.notes.some(n => /no instalments left/.test(n)));
});

test('a missing answer asks for it; unknown answers and loans are refused', () => {
  assert.equal(r3Snapshot({}, data, LOAN, 1.2).kind, 'ask_more');
  assert.throws(() => r3Snapshot({ documents: 'maybe' } as never, data, LOAN, 1.2));
  assert.throws(() => r3Snapshot({ documents: 'both' }, data, 'Nobody Loan', 1.2));
});

test('one question with five buttons, and a context line with the facts and no advice', () => {
  assert.equal(R3_QUESTION.question, 'Are the sanction letter and the repayment schedule on file?');
  assert.deepEqual(R3_QUESTION.buttons.map(b => b.value), ['both', 'sanction_only', 'schedule_only', 'neither', 'not_sure']);
  assert.equal(R3_QUESTION.question.split('?').length, 2);
  assert.equal(fixedR3Context(data, LOAN), 'The books show a term loan from Meridian Co-operative Bank with a closing balance of ₹9,60,00,000. The loan was received on 1 April 2025 with 60 monthly instalments, and 12 principal instalments of ₹20,00,000 have been paid. There is no current-maturities ledger.');
});
