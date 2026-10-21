import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb } from '../helpers/fake-db.ts';
import { guard } from '../../convex/guard.ts';
import { recordAnswer, decideOn } from '../../convex/decisions.ts';

const NOW = Date.UTC(2026, 9, 21, 6, 45, 0); // 12:15 IST
let saved: string | undefined;
beforeEach(() => { saved = process.env.EDIT_PASSCODE; process.env.EDIT_PASSCODE = 's3cret'; mock.timers.enable({ apis: ['Date'], now: NOW }); });
afterEach(() => { mock.timers.reset(); if (saved === undefined) delete process.env.EDIT_PASSCODE; else process.env.EDIT_PASSCODE = saved; });

test('guard: right passcode is ok and logs nothing; a wrong one is logged and returned, not thrown', async () => {
  const { db, rows } = fakeDb();
  assert.equal((await guard({ db }, 's3cret')).result, 'ok');
  assert.equal(rows('editAttempt').length, 0);
  assert.equal((await guard({ db }, 'nope')).result, 'wrong');
  assert.equal(rows('editAttempt').length, 1);
});

test('guard: ten wrong tries in one India hour lock edits, even for the right passcode; a new hour unlocks', async () => {
  const { db } = fakeDb();
  for (let i = 0; i < 10; i++) assert.equal((await guard({ db }, 'nope')).result, 'wrong');
  assert.equal((await guard({ db }, 's3cret')).result, 'locked');
  assert.equal((await guard({ db }, 'nope')).result, 'locked');
  mock.timers.setTime(NOW + 3_600_000);
  assert.equal((await guard({ db }, 's3cret')).result, 'ok');
});

test('guard: an unset or empty passcode disables every edit', async () => {
  const { db } = fakeDb();
  delete process.env.EDIT_PASSCODE;
  assert.equal((await guard({ db }, 'anything')).result, 'disabled');
  process.env.EDIT_PASSCODE = '';
  assert.equal((await guard({ db }, '')).result, 'disabled');
});

test('guard: failure records older than two hours are deleted', async () => {
  const { db, rows } = fakeDb({ editAttempt: [{ at: NOW - 3 * 3_600_000 }, { at: NOW - 60_000 }] });
  await guard({ db }, 's3cret');
  assert.deepEqual(rows('editAttempt').map(r => r.at), [NOW - 60_000]);
});

const tables = { answerTable: 'answer', outcomeTable: 'outcome' } as const;
const flag = { flagKey: 'R1:X', ledger: 'X', ruleId: 'R1' };
const seedFlag = () => fakeDb({ flag: [flag] });
const loadFlag = (db: ReturnType<typeof fakeDb>['db']) => async (key: string) => (await db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', key)).unique());

test('record: a wrong passcode writes nothing at all', async () => {
  const { db, rows } = seedFlag();
  const r = await recordAnswer({ db }, { ...tables, flagKey: 'R1:X', passcode: 'nope', fields: { nature: 'loan' }, loadFlag: loadFlag(db) });
  assert.deepEqual(r, { ok: false, reason: 'wrong' });
  assert.equal(rows('answer').length, 0);
});

test('record: an unknown flag is refused; a good call stores the answer with a server timestamp', async () => {
  const { db, rows } = seedFlag();
  assert.deepEqual(await recordAnswer({ db }, { ...tables, flagKey: 'R1:Nope', passcode: 's3cret', fields: { nature: 'loan' }, loadFlag: loadFlag(db) }), { ok: false, reason: 'unknown_flag' });
  assert.deepEqual(await recordAnswer({ db }, { ...tables, flagKey: 'R1:X', passcode: 's3cret', fields: { nature: 'loan' }, loadFlag: loadFlag(db) }), { ok: true });
  assert.equal(rows('answer').length, 1);
  assert.equal(rows('answer')[0].answeredAt, NOW);
});

test('record: a second answer replaces the first and clears an earlier decision', async () => {
  const { db, rows } = fakeDb({ flag: [flag], answer: [{ flagKey: 'R1:X', nature: 'loan', answeredAt: 1 }], outcome: [{ flagKey: 'R1:X', decision: 'approved' }] });
  await recordAnswer({ db }, { ...tables, flagKey: 'R1:X', passcode: 's3cret', fields: { nature: 'goods_services' }, loadFlag: loadFlag(db) });
  assert.equal(rows('answer').length, 1);
  assert.equal(rows('answer')[0].nature, 'goods_services');
  assert.equal(rows('outcome').length, 0);
});

const decideArgs = (db: ReturnType<typeof fakeDb>['db'], over: Record<string, unknown> = {}) => ({
  ...tables, flagKey: 'R1:X', passcode: 's3cret', answeredAt: 5, decision: 'approved' as const, loadFlag: loadFlag(db),
  snapshotFor: async () => ({ kind: 'final', n: 1 }), approvalBlock: (s: { kind: string }) => (s.kind === 'final' ? null : 'answer_incomplete'), ...over,
});

test('decide: needs a right passcode, a known flag and a saved answer', async () => {
  const { db, rows } = seedFlag();
  assert.deepEqual(await decideOn({ db }, decideArgs(db, { passcode: 'nope' })), { ok: false, reason: 'wrong' });
  assert.deepEqual(await decideOn({ db }, decideArgs(db, { flagKey: 'R1:Nope' })), { ok: false, reason: 'unknown_flag' });
  assert.deepEqual(await decideOn({ db }, decideArgs(db)), { ok: false, reason: 'no_answer' });
  assert.equal(rows('outcome').length, 0);
});

test('decide: a stale answer is refused; the current one stores a plain-data snapshot', async () => {
  const { db, rows } = fakeDb({ flag: [flag], answer: [{ flagKey: 'R1:X', nature: 'loan', answeredAt: 5 }] });
  assert.deepEqual(await decideOn({ db }, decideArgs(db, { answeredAt: 4 })), { ok: false, reason: 'stale' });
  assert.deepEqual(await decideOn({ db }, decideArgs(db)), { ok: true });
  assert.equal(rows('outcome').length, 1);
  assert.deepEqual(rows('outcome')[0].snapshot, { kind: 'final', n: 1 });
  assert.equal(rows('outcome')[0].decision, 'approved');
});

test('decide: a blocked outcome cannot be approved, with the helper\'s own reason, but can be sent back', async () => {
  const { db, rows } = fakeDb({ flag: [flag], answer: [{ flagKey: 'R1:X', nature: 'deposit', answeredAt: 5 }] });
  const blocked = decideArgs(db, { snapshotFor: async () => ({ kind: 'open' }), approvalBlock: () => 'not_priced' });
  assert.deepEqual(await decideOn({ db }, blocked), { ok: false, reason: 'not_priced' });
  assert.equal(rows('outcome').length, 0);
  assert.deepEqual(await decideOn({ db }, { ...blocked, decision: 'sent_back' }), { ok: true });
  assert.equal(rows('outcome')[0].decision, 'sent_back');
});

test('decide: a second decision replaces the first', async () => {
  const { db, rows } = fakeDb({ flag: [flag], answer: [{ flagKey: 'R1:X', nature: 'loan', answeredAt: 5 }] });
  await decideOn({ db }, decideArgs(db));
  await decideOn({ db }, decideArgs(db, { decision: 'sent_back' }));
  assert.equal(rows('outcome').length, 1);
  assert.equal(rows('outcome')[0].decision, 'sent_back');
});
