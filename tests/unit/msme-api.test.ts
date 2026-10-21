import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import type { RuleData } from '../../shared/rules.ts';
import { r2Snapshot, r2ApprovalBlock } from '../../shared/r2-outcome.ts';

const text = await readFile('convex/msme.ts', 'utf8');
const rbiCore = await readFile('convex/rbiCore.ts', 'utf8');
const schema = await readFile('convex/schema.ts', 'utf8');
const data = (await loadSeedData('.')) as unknown as RuleData;
const rate = { value: 5.75, date: '2026-10-20', sourceUrl: 'https://www.rbi.org.in/' };

test('R2 writes go through the shared record and decide helpers with the R2 tables and approval rule', () => {
  assert.match(text, /recordAnswer\(ctx, \{ answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome'/);
  const decide = text.slice(text.indexOf('export const decide'));
  assert.match(decide, /answeredAt: v\.number\(\)/);
  assert.match(decide, /decideOn\(ctx, \{[\s\S]*answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome'/);
  assert.match(decide, /approvalBlock: r2ApprovalBlock/);
  assert.match(decide, /r2Snapshot\(/);
  assert.doesNotMatch(decide, /snapshot:\s*v\./);
});

test('R2 approval: unanswered, escalated and unpriced interest cannot be approved; priced interest and no-interest outcomes can', () => {
  const sn = (a: Parameters<typeof r2Snapshot>[0], r: typeof rate | null = rate) => r2Snapshot(a, data, 'Delta Rubber', r);
  assert.equal(r2ApprovalBlock(sn({ certificate: 'yes' })), 'answer_incomplete');
  assert.equal(r2ApprovalBlock(sn({ certificate: 'no', terms: 'none' })), 'answer_incomplete');
  assert.equal(r2ApprovalBlock(sn({ certificate: 'yes', size: 'small', terms: 'none' }, null)), 'not_priced');
  assert.equal(r2ApprovalBlock(sn({ certificate: 'yes', size: 'small', terms: 'none' })), null);
  assert.equal(r2ApprovalBlock(sn({ certificate: 'yes', size: 'medium', terms: 'none' })), null);
});

test('R2 only, nothing written to the books, no AI, no secret; the rate comes from the stored RBI row', () => {
  assert.match(text, /flag\.ruleId === 'R2'/);
  assert.doesNotMatch(text, /ctx\.db\.(insert|replace|delete|patch)\(/);
  assert.doesNotMatch(text, /ANTHROPIC|fetch\(|apiKey|EDIT_PASSCODE/);
  assert.match(text, /latestRate\(ctx\)/);
  assert.match(rbiCore, /query\('rbiBankRate'\)/);
});

test('schema: the two R2 tables are added and carry no passcode', () => {
  for (const t of ['msmeAnswer', 'msmeOutcome']) assert.match(schema, new RegExp(`^  ${t}:defineTable`, 'm'));
});
