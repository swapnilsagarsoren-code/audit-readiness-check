import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { decisionSnapshot } from '../../shared/decision.ts';
import type { R1Answer } from '../../shared/outcomes.ts';

const { ledgers, entries } = await loadSeedData('.');
const CR = 1_00_00_000_00;
const rajesh = { ledger: 'Rajesh Mehta', amount: 25 * CR / 10 };
const loan = (o: Partial<R1Answer> = {}): R1Answer => ({ nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes', ...o });

test('Rajesh as a director loan within 12 months: reclass, ratio 1.40 to 1.57, covenant 1.50 breached after', () => {
  const s = decisionSnapshot(loan(), rajesh, ledgers, entries, 1.5);
  assert.equal(s.outcome.kind, 'reclass');
  assert.equal(s.before.ratio.toFixed(2), '1.40');
  assert.equal(s.after!.ratio.toFixed(2), '1.57');
  assert.equal(s.covenantBefore, 'within');
  assert.equal(s.covenantAfter, 'breach');
  assert.equal(s.covenantMax, 1.5);
});

test('goods or services: no change, so no after figures', () => {
  const s = decisionSnapshot({ nature: 'goods_services' }, rajesh, ledgers, entries, 1.5);
  assert.equal(s.outcome.kind, 'no_change');
  assert.equal(s.after, undefined);
  assert.equal(s.covenantAfter, undefined);
});

test('an answer that still needs a follow-up or goes to the owner shows no after figures either', () => {
  assert.equal(decisionSnapshot({ nature: 'loan' }, rajesh, ledgers, entries, 1.5).after, undefined);
  assert.equal(decisionSnapshot({ nature: 'deposit' }, rajesh, ledgers, entries, 1.5).after, undefined);
});

test('the snapshot is plain data with whole-paise integers', () => {
  const s = decisionSnapshot(loan(), rajesh, ledgers, entries, 1.5);
  for (const v of [s.before.debt, s.before.equity, s.after!.debt, s.after!.equity]) assert.ok(Number.isSafeInteger(v));
  assert.doesNotThrow(() => JSON.stringify(s));
});

test('refuses an amount larger than the creditors it would come from', () => {
  assert.throws(() => decisionSnapshot(loan(), { ledger: 'Rajesh Mehta', amount: 1_000 * CR }, ledgers, entries, 1.5));
});

test('a flagged ledger that is already a loan ledger (Anita Mehta, Unsecured Loans) is not counted twice', () => {
  const s = decisionSnapshot(loan({ counterparty: 'relative' }), { ledger: 'Anita Mehta', amount: 6 * CR / 10, related: true }, ledgers, entries, 1.5);
  assert.equal(s.outcome.kind, 'no_change');
  assert.equal(s.outcome.entry, undefined);
  assert.equal(s.after, undefined);
  assert.equal(s.before.ratio.toFixed(2), '1.40');
  assert.match(s.outcome.note, /already shown under borrowings/);
});

test('the Trust, still a trade payable, is moved and keeps the possible related party note', () => {
  const s = decisionSnapshot(loan({ counterparty: 'other', term: 'on_demand', declaration: undefined }), { ledger: 'Mehta Family Trust', amount: 5 * CR / 10, related: true }, ledgers, entries, 1.5);
  assert.equal(s.outcome.kind, 'reclass');
  assert.equal(s.after!.ratio.toFixed(2), '1.43');
  assert.match(s.outcome.note, /Possible related party/);
});

test('the amount is capped at the flagged ledger\'s own balance, not at all trade payables', () => {
  assert.throws(() => decisionSnapshot(loan(), { ledger: 'Rajesh Mehta', amount: 3 * CR }, ledgers, entries, 1.5));
});
