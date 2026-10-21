import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { r1Flags, r2Flags, r3Flags, type RuleData } from '../../shared/rules.ts';
import type { Entry, Ledger, Supplier } from '../../shared/accounting.ts';

const data = (await loadSeedData('.')) as unknown as RuleData;

const ledgers: Ledger[] = [
  { ledger_name: 'Bank', tally_group: 'Bank Accounts', opening_dr: 0, opening_cr: 0 },
  { ledger_name: 'Acme Supplies', tally_group: 'Sundry Creditors', opening_dr: 0, opening_cr: 0 },
  { ledger_name: 'Bolt Works', tally_group: 'Sundry Creditors', opening_dr: 0, opening_cr: 0 },
];
const e = (o: Partial<Entry> & { voucher_no: string; ledger: string }): Entry =>
  ({ date: '2025-06-01T00:00:00+05:30', voucher_type: 'Receipt', dr: 0, cr: 0, party: o.ledger, narration: 'x', entered_by: 'a', entered_at: '2025-06-01T10:00:00+05:30', ...o });
const company = { start: '2025-04-01T00:00:00+05:30', end: '2026-03-31T23:59:59+05:30', directors: ['Dee'], relatives: [{ name: 'Rel' }], shareholders: ['Sam'] };
const mk = (entries: Entry[], suppliers: Supplier[] = []): RuleData => ({ company, ledgers, entries, suppliers } as unknown as RuleData);

test('R1 on the synthetic books: exactly the four planted cases, none of the decoys', () => {
  const flags = r1Flags(data);
  assert.deepEqual(flags.map(f => f.party).sort(), ['Anita Mehta', 'Mehta Family Trust', 'Rajesh Mehta', 'Sharma Traders']);
  const by = Object.fromEntries(flags.map(f => [f.party, f]));
  assert.equal(by['Rajesh Mehta'].amount, 2_50_00_000_00);
  assert.equal(by['Anita Mehta'].amount, 60_00_000_00);
  assert.equal(by['Mehta Family Trust'].amount, 50_00_000_00);
  assert.equal(by['Sharma Traders'].amount, 10_00_000_00);
  assert.equal(by['Rajesh Mehta'].entryRefs.length, 3);
});

test('R1 related-party marker comes from the company lists only', () => {
  const by = Object.fromEntries(r1Flags(data).map(f => [f.party, f.related]));
  assert.deepEqual(by, { 'Rajesh Mehta': true, 'Anita Mehta': true, 'Mehta Family Trust': true, 'Sharma Traders': false });
});

test('R1 needs a round bank receipt; a purchase credit or an odd amount does not flag', () => {
  const purchase = [e({ voucher_no: 'V1', ledger: 'Acme Supplies', cr: 5_00_000_00, voucher_type: 'Purchase' })];
  assert.equal(r1Flags(mk(purchase)).length, 0);
  const odd = [e({ voucher_no: 'V2', ledger: 'Bank', dr: 5_00_123_00 }), e({ voucher_no: 'V2', ledger: 'Acme Supplies', cr: 5_00_123_00 })];
  assert.equal(r1Flags(mk(odd)).length, 0);
  const round = [e({ voucher_no: 'V3', ledger: 'Bank', dr: 5_00_000_00 }), e({ voucher_no: 'V3', ledger: 'Acme Supplies', cr: 5_00_000_00 })];
  assert.equal(r1Flags(mk(round)).length, 1);
});

test('R1 also flags interest debited to the creditor ledger', () => {
  const interest = [e({ voucher_no: 'V4', ledger: 'Bolt Works', dr: 12_345_00, voucher_type: 'Journal', narration: 'Interest on balance' })];
  const flags = r1Flags(mk(interest));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].amount, 12_345_00);
});

test('R2 on the synthetic books: Delta Rubber, Kumar Packaging and the Bharat Fasteners late bills; decoys clear', () => {
  const flags = r2Flags(data);
  const parties = flags.map(f => f.party).sort();
  assert.ok(parties.includes('Delta Rubber') && parties.includes('Kumar Packaging') && parties.includes('Bharat Fasteners'), parties.join());
  assert.ok(!parties.includes('Sai Precision Springs') && !parties.includes('Vega Castings'));
  const by = Object.fromEntries(flags.map(f => [f.party, f]));
  assert.equal(by['Delta Rubber'].amount, 8_00_000_00);
  assert.equal(by['Delta Rubber'].statusKnown, true);
  assert.equal(by['Kumar Packaging'].amount, 1_90_000_00);
  assert.equal(by['Kumar Packaging'].statusKnown, false);
  assert.equal(by['Bharat Fasteners'].amount, 5_60_000_00);
  assert.deepEqual(by['Bharat Fasteners'].entryRefs.map(r => r.voucher_no), ['NF-00012']);
});

