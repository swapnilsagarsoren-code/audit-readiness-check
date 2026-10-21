import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { trialBalance } from '../../shared/accounting.ts';
import { materiality, type MaterialityInputs } from '../../shared/materiality.ts';
import { r1Flags, r2Flags, r3Flags, type RuleData, type RuleFlag } from '../../shared/rules.ts';
import { rankFlags } from '../../shared/rank.ts';

const inputs = (JSON.parse(await readFile('data/synthetic/company.json', 'utf8')) as { materialityInputs: MaterialityInputs }).materialityInputs;
const m = materiality({ revenue: 150_00_00_000_00, pbt: 9_00_00_000_00 }, inputs); // flag 22.5 L, hide 2.25 L
const f = (party: string, amount: number, ruleId: RuleFlag['ruleId'] = 'R1'): RuleFlag =>
  ({ ruleId, party, ledger: party, amount, entryRefs: [], related: false, statusKnown: true, note: '' });

test('bands: at the flag line is flagged, just under is below, at 5% is shown, just under 5% is hidden', () => {
  const ranked = rankFlags([f('a', m.flagLine), f('b', m.flagLine - 1), f('c', m.hideBelow), f('d', m.hideBelow - 1)], m);
  assert.deepEqual(ranked.map(r => [r.party, r.band]), [['a', 'flagged'], ['b', 'below'], ['c', 'below']]);
});

test('sorted by amount, largest first; ties by rule then party; percent of the flag line is whole-number rounded down', () => {
  const ranked = rankFlags([f('z', 50_00_000_00, 'R2'), f('y', 50_00_000_00, 'R1'), f('x', 50_00_000_00, 'R1'), f('w', 45_00_000_00)], m);
  assert.deepEqual(ranked.map(r => r.party), ['x', 'y', 'z', 'w']);
  assert.equal(ranked[0].percentOfFlagLine, 222); // 50 L / 22.5 L
  assert.equal(ranked[3].percentOfFlagLine, 200);
});

test('input is not changed and the same input gives the same order', () => {
  const input = [f('b', 30_00_000_00), f('a', 40_00_000_00)];
  const copy = structuredClone(input);
  assert.deepEqual(rankFlags(input, m), rankFlags(copy, m));
  assert.deepEqual(input, copy);
});

test('synthetic books: ranked list is the expected order and bands', async () => {
  const data = (await loadSeedData('.')) as unknown as RuleData;
  const tb = trialBalance(data.ledgers, data.entries);
  const ranked = rankFlags([...r1Flags(data), ...r2Flags(data), ...r3Flags(data)], materiality({ revenue: tb.revenue, pbt: tb.pbt }, inputs));
  assert.deepEqual(ranked.map(r => [r.party, r.band]), [
    ['Meridian Co-operative Bank', 'flagged'],
    ['Rajesh Mehta', 'flagged'],
    ['Anita Mehta', 'flagged'],
    ['Mehta Family Trust', 'flagged'],
    ['Sharma Traders', 'below'],
    ['Delta Rubber', 'below'],
    ['Bharat Fasteners', 'below'],
  ]); // Kumar Packaging (Rs 1.9 lakh) is under 5% of overall and hidden
});
