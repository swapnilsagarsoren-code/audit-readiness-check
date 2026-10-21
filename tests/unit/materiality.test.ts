import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { trialBalance } from '../../shared/accounting.ts';
import { materiality, type MaterialityInputs } from '../../shared/materiality.ts';

const company = JSON.parse(await readFile('data/synthetic/company.json', 'utf8')) as { materialityInputs: MaterialityInputs };
const inputs = company.materialityInputs;

test('overall is the lower of 1% of revenue and 5% of PBT; flag line 50%; hide below 5%', () => {
  const m = materiality({ revenue: 150_00_00_000_00, pbt: 9_00_00_000_00 }, inputs);
  assert.equal(m.overall, 45_00_000_00);
  assert.equal(m.flagLine, 22_50_000_00);
  assert.equal(m.hideBelow, 2_25_000_00);
  assert.equal(m.basis, 'pbt');
});

test('revenue basis wins when it is the lower figure', () => {
  const m = materiality({ revenue: 10_00_00_000_00, pbt: 9_00_00_000_00 }, inputs);
  assert.equal(m.overall, 10_00_000_00);
  assert.equal(m.basis, 'revenue');
});

test('integer paise only: fractions round down', () => {
  const m = materiality({ revenue: 999_99, pbt: 999_99 }, inputs);
  for (const v of [m.overall, m.flagLine, m.hideBelow]) assert.ok(Number.isSafeInteger(v));
});

test('refuses a loss, zero revenue or unusable inputs', () => {
  assert.throws(() => materiality({ revenue: 100, pbt: 0 }, inputs));
  assert.throws(() => materiality({ revenue: 100, pbt: -5 }, inputs));
  assert.throws(() => materiality({ revenue: 0, pbt: 5 }, inputs));
  assert.throws(() => materiality({ revenue: 100, pbt: 5 }, { ...inputs, flagBasisPoints: 0 }));
  assert.throws(() => materiality({ revenue: 100.5, pbt: 5 }, inputs));
});

test('synthetic books: materiality from the trial balance', async () => {
  const data = await loadSeedData('.');
  const tb = trialBalance(data.ledgers, data.entries);
  const m = materiality({ revenue: tb.revenue, pbt: tb.pbt }, inputs);
  // The spec pins revenue at Rs 150 cr and PBT at Rs 9 cr as booked.
  assert.equal(tb.revenue, 150_00_00_000_00);
  assert.equal(tb.pbt, 9_00_00_000_00);
  assert.equal(m.overall, 45_00_000_00);
  assert.equal(m.flagLine, 22_50_000_00);
});

test('refuses a hide line above the flag line and figures too large for whole-paise arithmetic', () => {
  assert.throws(() => materiality({ revenue: 100, pbt: 5 }, { ...inputs, trivialBasisPoints: 6000 }));
  assert.throws(() => materiality({ revenue: 9_000_000_000_000_000, pbt: 9_000_000_000_000_000 }, inputs));
});