test('R2 uses written terms capped at 45 days, else 15 days from the bill date; Medium and unregistered are never flagged', () => {
  const bill = (v: string, who: string, date: string) => e({ voucher_no: v, ledger: who, cr: 1_00_000_00, voucher_type: 'Purchase', date });
  const pay = (v: string, who: string, date: string, ref: string) => [
    e({ voucher_no: v, ledger: who, dr: 1_00_000_00, voucher_type: 'Payment', date, narration: `Payment against invoice ${ref}` }),
    e({ voucher_no: v, ledger: 'Bank', cr: 1_00_000_00, voucher_type: 'Payment', date, narration: `Payment against invoice ${ref}` }),
  ];
  const sup = (name: string, msme: string, days: number | null): Supplier => ({ supplier: name, msme_status: msme, written_credit_days: days });
  const entries = [
    bill('B1', 'Acme Supplies', '2025-06-01T00:00:00+05:30'), ...pay('P1', 'Acme Supplies', '2025-07-16T00:00:00+05:30', 'B1'), // 45 days, terms 45: on time
    bill('B2', 'Bolt Works', '2025-06-01T00:00:00+05:30'), ...pay('P2', 'Bolt Works', '2025-06-17T00:00:00+05:30', 'B2'), // 16 days, no terms: late
  ];
  const ok = r2Flags(mk(entries, [sup('Acme Supplies', 'Micro', 45), sup('Bolt Works', 'Medium', null)]));
  assert.equal(ok.length, 0);
  const late = r2Flags(mk(entries, [sup('Acme Supplies', 'Micro', 90), sup('Bolt Works', 'Small', null)]));
  assert.deepEqual(late.map(f => f.party), ['Bolt Works']); // 90 days written is capped to 45; Acme paid on day 45
});

test('R2 treats a bill unpaid at year end as late once past the allowed days', () => {
  const entries = [e({ voucher_no: 'B1', ledger: 'Acme Supplies', cr: 3_00_000_00, voucher_type: 'Purchase', date: '2026-02-01T00:00:00+05:30' })];
  const flags = r2Flags(mk(entries, [{ supplier: 'Acme Supplies', msme_status: 'Micro', written_credit_days: null }]));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].amount, 3_00_000_00);
});

test('R3 on the synthetic books: only the Meridian term loan; the WCDL and cash credit are not flagged', () => {
  const flags = r3Flags(data);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].party, 'Meridian Co-operative Bank');
  assert.equal(flags[0].ledger, 'Meridian Co-operative Bank Term Loan');
  assert.equal(flags[0].amount, 9_60_00_000_00); // closing balance, not the amount due within 12 months
});

test('R3 stays quiet once a current-maturities ledger exists', () => {
  const withSplit: RuleData = { ...data, ledgers: [...data.ledgers, { ledger_name: 'Current maturities of long-term borrowings', tally_group: 'Current Liabilities', opening_dr: 0, opening_cr: 0 }] };
  assert.equal(r3Flags(withSplit).length, 0);
});

test('R3: a split ledger naming another lender does not hide this loan; a generic one clears only a single term loan', () => {
  const extra: Ledger = { ledger_name: 'Harbour Bank Term-Loan', tally_group: 'Secured Loans', opening_dr: 0, opening_cr: 5_00_00_000_00 };
  const named: RuleData = { ...data, ledgers: [...data.ledgers, extra, { ledger_name: 'Current maturities - Harbour Bank', tally_group: 'Current Liabilities', opening_dr: 0, opening_cr: 0 }] };
  assert.deepEqual(r3Flags(named).map(f => f.ledger), ['Meridian Co-operative Bank Term Loan']);
  const generic: RuleData = { ...data, ledgers: [...data.ledgers, extra, { ledger_name: 'Current maturities of long-term borrowings', tally_group: 'Current Liabilities', opening_dr: 0, opening_cr: 0 }] };
  assert.equal(r3Flags(generic).length, 2);
});

test('R3 matches Term-Loan and TL spellings', () => {
  const variants = ['Alpha TL', 'Beta Term-Loan', 'Gamma Termloan'].map(n => ({ ledger_name: n, tally_group: 'Secured Loans', opening_dr: 0, opening_cr: 1_00_00_000_00 }));
  assert.equal(r3Flags({ ...data, ledgers: variants, entries: [] }).length, 3);
});

test('R2: zero written days means the 15-day default; a narration with an earlier token still finds the right bill', () => {
  const bill = e({ voucher_no: 'B1', ledger: 'Bolt Works', cr: 1_00_000_00, voucher_type: 'Purchase', date: '2025-06-01T00:00:00+05:30' });
  const pay = e({ voucher_no: 'P1', ledger: 'Bolt Works', dr: 1_00_000_00, voucher_type: 'Payment', date: '2025-06-20T00:00:00+05:30', narration: 'Paid FY25 invoice B1' });
  const flags = r2Flags(mk([bill, pay], [{ supplier: 'Bolt Works', msme_status: 'Micro', written_credit_days: 0 }]));
  assert.equal(flags.length, 1); // 19 days > 15
  const ok = r2Flags(mk([bill, pay], [{ supplier: 'Bolt Works', msme_status: 'Micro', written_credit_days: 30 }]));
  assert.equal(ok.length, 0);
});

test('R1 related marker ignores case and spacing', () => {
  const ent = [e({ voucher_no: 'V9', ledger: 'Bank', dr: 5_00_000_00 }), e({ voucher_no: 'V9', ledger: 'Acme Supplies', cr: 5_00_000_00 })];
  const d = mk(ent); d.company.directors = ['  acme   SUPPLIES '];
  assert.equal(r1Flags(d)[0].related, true);
});
