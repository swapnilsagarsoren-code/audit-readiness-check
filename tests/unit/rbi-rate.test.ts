import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseBankRate, istDate } from '../../shared/rbi-rate.ts';

const page = await readFile('tests/fixtures/rbi-current-rates.html', 'utf8');

test('reads the Bank Rate from the real RBI Current Rates markup (fetched 20 Oct 2026)', () => {
  assert.equal(parseBankRate(page), 5.75);
});

test('refuses a page with no Bank Rate, a duplicate, a mismatch with the MSF rate, or an absurd value', () => {
  assert.throws(() => parseBankRate('<html>nothing here</html>'));
  assert.throws(() => parseBankRate(page + page));
  assert.throws(() => parseBankRate(page.replace(/(Marginal Standing Facility Rate[\s\S]*?:\s*)5\.75/, '$16.00')));
  assert.throws(() => parseBankRate(page.replaceAll('5.75%', '35.75%')));
});

test('a changed rate is read as the new rate when both lines move together', () => {
  assert.equal(parseBankRate(page.replaceAll('5.75%', '5.50%')), 5.5);
});

test('the stored rate date is today in India: 18:29 UTC is still today, 18:30 UTC is already tomorrow', () => {
  assert.equal(istDate(Date.UTC(2026, 9, 20, 18, 29, 59)), '2026-10-20');
  assert.equal(istDate(Date.UTC(2026, 9, 20, 18, 30, 0)), '2026-10-21');
});
