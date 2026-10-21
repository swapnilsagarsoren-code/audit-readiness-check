import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile('convex/rates.ts', 'utf8');
const script = await readFile('scripts/fetch-rbi-rate.mts', 'utf8');

test('saving the rate is internal and dev-guarded, from rbi.org.in only; reading it is public and returns the rate, date and source only', () => {
  assert.match(api, /export const save = internalMutation\(/);
  assert.match(api, /assertSeedAllowed\(process\.env\)/);
  assert.match(api, /rbi\\\.org\\\.in/);
  assert.match(api, /date !== istDate\(Date\.now\(\)\)/);
  assert.match(api, /export const current = query\(/);
});

test('the fetch script reads only rbi.org.in, refuses redirects and other deployments, times out, and holds no secret', () => {
  assert.match(script, /https:\/\/www\.rbi\.org\.in\//);
  assert.match(script, /redirect: 'manual'/);
  assert.match(script, /AbortSignal\.timeout/);
  assert.match(script, /DEPLOYMENT = 'your-dev-deployment'/);
  assert.doesNotMatch(script, /ANTHROPIC|passcode|apiKey/i);
});
