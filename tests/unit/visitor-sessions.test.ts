import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeDb } from '../helpers/fake-db.ts';
import { sha256Hex } from '../../shared/sha256.ts';
import { hashCode, isSessionId, isValidCode, LIMITS } from '../../shared/visitor.ts';
import { startSession, guardFor, cleanupExpired } from '../../convex/visitorCore.ts';
import { recordAnswer, decideOn } from '../../convex/decisions.ts';

const NOW = Date.UTC(2026, 9, 21, 6, 45, 0); // 12:15 IST
const A = '3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70', B = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
let saved: string | undefined;
beforeEach(() => { saved = process.env.EDIT_PASSCODE; delete process.env.EDIT_PASSCODE; mock.timers.enable({ apis: ['Date'], now: NOW }); });
afterEach(() => { mock.timers.reset(); if (saved !== undefined) process.env.EDIT_PASSCODE = saved; });

test('sha256 matches the standard test vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('The quick brown fox jumps over the lazy dog'), 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  for (const text of ['₹2,50,00,000', 'a'.repeat(1000), 'émoji 🙂']) assert.equal(sha256Hex(text), createHash('sha256').update(text, 'utf8').digest('hex'), text);
});

test('session ids must be random UUIDs; codes are 4 to 20 characters', () => {
  assert.equal(isSessionId(A), true);
  for (const bad of ['', 'abc', 'not-a-uuid-at-all-not-a-uuid-at-all', A.toUpperCase().replace('4C6E', 'XXXX')]) assert.equal(isSessionId(bad), false, bad);
  assert.equal(isValidCode('1234'), true);
  assert.equal(isValidCode('a'.repeat(20)), true);
  for (const bad of ['', '123', 'a'.repeat(21)]) assert.equal(isValidCode(bad), false, bad);
});

test('the stored hash is salted by the session and is never the code itself', () => {
  const h = hashCode(A, '1234');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, hashCode(B, '1234'));
  assert.notEqual(h, sha256Hex('1234'));
  assert.equal(h, hashCode(A, '1234'));
});

test('start: creates a session with a hash and an expiry; refuses a reused id, a bad id or a bad code', async () => {
  const { db, rows } = fakeDb();
  assert.deepEqual(await startSession({ db }, { sessionId: A, code: '1234' }), { ok: true });
  const s = rows('visitorSession')[0];
  assert.equal(s.sessionId, A);
  assert.equal(s.codeHash, hashCode(A, '1234'));
  assert.equal(JSON.stringify(s).includes('1234"'), false);
  assert.equal(s.expiresAt, NOW + LIMITS.sessionDays * 86_400_000);
  assert.deepEqual(await startSession({ db }, { sessionId: A, code: '9999' }), { ok: false, reason: 'session_exists' });
  assert.deepEqual(await startSession({ db }, { sessionId: 'nope', code: '1234' }), { ok: false, reason: 'bad_session' });
  assert.deepEqual(await startSession({ db }, { sessionId: B, code: '12' }), { ok: false, reason: 'bad_code' });
});

test('start: a global cap on new sessions per India day', async () => {
  const { db } = fakeDb({ usageCounter: [{ key: 'sessions:2026-10-21', count: LIMITS.newSessionsPerDay }] });
  assert.deepEqual(await startSession({ db }, { sessionId: A, code: '1234' }), { ok: false, reason: 'busy' });
});

test('session guard: the right code passes, a wrong code is logged for that session only, and is never thrown', async () => {
  const { db, rows } = fakeDb();
  await startSession({ db }, { sessionId: A, code: '1234' });
  await startSession({ db }, { sessionId: B, code: '5678' });
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'ok');
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '0000' })).result, 'wrong');
  assert.deepEqual(rows('visitorAttempt').map(r => r.sessionId), [A]);
});

test('session guard: ten wrong codes lock only that session for the India hour', async () => {
  const { db } = fakeDb();
  await startSession({ db }, { sessionId: A, code: '1234' });
  await startSession({ db }, { sessionId: B, code: '5678' });
  for (let i = 0; i < 10; i++) await guardFor({ db }, { sessionId: A, passcode: '0000' });
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'locked');
  assert.equal((await guardFor({ db }, { sessionId: B, passcode: '5678' })).result, 'ok');
  mock.timers.setTime(NOW + 3_600_000);
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'ok');
});

test('session guard: unknown and expired sessions are refused; without a session the old passcode path still applies', async () => {
  const { db } = fakeDb();
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'no_session');
  await startSession({ db }, { sessionId: A, code: '1234' });
  mock.timers.setTime(NOW + LIMITS.sessionDays * 86_400_000 + 1);
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'expired');
  assert.equal((await guardFor({ db }, { passcode: 'anything' })).result, 'disabled'); // EDIT_PASSCODE unset
});

