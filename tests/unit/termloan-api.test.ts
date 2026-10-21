import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import type { RuleData } from '../../shared/rules.ts';
import { r3Snapshot, r3ApprovalBlock } from '../../shared/r3-outcome.ts';

const text = await readFile('convex/termloan.ts', 'utf8');
const schema = await readFile('convex/schema.ts', 'utf8');
const data = (await loadSeedData('.')) as unknown as RuleData;
const LOAN = 'Meridian Co-operative Bank Term Loan';

test('R3 writes go through the shared record and decide helpers with the R3 tables and approval rule', () => {
  assert.match(text, /recordAnswer\(ctx, \{ answerTable: 'termLoanAnswer', outcomeTable: 'termLoanOutcome'/);
  const decide = text.slice(text.indexOf('export const decide'));
  assert.match(decide, /answeredAt: v\.number\(\)/);
  assert.match(decide, /decideOn\(ctx, \{[\s\S]*answerTable: 'termLoanAnswer', outcomeTable: 'termLoanOutcome'/);
  assert.match(decide, /approvalBlock: r3ApprovalBlock/);
  assert.match(decide, /r3Snapshot\(/);
  assert.doesNotMatch(decide, /snapshot:\s*v\./);
});

test('R3 approval: only a split confirmed by the schedule may be approved', () => {
  const kind = (documents: Parameters<typeof r3Snapshot>[0]['documents']) => r3ApprovalBlock(r3Snapshot({ documents }, data, LOAN, 1.2));
  assert.equal(kind('both'), null);
  assert.equal(kind('schedule_only'), null);
  for (const d of ['sanction_only', 'neither', 'not_sure'] as const) assert.equal(kind(d), 'answer_incomplete', d);
  assert.equal(kind(undefined), 'answer_incomplete');
});

test('R3 only, nothing written to the books, no AI, no secret', () => {
  assert.match(text, /flag\.ruleId === 'R3'/);
  assert.doesNotMatch(text, /ctx\.db\.(insert|replace|delete|patch)\(/);
  assert.doesNotMatch(text, /ANTHROPIC|fetch\(|apiKey|EDIT_PASSCODE/);
});

test('schema: the two R3 tables are added and carry no passcode', () => {
  for (const t of ['termLoanAnswer', 'termLoanOutcome']) assert.match(schema, new RegExp(`^  ${t}:defineTable`, 'm'));
});
