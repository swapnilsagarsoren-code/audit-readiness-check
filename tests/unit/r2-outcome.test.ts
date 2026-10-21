import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData } from '../../scripts/seed-data.ts';
import type { RuleData } from '../../shared/rules.ts';
import { r2Snapshot, R2_FOLLOWUPS, fixedR2Context, type R2Answer } from '../../shared/r2-outcome.ts';

const data = (await loadSeedData('.')) as unknown as RuleData;
const rate = { value: 5.75, date: '2025-10-20', sourceUrl: 'https://www.rbi.org.in/' };
const ans = (o: Partial<R2Answer> = {}): R2Answer => ({ certificate: 'yes', size: 'small', terms: 'none', ...o });

test('Delta Rubber, Small, no written terms: one bill 15 days late, interest Rs 5,671.23 at the stored Bank Rate', () => {
  const s = r2Snapshot(ans(), data, 'Delta Rubber', rate);
  assert.equal(s.kind, 'interest_due');
  assert.equal(s.allowed, 15);
  assert.equal(s.principal, 8_00_000_00);
  assert.equal(s.interest, 567_123);
  assert.deepEqual(s.bills.map(b => [b.voucher_no, b.daysLate]), [['NF-00032', 15]]);
  assert.equal(s.bankRate?.value, 5.75);
  assert.ok(s.notes.some(n => /MSME/.test(n)) && s.notes.some(n => /controller to confirm/.test(n)));
  assert.ok(s.notes.includes('This screen does not record an agreed interest rate, so the rate under MSMED Act s.16 is applied: three times the RBI Bank Rate (5.75%, as listed on rbi.org.in on 20 October 2025). Indicative: monthly rests, current rate only, controller to confirm.'));
});

test('the answered terms replace the master: 30 days written means Delta Rubber was on time', () => {
  const s = r2Snapshot(ans({ terms: 'up_to_30' }), data, 'Delta Rubber', rate);
  assert.equal(s.kind, 'not_late');
  assert.equal(s.interest, 0);
  assert.equal(s.allowed, 30);
});

test('more than 45 days in writing is capped at 45', () => {
  assert.equal(r2Snapshot(ans({ terms: 'over_45' }), data, 'Bharat Fasteners', rate).allowed, 45);
  assert.equal(r2Snapshot(ans({ size: 'micro', terms: 'up_to_45' }), data, 'Bharat Fasteners', rate).bills[0].daysLate, 23);
});

test('no stored Bank Rate: interest is "not priced yet", never guessed', () => {
  const s = r2Snapshot(ans(), data, 'Delta Rubber', null);
  assert.equal(s.kind, 'interest_due');
  assert.equal(s.interest, null);
  assert.equal(s.bankRate, null);
  assert.ok(s.notes.some(n => /Not priced yet/.test(n)));
  assert.equal(s.bills[0].interest, null);
});

test('Medium or not registered: no MSMED interest at all; not on file or not sure: ask for the certificate', () => {
  for (const size of ['medium', 'not_registered'] as const) assert.equal(r2Snapshot(ans({ size }), data, 'Delta Rubber', rate).kind, 'no_interest');
  assert.equal(r2Snapshot(ans({ certificate: 'no', size: undefined }), data, 'Delta Rubber', rate).kind, 'escalate');
  assert.equal(r2Snapshot(ans({ certificate: 'not_sure', size: undefined }), data, 'Delta Rubber', rate).kind, 'escalate');
  assert.equal(r2Snapshot(ans({ size: 'not_sure' }), data, 'Delta Rubber', rate).kind, 'escalate');
});

test('a supplier with no registration at all gets no MSMED interest without a contradictory size answer', () => {
  const s = r2Snapshot({ certificate: 'not_registered', terms: 'none' }, data, 'Delta Rubber', rate);
  assert.equal(s.kind, 'no_interest');
  assert.ok(s.notes.every(n => /controller to confirm/.test(n)));
});

test('every non-interest outcome note is hedged with controller to confirm', () => {
  for (const a of [ans({ size: 'medium' }), ans({ terms: 'up_to_30' })]) assert.ok(r2Snapshot(a, data, 'Delta Rubber', rate).notes.every(n => /controller to confirm/.test(n)));
});

test('a missing answer asks for it and shows no money', () => {
  const s = r2Snapshot({ certificate: 'yes' }, data, 'Delta Rubber', rate);
  assert.equal(s.kind, 'ask_more');
  assert.deepEqual(s.missing, ['size', 'terms']);
  assert.equal(s.interest, undefined);
  assert.deepEqual(r2Snapshot({ terms: 'none' }, data, 'Delta Rubber', rate).missing, ['certificate']);
});

test('Kumar Packaging, status blank and unpaid: the certificate question comes first and size follows from the answer', () => {
  const s = r2Snapshot(ans({ size: 'small' }), data, 'Kumar Packaging', rate);
  assert.equal(s.kind, 'interest_due');
  assert.equal(s.bills[0].paidDate, null);
  assert.equal(s.bills[0].daysLate, 37);
});

test('the code-written context line states the bills, days taken and the terms in the master, with no money other than the bills', () => {
  const ctx = fixedR2Context(data, 'Delta Rubber');
  assert.equal(ctx, 'The books show 1 bill from Delta Rubber, totalling ₹8,00,000. The bill dated 1 June 2025 was paid on 1 July 2025, 30 days after the bill date. The supplier master records the size as Small and no written credit terms.');
  assert.match(fixedR2Context(data, 'Kumar Packaging'), /not paid by 31 March 2026/);
  assert.match(fixedR2Context(data, 'Kumar Packaging'), /records no size/);
  assert.match(fixedR2Context(data, 'Bharat Fasteners'), /written credit terms of 45 days/);
});

test('three short follow-ups with their own buttons; the size question only after "Yes, on file"', () => {
  const f = R2_FOLLOWUPS('Delta Rubber');
  assert.deepEqual(f.map(x => x.id), ['certificate', 'size', 'terms']);
  assert.equal(f[0].question, 'Is the Udyam registration certificate for Delta Rubber on file?');
  assert.equal(f[1].question, 'What size does it show?');
  assert.equal(f[2].question, 'Are the credit terms in writing?');
  assert.deepEqual(f[1].onlyWhen, { certificate: 'yes' });
  assert.deepEqual(f[0].buttons.map(b => b.value), ['yes', 'no', 'not_registered', 'not_sure']);
  assert.deepEqual(f[2].buttons.map(b => b.value), ['none', 'up_to_15', 'up_to_30', 'up_to_45', 'over_45']);
  for (const q of f) assert.equal(q.question.split('?').length, 2);
});

test('refuses unknown answers and unknown suppliers', () => {
  assert.throws(() => r2Snapshot({ certificate: 'maybe' } as never, data, 'Delta Rubber', rate));
  assert.throws(() => r2Snapshot(ans(), data, 'Nobody Ltd', rate));
});
