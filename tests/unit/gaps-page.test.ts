import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { GapsPage, type GapsData, type GapsState } from '../../src/GapsPage.tsx';
import { formatCroreLakh } from '../../src/gaps-data.ts';
import { RULE_SET_VERSION } from '../../shared/rule-set-version.ts';

const html = (state: GapsState) => renderToStaticMarkup(createElement(GapsPage, { state }));
const row = (o: Partial<GapsData['flags'][number]> & { ledger: string; amount: number }): GapsData['flags'][number] => ({
  flagKey: `R1:${o.ledger}`, ruleId: 'R1', party: o.ledger, band: 'flagged', percentOfFlagLine: 100, related: false, statusKnown: true, note: '',
  entryRefs: [{ voucher_no: 'V1', ledger: o.ledger }], ruleVersion: RULE_SET_VERSION, rank: 0, ...o,
});
const data: GapsData = {
  materiality: { overall: 45_00_000_00, flagLine: 22_50_000_00, hideBelow: 2_25_000_00, basis: 'pbt' },
  flags: [
    row({ ledger: 'Rajesh Mehta', amount: 2_50_00_000_00, percentOfFlagLine: 1111, related: true }),
    row({ ledger: 'Kumar Packaging', amount: 10_00_000_00, band: 'below', percentOfFlagLine: 44, ruleId: 'R2', statusKnown: false }),
  ],
};

test('crore and lakh headline format', () => {
  assert.equal(formatCroreLakh(45_00_000_00), '₹45 lakh');
  assert.equal(formatCroreLakh(22_50_000_00), '₹22.5 lakh');
  assert.equal(formatCroreLakh(2_50_00_000_00), '₹2.5 cr');
  assert.equal(formatCroreLakh(150_00_00_000_00), '₹150 cr');
  assert.equal(formatCroreLakh(1_90_000_00), '₹1.9 lakh');
  assert.equal(formatCroreLakh(50_000_00), '₹50,000');
});

test('ready: header shows materiality, rows are a real ordered list with full rupees and bands in words', () => {
  const out = html({ status: 'ready', data });
  assert.match(out, /<ol/);
  assert.equal((out.match(/<li/g) ?? []).length, 2);
  assert.ok(out.includes('Overall materiality ₹45 lakh'));
  assert.ok(out.includes('Flag line ₹22.5 lakh'));
  assert.ok(out.includes('₹2,50,00,000'));
  assert.ok(out.includes('Possible related party'));
  assert.ok(out.includes('MSME status missing'));
  assert.ok(out.includes('Below flag line'));
  assert.ok(out.includes('1111% of flag line'));
  assert.ok(out.includes('>Open<'));
});

test('ready: row order follows the data order; every flagged row opens its gap detail', () => {
  const out = html({ status: 'ready', data });
  assert.ok(out.indexOf('Rajesh Mehta') < out.indexOf('Kumar Packaging'));
  assert.equal((out.match(/<a /g) ?? []).length, 2);
  const r3 = html({ status: 'ready', data: { ...data, flags: [row({ ledger: 'Meridian Term Loan', amount: 9_60_00_000_00, ruleId: 'R3', flagKey: 'R3:Meridian Term Loan' })] } });
  assert.match(r3, /href="#\/gap\/R3%3AMeridian%20Term%20Loan"/);
  assert.ok(out.includes('href="#/gap/R1%3ARajesh%20Mehta"'));
  assert.doesNotMatch(out, /<button/);
});

test('loading shows skeleton rows, no figures and marks the region busy', () => {
  const out = html({ status: 'loading' });
  assert.match(out, /aria-busy="true"/);
  assert.ok((out.match(/class="skeleton"/g) ?? []).length >= 3);
  assert.doesNotMatch(out, /₹/);
});

test('empty and error states say so plainly and show no figures', () => {
  const empty = html({ status: 'empty' });
  assert.ok(empty.includes("No gaps list yet. The books haven't been checked.") || empty.includes('No gaps list yet. The books haven&#x27;t been checked.'));
  assert.doesNotMatch(empty, /₹\d/);
  const err = html({ status: 'error' });
  assert.match(err, /role="alert"/);
  assert.ok(err.includes('Nothing here is final.'));
  assert.doesNotMatch(err, /<li/);
});

test('ready with zero rows is the done state, with how the flag line was set', () => {
  const out = html({ status: 'ready', data: { ...data, flags: [] } });
  assert.ok(out.includes('No gaps above the flag line.'));
  assert.ok(out.includes('lower of 1% of revenue and 5% of profit before tax'));
});

test('first-screen words are the ones Swapnil chose, with no placeholder left', () => {
  const out = html({ status: 'ready', data });
  assert.ok(out.includes('Gaps an auditor is likely to raise'));
  assert.doesNotMatch(out, /\[(heading|empty|status)\]/);
});

test('no banned wording on the screen', () => {
  const out = html({ status: 'ready', data });
  assert.doesNotMatch(out, /fraud|forensic|platform|continuously tracks|red flag|error found|AI decided/i);
});

test('a list built with older rules says so; a current list does not', () => {
  assert.doesNotMatch(html({ status: 'ready', data }), /older rules/);
  const stale = { ...data, flags: data.flags.map((f, i) => (i === 0 ? { ...f, ruleVersion: 'RULES_v0' } : f)) };
  const out = html({ status: 'ready', data: stale });
  assert.ok(out.includes('The list was built with older rules. Refresh the list before relying on these amounts.'));
  assert.match(out, /role="status"/);
});
