import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { buildFlagList, flagKey, RULE_SET_VERSION } from '../../shared/flag-list.ts';
import type { RuleData } from '../../shared/rules.ts';
import type { MaterialityInputs } from '../../shared/materiality.ts';

const loaded = await loadSeedData('.');
type Company = RuleData['company'] & { materialityInputs: MaterialityInputs };
const data = { ...loaded, company: loaded.company as Company } as unknown as RuleData & { company: Company };

test('the list for the synthetic books: seven rows, materiality figures attached, hidden row dropped', () => {
  const list = buildFlagList(data);
  assert.equal(list.materiality.overall, 45_00_000_00);
  assert.equal(list.flags.length, 7);
  assert.deepEqual(list.flags.map(f => f.flagKey), [
    'R3:Meridian Co-operative Bank Term Loan', 'R1:Rajesh Mehta', 'R1:Anita Mehta', 'R1:Mehta Family Trust',
    'R1:Sharma Traders', 'R2:Delta Rubber', 'R2:Bharat Fasteners',
  ]);
  assert.equal(list.flags[0].band, 'flagged');
  assert.equal(list.flags[6].band, 'below');
});

test('flag keys are stable and unique', () => {
  assert.equal(flagKey('R1', 'Rajesh Mehta'), 'R1:Rajesh Mehta');
  const keys = buildFlagList(data).flags.map(f => f.flagKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('every stored field is plain data: whole-paise integers, no entry text, refs only', () => {
  for (const f of buildFlagList(data).flags) {
    assert.ok(Number.isSafeInteger(f.amount) && f.amount > 0);
    assert.ok(f.entryRefs.length > 0);
    for (const r of f.entryRefs) assert.deepEqual(Object.keys(r).sort(), ['ledger', 'voucher_no']);
    assert.equal(f.ruleVersion, RULE_SET_VERSION);
  }
});

test('refuses to build when the company has no usable materiality inputs', () => {
  const bad = { ...data, company: { ...data.company, materialityInputs: { ...data.company.materialityInputs, flagBasisPoints: 0 } } };
  assert.throws(() => buildFlagList(bad));
});

test('the flag table is additive: the schema declares it, and the public read exposes no model or secret fields', async () => {
  const schema = await readFile('convex/schema.ts', 'utf8');
  assert.match(schema, /^  flag:defineTable/m);
  const api = await readFile('convex/flags.ts', 'utf8');
  assert.match(api, /export const list=query\(/);
  assert.match(api, /export const refresh=internalMutation\(/);
  assert.match(api, /assertSeedAllowed\(process\.env\)/);
  assert.doesNotMatch(api, /ANTHROPIC|apiKey|fetch\(/);
});
