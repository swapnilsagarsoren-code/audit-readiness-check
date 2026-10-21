import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPasscode, constantTimeEqual, istHour, MAX_FAILURES_PER_HOUR } from '../../shared/passcode.ts';

const NOW = Date.UTC(2026, 9, 21, 6, 45, 0); // 12:15 IST on 21 Oct 2026
const fails = (n: number, at = NOW - 60_000) => Array.from({ length: n }, () => at);

test('right passcode is ok, wrong is wrong, unset deployment is disabled', () => {
  assert.equal(checkPasscode('s3cret', 's3cret', [], NOW), 'ok');
  assert.equal(checkPasscode('nope', 's3cret', [], NOW), 'wrong');
  assert.equal(checkPasscode('anything', undefined, [], NOW), 'disabled');
  assert.equal(checkPasscode('', '', [], NOW), 'disabled');
});

test('ten wrong tries in one India hour lock all edits, even for the right passcode', () => {
  assert.equal(MAX_FAILURES_PER_HOUR, 10);
  assert.equal(checkPasscode('s3cret', 's3cret', fails(9), NOW), 'ok');
  assert.equal(checkPasscode('s3cret', 's3cret', fails(10), NOW), 'locked');
  assert.equal(checkPasscode('wrong', 's3cret', fails(10), NOW), 'locked');
});

test('failures from an earlier India clock hour do not count; the hour turns at :00 IST, not UTC', () => {
  const earlier = NOW - 3_600_000;
  assert.equal(checkPasscode('s3cret', 's3cret', fails(10, earlier), NOW), 'ok');
  // 18:29:59 UTC is 23:59:59 IST; 18:30:00 UTC is the next IST hour.
  const lastSecond = Date.UTC(2026, 9, 21, 18, 29, 59), firstSecond = Date.UTC(2026, 9, 21, 18, 30, 0);
  assert.notEqual(istHour(lastSecond), istHour(firstSecond));
  assert.equal(checkPasscode('s3cret', 's3cret', fails(10, lastSecond), firstSecond), 'ok');
  assert.equal(checkPasscode('s3cret', 's3cret', fails(10, lastSecond), lastSecond), 'locked');
});

test('comparison does not stop at the first different character and handles length differences', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
  assert.equal(constantTimeEqual('', 'a'), false);
});
