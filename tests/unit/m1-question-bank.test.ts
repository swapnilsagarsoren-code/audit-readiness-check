import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFlagInput, type RawFlag } from '../../shared/flag-input.ts';
import { verifyReply, type VerifyReason } from '../../shared/verify.ts';

// The labelled question bank: every checker change must keep every label right.
// Stored items come from live runs (labels by the builder; Swapnil spot-checks); S items were written
// by an agent that never saw the checker.
type BankItem = {
  id: string; source: string; question: string; expect: 'pass' | 'reject'; reason?: VerifyReason;
  category: string; why: string; flagKey?: string; flagRef?: string; knownNames?: string[];
};
const bank = JSON.parse(readFileSync('tests/fixtures/m1-question-bank.json', 'utf8')) as {
  flags: Record<string, { flag: RawFlag; noSuppliedFigures?: boolean }>; items: BankItem[];
};
const flags = new Map<string, RawFlag>(['m1-flags', 'm1-adversarial', 'm1-heldout-v1-retired', 'm1-heldout-v2-retired', 'm1-heldout-v3-retired', 'm1-heldout-v4-retired', 'm1-heldout']
  .flatMap(name => JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8')) as RawFlag[])
  .map(flag => [flag.flagKey, flag]));

function judge(item: BankItem) {
  const inline = item.flagRef ? bank.flags[item.flagRef] : undefined;
  const flag = inline?.flag ?? flags.get(item.flagKey ?? '');
  if (!flag) throw new Error(`bank item ${item.id} has no flag`);
  const input = buildFlagInput(flag);
  // The independent examples were written for a flag with no code-supplied count or total.
  if (inline?.noSuppliedFigures) { delete input.entryCount; delete input.totalAmount; }
  // Wording is under test, so every reply carries one valid quote and one approved evidence id.
  const reply = { question: item.question, evidenceIds: [input.evidence[0].id], quotes: [{ field: 'ledger', text: input.ledger }] };
  return verifyReply(JSON.stringify(reply), input, item.knownNames ?? []);
}

test('the question bank is well formed', () => {
  const ids = new Set<string>();
  for (const item of bank.items) {
    assert.ok(!ids.has(item.id), item.id); ids.add(item.id);
    assert.ok(item.expect === 'pass' || (item.expect === 'reject' && item.reason), item.id);
  }
  assert.ok(bank.items.length >= 300);
});

test('every labelled question in the bank gets the right verdict', () => {
  const wrong: string[] = [];
  for (const item of bank.items) {
    const result = judge(item);
    const ok = item.expect === 'pass' ? result.status === 'verified'
      : result.status === 'rejected' && result.reasons.includes(item.reason!);
    if (!ok) wrong.push(`${item.id} [${item.category}] expected ${item.expect}${item.reason ? ` ${item.reason}` : ''}, got ${result.status} ${result.reasons.join(',')} | ${item.question}`);
  }
  assert.deepEqual(wrong, []);
});