test('session guard: a cap on saves per session per hour, and a global cap on writes per day', async () => {
  const { db } = fakeDb({ usageCounter: [{ key: 'writes:2026-10-21', count: LIMITS.writesPerDay }] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'busy');
  const { db: db2 } = fakeDb();
  await startSession({ db: db2 }, { sessionId: B, code: '5678' });
  for (let i = 0; i < LIMITS.savesPerSessionPerHour; i++) assert.equal((await guardFor({ db: db2 }, { sessionId: B, passcode: '5678' })).result, 'ok');
  assert.equal((await guardFor({ db: db2 }, { sessionId: B, passcode: '5678' })).result, 'slow_down');
});

const flag = { flagKey: 'R1:X', ledger: 'X', ruleId: 'R1' };
const tables = { answerTable: 'answer', outcomeTable: 'outcome' } as const;
const loadFlag = (db: ReturnType<typeof fakeDb>['db']) => async (key: string) => db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', key)).unique();

test('two visitors answering the same gap never see or overwrite each other', async () => {
  const { db, rows } = fakeDb({ flag: [flag] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  await startSession({ db }, { sessionId: B, code: '5678' });
  await recordAnswer({ db }, { ...tables, sessionId: A, flagKey: 'R1:X', passcode: '1234', fields: { nature: 'loan' }, loadFlag: loadFlag(db) });
  await recordAnswer({ db }, { ...tables, sessionId: B, flagKey: 'R1:X', passcode: '5678', fields: { nature: 'goods_services' }, loadFlag: loadFlag(db) });
  const answers = rows('answer');
  assert.equal(answers.length, 2);
  assert.deepEqual(answers.map(r => [r.sessionId, r.nature]).sort(), [[A, 'loan'], [B, 'goods_services']].sort());
  const aAt = answers.find(r => r.sessionId === A)!.answeredAt as number;
  const r = await decideOn({ db }, { ...tables, sessionId: A, flagKey: 'R1:X', passcode: '1234', answeredAt: aAt, decision: 'approved', loadFlag: loadFlag(db), snapshotFor: async () => ({ kind: 'final' }), approvalBlock: () => null });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(rows('outcome').map(o => o.sessionId), [A]);
  const wrong = await decideOn({ db }, { ...tables, sessionId: B, flagKey: 'R1:X', passcode: '1234', answeredAt: aAt, decision: 'approved', loadFlag: loadFlag(db), snapshotFor: async () => ({ kind: 'final' }), approvalBlock: () => null });
  assert.deepEqual(wrong, { ok: false, reason: 'wrong' }); // B cannot sign with A's code
});

test('a visitor\'s rows never mix with the dev rows that have no session', async () => {
  const { db, rows } = fakeDb({ flag: [flag], answer: [{ flagKey: 'R1:X', nature: 'loan', answeredAt: 1 }] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  await recordAnswer({ db }, { ...tables, sessionId: A, flagKey: 'R1:X', passcode: '1234', fields: { nature: 'deposit' }, loadFlag: loadFlag(db) });
  assert.equal(rows('answer').length, 2);
  assert.equal(rows('answer').find(r => r.sessionId === undefined)!.nature, 'loan');
});

test('cleanup deletes expired sessions with their attempts, answers and decisions, and keeps live ones', async () => {
  const { db, rows } = fakeDb({ flag: [flag] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  await recordAnswer({ db }, { ...tables, sessionId: A, flagKey: 'R1:X', passcode: '1234', fields: { nature: 'loan' }, loadFlag: loadFlag(db) });
  await guardFor({ db }, { sessionId: A, passcode: '0000' });
  mock.timers.setTime(NOW + 3 * 86_400_000);
  await startSession({ db }, { sessionId: B, code: '5678' });
  mock.timers.setTime(NOW + LIMITS.sessionDays * 86_400_000 + 1);
  const r = await cleanupExpired({ db }, ['answer', 'outcome', 'msmeAnswer', 'msmeOutcome', 'termLoanAnswer', 'termLoanOutcome']);
  assert.deepEqual(r, { sessions: 1, more: false });
  assert.deepEqual(rows('visitorSession').map(s => s.sessionId), [B]);
  assert.equal(rows('answer').length, 0);
  assert.equal(rows('visitorAttempt').length, 0);
});

test('one visitor\'s call never touches other visitors\' attempt rows, however many there are', async () => {
  const stale = Array.from({ length: 20_000 }, (_, i) => ({ sessionId: `other-${i % 2000}`, at: NOW - 3 * 3_600_000 }));
  const { db, rows } = fakeDb({ visitorAttempt: stale });
  await startSession({ db }, { sessionId: A, code: '1234' });
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '1234' })).result, 'ok');
  assert.equal(rows('visitorAttempt').length, 20_000);
});

test('wrong codes count toward the daily write cap, so the attempt log cannot grow without limit', async () => {
  const { db, rows } = fakeDb({ usageCounter: [{ key: 'writes:2026-10-21', count: LIMITS.writesPerDay - 1 }] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '0000' })).result, 'wrong');
  assert.equal((await guardFor({ db }, { sessionId: A, passcode: '0000' })).result, 'busy');
  assert.equal(rows('visitorAttempt').length, 1);
});

test('cleanup works in bounded batches and says when more remain', async () => {
  const sessions = Array.from({ length: 150 }, (_, i) => ({ sessionId: `s-${i}`, codeHash: 'h', createdAt: 0, expiresAt: NOW - 1, saveHour: 0, saves: 0 }));
  const { db, rows } = fakeDb({ visitorSession: sessions });
  assert.deepEqual(await cleanupExpired({ db }, []), { sessions: 100, more: true });
  assert.deepEqual(await cleanupExpired({ db }, []), { sessions: 50, more: false });
  assert.equal(rows('visitorSession').length, 0);
});
