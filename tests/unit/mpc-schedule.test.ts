import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMpcSchedule, policyDates } from '../../shared/mpc-schedule.ts';

const page = await readFile('tests/fixtures/rbi-mpc-schedule-2026-27.html', 'utf8');
const schedule = parseMpcSchedule(page);

test('reads the six 2026-27 MPC meetings from the real RBI press release (fetched 21 Oct 2026)', () => {
  assert.equal(schedule.fy, '2026-27');
  assert.deepEqual(schedule.meetings, [
    { start: '2026-04-06', end: '2026-04-08' }, { start: '2026-06-03', end: '2026-06-05' }, { start: '2026-08-03', end: '2026-08-05' },
    { start: '2026-10-05', end: '2026-10-07' }, { start: '2026-12-02', end: '2026-12-04' }, { start: '2027-02-03', end: '2027-02-05' },
  ]);
});

test('refuses a page without the schedule, with dates outside the year, out of order, or listed twice', () => {
  assert.throws(() => parseMpcSchedule('<html>nothing</html>'));
  assert.throws(() => parseMpcSchedule(page.replace('Dates of meetings of Monetary Policy Committee', 'Dates of something else')));
  assert.throws(() => parseMpcSchedule(page.replace('February 3, 4 and 5, 2027', 'February 3, 4 and 5, 2028')));
  assert.throws(() => parseMpcSchedule(page.replace('June 3, 4 and 5, 2026', 'June 3, 4 and 5, 2026 May 1, 2 and 3, 2026')));
  assert.throws(() => parseMpcSchedule(page + page));
  assert.throws(() => parseMpcSchedule(page.replace('October 5, 6 and 7, 2026', 'September 30 and October 1, 2026')));
});

test('the decision is announced on the last day of a meeting', () => {
  assert.deepEqual(policyDates(schedule, '2026-10-21'), { lastDecision: '2026-10-07', next: { start: '2026-12-02', end: '2026-12-04' } });
  assert.deepEqual(policyDates(schedule, '2026-12-03'), { lastDecision: '2026-10-07', next: { start: '2026-12-02', end: '2026-12-04' } });
  assert.deepEqual(policyDates(schedule, '2026-12-04'), { lastDecision: '2026-12-04', next: { start: '2027-02-03', end: '2027-02-05' } });
});

test('before the first meeting there is no last decision in this schedule; after the last there is no next date', () => {
  assert.deepEqual(policyDates(schedule, '2026-03-30'), { lastDecision: null, next: { start: '2026-04-06', end: '2026-04-08' } });
  assert.deepEqual(policyDates(schedule, '2027-02-06'), { lastDecision: '2027-02-05', next: null });
});
