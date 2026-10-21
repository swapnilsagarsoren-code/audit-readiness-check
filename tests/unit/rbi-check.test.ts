import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fakeDb } from '../helpers/fake-db.ts';
import { startSession } from '../../convex/visitorCore.ts';
import { claimCheck, storeCheck, latestRate, runCheck, RBI_LIMITS, type Plan } from '../../convex/rbiCore.ts';

const NOW = Date.UTC(2026, 9, 21, 6, 45, 0); // 12:15 IST, 21 Oct 2026
const A = '3f2c1a9e-8b7d-4c6e-9f1a-2b3c4d5e6f70', B = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
const HOUR = 3_600_000;
beforeEach(() => mock.timers.enable({ apis: ['Date'], now: NOW }));
afterEach(() => mock.timers.reset());
const home = await readFile('tests/fixtures/rbi-current-rates.html', 'utf8');
const schedulePage = await readFile('tests/fixtures/rbi-mpc-schedule-2026-27.html', 'utf8');
const stored = { value: 5.75, date: '2026-10-21', sourceUrl: 'https://www.rbi.org.in/', checkedAt: NOW - HOUR, lastDecision: '2026-10-07', nextStart: '2026-12-02', nextEnd: '2026-12-04', scheduleUrl: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422', scheduleFy: '2026-27' };

test('claim: needs a live session', async () => {
  const { db } = fakeDb();
  assert.equal((await claimCheck({ db }, A)).plan, 'no_session');
  await startSession({ db }, { sessionId: A, code: '1234' });
  mock.timers.setTime(NOW + 8 * 24 * HOUR);
  assert.equal((await claimCheck({ db }, A)).plan, 'expired');
});

test('claim: three checks per visitor per India day, then a refusal; presses within a minute share one read; the next India day resets it', async () => {
  const { db } = fakeDb();
  await startSession({ db }, { sessionId: A, code: '1234' });
  const plans = [];
  for (let i = 0; i < RBI_LIMITS.perSessionPerDay + 1; i++) plans.push(await claimCheck({ db }, A));
  assert.deepEqual(plans.map(p => [p.plan, p.checksLeft]), [['fetch', 2], ['cached', 1], ['cached', 0], ['limit', 0]]);
  mock.timers.setTime(Date.UTC(2026, 9, 21, 18, 31, 0)); // 00:01 IST on 22 Oct
  assert.equal((await claimCheck({ db }, A)).plan, 'fetch');
});

test('claim: a check within 6 hours of the last stored one reuses it and never reaches RBI', async () => {
  const { db, rows } = fakeDb({ rbiCheck: [stored] });
  await startSession({ db }, { sessionId: A, code: '1234' });
  assert.equal((await claimCheck({ db }, A)).plan, 'cached');
  assert.equal(rows('usageCounter').some(r => String(r.key).startsWith('rbi:')), false);
  mock.timers.setTime(NOW + 5 * HOUR + 1);
  assert.equal((await claimCheck({ db }, A)).plan, 'fetch');
});

test('claim: a global cap on reads of RBI per India day', async () => {
  const { db } = fakeDb({ usageCounter: [{ key: 'rbi:2026-10-21', count: RBI_LIMITS.readsPerDay }] });
  await startSession({ db }, { sessionId: B, code: '5678' });
  assert.equal((await claimCheck({ db }, B)).plan, 'busy');
});

test('store: keeps the rate with the check time and the policy dates; refuses an absurd rate', async () => {
  const { db, rows } = fakeDb();
  const { checkedAt: _c, ...rest } = stored;
  await storeCheck({ db }, { ...rest, value: 5.5 });
  const r = rows('rbiCheck')[0];
  assert.equal(r.value, 5.5);
  assert.equal(r.checkedAt, NOW);
  assert.equal(r.nextStart, '2026-12-02');
  await assert.rejects(() => storeCheck({ db }, { ...rest, value: 40 }));
  await assert.rejects(() => storeCheck({ db }, { ...rest, date: '2026-10-22' }));
});

test('latest rate: the newest check wins, and an older dev row without a check time still reads', async () => {
  const { db } = fakeDb({ rbiBankRate: [{ value: 5.75, date: '2026-10-20', sourceUrl: 'https://www.rbi.org.in/' }], rbiCheck: [stored, { ...stored, value: 5.5, checkedAt: NOW - 1000 }] });
  assert.equal((await latestRate({ db }))!.value, 5.5);
  const { db: old } = fakeDb({ rbiBankRate: [{ value: 5.75, date: '2026-10-20', sourceUrl: 'https://www.rbi.org.in/' }] });
  assert.deepEqual(await latestRate({ db: old }), { value: 5.75, date: '2026-10-20', sourceUrl: 'https://www.rbi.org.in/', checkedAt: null, lastDecision: null, next: null, scheduleFy: null });
});

function deps(plan: Plan, pages: Record<string, string>) {
  const calls: string[] = [], saved: unknown[] = [];
  return {
    calls, saved,
    d: {
      claim: async () => ({ plan, checksLeft: 2 }),
      fetchText: async (url: string) => { calls.push(url); if (!(url in pages)) throw new Error('network'); return pages[url]; },
      store: async (row: unknown) => { saved.push(row); },
      latest: async () => null,
    },
  };
}
const ok = { 'https://www.rbi.org.in/': home, 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422': schedulePage };

test('check: a fresh read parses both pages and stores the rate with last and next decision dates', async () => {
  const { d, calls, saved } = deps('fetch', ok);
  const r = await runCheck(d);
  assert.equal(r.status, 'fresh');
  assert.equal(calls.length, 2);
  assert.deepEqual(saved, [{ value: 5.75, date: '2026-10-21', sourceUrl: 'https://www.rbi.org.in/', lastDecision: '2026-10-07', nextStart: '2026-12-02', nextEnd: '2026-12-04', scheduleUrl: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422', scheduleFy: '2026-27' }]);
});

test('check: reused, limited or busy answers never reach RBI', async () => {
  for (const plan of ['cached', 'limit', 'busy', 'no_session', 'expired'] as const) {
    const { d, calls, saved } = deps(plan, ok);
    assert.equal((await runCheck(d)).status, plan);
    assert.equal(calls.length + saved.length, 0, plan);
  }
});

test('check: a failed or changed page stores nothing and says so', async () => {
  for (const pages of [{}, { ...ok, 'https://www.rbi.org.in/': '<html>changed</html>' }, { ...ok, 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422': '<html>changed</html>' }]) {
    const { d, saved } = deps('fetch', pages);
    assert.equal((await runCheck(d)).status, 'failed');
    assert.equal(saved.length, 0);
  }
});

test('claim: many visitors pressing together cause one read of RBI, not one each', async () => {
  const { db, rows } = fakeDb();
  const ids = Array.from({ length: 17 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`);
  for (const id of ids) await startSession({ db }, { sessionId: id, code: '1234' });
  const plans = [];
  for (const id of ids) plans.push((await claimCheck({ db }, id)).plan);
  assert.equal(plans.filter(p => p === 'fetch').length, 1);
  assert.equal(rows('usageCounter').find(r => r.key === 'rbi:2026-10-21')!.count, 1);
  mock.timers.setTime(NOW + 61_000);
  assert.equal((await claimCheck({ db }, ids[0])).plan, 'fetch');
});
