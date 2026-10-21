import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { decisionSnapshot, r1ApprovalBlock } from '../../shared/decision.ts';

const text = await readFile('convex/answers.ts', 'utf8');
const schema = await readFile('convex/schema.ts', 'utf8');
const { ledgers, entries } = await loadSeedData('.');

test('R1 writes go through the shared record and decide helpers; the browser sends only the decision and the answer it saw', () => {
  assert.match(text, /export const record = mutation\(/);
  assert.match(text, /recordAnswer\(ctx, \{ answerTable: 'answer', outcomeTable: 'outcome'/);
  const decide = text.slice(text.indexOf('export const decide'));
  assert.match(decide, /args: \{ flagKey: v\.string\(\), passcode: v\.string\(\), answeredAt: v\.number\(\), decision:/);
  assert.match(decide, /decideOn\(ctx, \{/);
  assert.match(decide, /approvalBlock: r1ApprovalBlock/);
  assert.doesNotMatch(decide, /snapshot:\s*v\./);
});

test('R1 only, nothing written to the books, no AI, no secret', () => {
  assert.match(text, /flag\.ruleId === 'R1'/);
  assert.doesNotMatch(text, /ctx\.db\.(insert|replace|delete|patch)\(/);
  assert.doesNotMatch(text, /ANTHROPIC|fetch\(|apiKey|EDIT_PASSCODE/);
});

test('R1 approval: an unanswered or escalated outcome cannot be approved; a reclass and a no-change can', () => {
  const rajesh = { ledger: 'Rajesh Mehta', amount: 2_50_00_000_00, related: true };
  const snap = (answer: Parameters<typeof decisionSnapshot>[0]) => decisionSnapshot(answer, rajesh, ledgers, entries, 1.5);
  assert.equal(r1ApprovalBlock(snap({ nature: 'loan' })), 'answer_incomplete');
  assert.equal(r1ApprovalBlock(snap({ nature: 'deposit' })), 'answer_incomplete');
  assert.equal(r1ApprovalBlock(snap({ nature: 'goods_services' })), null);
  assert.equal(r1ApprovalBlock(snap({ nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes' })), null);
});

test('schema: answer, outcome and editAttempt are added, and the passcode is never stored', () => {
  for (const t of ['answer', 'outcome', 'editAttempt']) assert.match(schema, new RegExp(`^  ${t}:defineTable`, 'm'));
  assert.doesNotMatch(schema, /passcode/i);
});
