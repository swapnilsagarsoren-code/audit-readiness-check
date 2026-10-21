import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { debtEquity, covenantCheck, debtEquityAfterReclass } from '../../shared/ratios.ts';

const loaded = await loadSeedData('.');
const { covenantThresholds } = JSON.parse(await readFile('data/synthetic/company.json', 'utf8')) as { covenantThresholds: { debtEquity: number } };
const CR = 1_00_00_000_00; // one crore in paise

test('as booked: debt Rs 21.3 cr, equity Rs 15.2 cr, debt-equity 1.40', () => {
  const r = debtEquity(loaded.ledgers, loaded.entries);
  assert.equal(r.debt, 213 * CR / 10);
  assert.equal(r.equity, 152 * CR / 10);
  assert.equal(r.ratio.toFixed(2), '1.40');
});

test('Rajesh Mehta alone (Rs 2.5 cr) takes it to 1.57, above the covenant', () => {
  const after = debtEquityAfterReclass(loaded.ledgers, loaded.entries, 25 * CR / 10);
  assert.equal(after.debt, 238 * CR / 10);
  assert.equal(after.equity, 152 * CR / 10); // a reclass between liabilities never changes equity
  assert.equal(after.ratio.toFixed(2), '1.57');
  assert.equal(covenantCheck(after.ratio, covenantThresholds.debtEquity), 'breach');
});

test('Rajesh and the Trust (Rs 3.0 cr) give 1.60', () => {
  assert.equal(debtEquityAfterReclass(loaded.ledgers, loaded.entries, 3 * CR).ratio.toFixed(2), '1.60');
});

test('covenant: at the limit is within, above it is a breach, as booked is within', () => {
  assert.equal(covenantCheck(1.5, 1.5), 'within');
  assert.equal(covenantCheck(1.5000001, 1.5), 'breach');
  assert.equal(covenantCheck(debtEquity(loaded.ledgers, loaded.entries).ratio, covenantThresholds.debtEquity), 'within');
});

test('refuses a reclass that is zero, negative, fractional or larger than the creditors it comes from', () => {
  for (const bad of [0, -5, 1.5]) assert.throws(() => debtEquityAfterReclass(loaded.ledgers, loaded.entries, bad));
  assert.throws(() => debtEquityAfterReclass(loaded.ledgers, loaded.entries, 1_000 * CR));
});

test('refuses to compute when equity is zero or negative', () => {
  const ledgers = loaded.ledgers.map(l => l.tally_group === 'Capital Account' ? { ...l, opening_cr: 0 } : l.tally_group === 'Reserves & Surplus' ? { ...l, opening_cr: 0 } : l);
  assert.throws(() => debtEquity(ledgers, []));
});

test('covenant boundary with integer money: debt exactly 1.5 times equity is within, one paise more is a breach', () => {
  const equity = 20_00_00_000_00;
  assert.equal(covenantCheck(30_00_00_000_00 / equity, 1.5), 'within');
  assert.equal(covenantCheck((30_00_00_000_00 + 1) / equity, 1.5), 'breach');
});

import { currentRatio, currentRatioAfterSplit, covenantFloor } from '../../shared/ratios.ts';
const { covenantThresholds: thresholds } = JSON.parse(await readFile('data/synthetic/company.json', 'utf8')) as { covenantThresholds: { currentRatio: number } };

test('current ratio as booked: current assets Rs 37.0 cr over current liabilities Rs 30.1 cr is 1.23, within the 1.20 floor', () => {
  const r = currentRatio(loaded.ledgers, loaded.entries);
  assert.equal(r.assets, 370 * CR / 10);
  assert.equal(r.liabilities, 301 * CR / 10);
  assert.equal(r.ratio.toFixed(2), '1.23');
  assert.equal(thresholds.currentRatio, 1.2);
});

test('moving Rs 2.4 cr of the term loan into current liabilities takes the current ratio to 1.14, below the floor', () => {
  const after = currentRatioAfterSplit(loaded.ledgers, loaded.entries, 24 * CR / 10);
  assert.equal(after.assets, 370 * CR / 10);
  assert.equal(after.liabilities, 325 * CR / 10);
  assert.equal(after.ratio.toFixed(2), '1.14');
});

test('the current-ratio floor is a minimum: exactly at the floor is within, below it is a breach', () => {
  assert.equal(covenantFloor(1.2, 1.2), 'within');
  assert.equal(covenantFloor(1.2001, 1.2), 'within');
  assert.equal(covenantFloor(1.1999, 1.2), 'breach');
});

test('a split larger than the term loan, or not whole paise, is refused', () => {
  assert.throws(() => currentRatioAfterSplit(loaded.ledgers, loaded.entries, 0));
  assert.throws(() => currentRatioAfterSplit(loaded.ledgers, loaded.entries, 1.5));
  assert.throws(() => currentRatioAfterSplit(loaded.ledgers, loaded.entries, 1_000 * CR));
});
