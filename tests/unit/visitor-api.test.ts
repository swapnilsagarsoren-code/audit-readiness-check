import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p: string) => readFile(p, 'utf8');

test('visitor status never returns the code hash; start and cleanup use the shared core', async () => {
  const text = await read('convex/visitor.ts');
  const status = text.slice(text.indexOf('export const status'), text.indexOf('export const cleanup'));
  assert.doesNotMatch(status, /codeHash|return s\b|\.\.\.s\b/);
  assert.match(text, /export const start = mutation\(\{ args: \{ sessionId: v\.string\(\), code: v\.string\(\) \}/);
  assert.match(text, /export const cleanup = internalMutation\(/);
  for (const t of ['answer', 'outcome', 'msmeAnswer', 'msmeOutcome', 'termLoanAnswer', 'termLoanOutcome']) assert.match(text, new RegExp(`'${t}'`), t);
});

for (const file of ['answers', 'msme', 'termloan']) test(`${file}: detail, record and decide accept an optional sessionId and pass it through`, async () => {
  const text = await read(`convex/${file}.ts`);
  for (const name of ['detail', 'record', 'decide']) {
    const start = text.indexOf(`export const ${name}`);
    assert.match(text.slice(start, text.indexOf('handler', start)), /sessionId: v\.optional\(v\.string\(\)\)/, name);
  }
  assert.match(text, /recordAnswer\(ctx, \{[^}]*\bsessionId\b/);
  assert.match(text.slice(text.indexOf('export const decide')), /decideOn\(ctx, \{[^}]*\bsessionId\b/);
  assert.equal((text.match(/rowFor\(ctx, '\w+', sessionId, flagKey\)/g) ?? []).length, 2);
  assert.doesNotMatch(text, /by_flag'/);
});

test('crons schedules visitor cleanup daily', async () => {
  const text = await read('convex/crons.ts');
  assert.match(text, /makeFunctionReference<'mutation'>\('visitor:cleanup'\)/);
  assert.match(text, /crons\.daily\(/);
});

test('schema keys every answer and outcome table by session and flag', async () => {
  const schema = await read('convex/schema.ts');
  assert.doesNotMatch(schema, /'by_flag'/);
  for (const t of ['answer', 'outcome', 'msmeAnswer', 'msmeOutcome', 'termLoanAnswer', 'termLoanOutcome']) assert.match(schema, new RegExp(`^  ${t}:defineTable\\(\\w+\\)\\.index\\('by_session_flag',\\['sessionId','flagKey'\\]\\)`, 'm'), t);
});
