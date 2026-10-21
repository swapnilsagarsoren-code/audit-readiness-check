import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { msmeLateBills, type RuleData } from '../../shared/rules.ts';
import { indicativeInterest, supplierInterest } from '../../shared/msme-interest.ts';

const data = (await loadSeedData('.')) as unknown as RuleData;
const supplier = (name: string) => data.suppliers.find(s => s.supplier === name)!;

test('late bills for Delta Rubber: one bill, paid 1 July 2025, 15 days after the 15 allowed', () => {
  const r = msmeLateBills(data, supplier('Delta Rubber'));
  assert.equal(r.allowed, 15);
  assert.equal(r.bills.length, 1);
  assert.equal(r.bills[0].amount, 8_00_000_00);
  assert.equal(r.bills[0].paidDate, '2025-07-01');
  assert.equal(r.bills[0].billDate, '2025-06-01');
  assert.equal(r.bills[0].daysLate, 15);
});

test('late bills for Bharat Fasteners: written 45 days, paid on day 68, so 23 days late; only the late bill is listed', () => {
  const r = msmeLateBills(data, supplier('Bharat Fasteners'));
  assert.equal(r.allowed, 45);
  assert.deepEqual(r.bills.map(b => [b.voucher_no, b.daysLate]), [['NF-00012', 23]]);
});

test('an unpaid bill is late to the year end (Kumar Packaging: bill 7 Feb 2026, no payment, 52 days to 31 March, 15 allowed)', () => {
  const r = msmeLateBills(data, supplier('Kumar Packaging'));
  assert.equal(r.bills.length, 1);
  assert.equal(r.bills[0].paidDate, null);
  assert.equal(r.bills[0].daysLate, 52 - 15);
});

test('a supplier paid on time has no late bills; status is the caller\'s job (a Medium supplier is never flagged by r2Flags)', () => {
  assert.equal(msmeLateBills(data, supplier('Sai Precision Springs')).bills.length, 0);
  assert.equal(supplier('Vega Castings').msme_status, 'Medium');
});

test('indicative interest: three times the Bank Rate, 30-day months compounded, rest simple on the annual rate', () => {
  // Rs 8,00,000 for 15 days at 3 x 5.75% = 17.25% a year: 800000 x 0.1725 x 15 / 365 = Rs 5,671.23
  assert.equal(indicativeInterest({ principalPaise: 8_00_000_00, daysLate: 15, bankRatePercent: 5.75 }), 567_123);
  // 45 days = one whole month compounded at 17.25/12 % plus 15 days simple on the grown amount
  const month = 8_00_000_00 * (0.1725 / 12);
  const expected = Math.round(month + (8_00_000_00 + month) * 0.1725 * 15 / 365);
  assert.equal(indicativeInterest({ principalPaise: 8_00_000_00, daysLate: 45, bankRatePercent: 5.75 }), expected);
  assert.equal(indicativeInterest({ principalPaise: 8_00_000_00, daysLate: 0, bankRatePercent: 5.75 }), 0);
});

test('refuses unusable inputs rather than guessing', () => {
  for (const bad of [{ principalPaise: 0, daysLate: 1, bankRatePercent: 5.75 }, { principalPaise: 1.5, daysLate: 1, bankRatePercent: 5.75 }, { principalPaise: 100, daysLate: -1, bankRatePercent: 5.75 },
    { principalPaise: 100, daysLate: 1, bankRatePercent: 0 }, { principalPaise: 100, daysLate: 1, bankRatePercent: 30 }, { principalPaise: 100, daysLate: 1.5, bankRatePercent: 5.75 }]) {
    assert.throws(() => indicativeInterest(bad), JSON.stringify(bad));
  }
});

test('supplier interest sums each late bill; Delta Rubber is Rs 5,671.23 at a 5.75% Bank Rate', () => {
  const r = supplierInterest(msmeLateBills(data, supplier('Delta Rubber')).bills, 5.75);
  assert.equal(r.principal, 8_00_000_00);
  assert.equal(r.interest, 567_123);
  assert.equal(r.bills.length, 1);
});

test('Bharat Fasteners: Rs 5.6 lakh for 23 days at 17.25% is Rs 6,087.12', () => {
  const r = supplierInterest(msmeLateBills(data, supplier('Bharat Fasteners')).bills, 5.75);
  assert.equal(r.interest, Math.round(5_60_000_00 * 0.1725 * 23 / 365));
});
