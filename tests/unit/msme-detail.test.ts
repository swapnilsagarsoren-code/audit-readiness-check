import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MsmeDetailPage, type MsmeData, type MsmeState } from '../../src/MsmeDetail.tsx';
import { visibleMsmeFollowups, msmeDirty } from '../../src/msme-detail-logic.ts';
import { R2_FOLLOWUPS } from '../../shared/r2-outcome.ts';

const noop = () => {};
const bill = { voucher_no: 'NF-00032', ledger: 'Delta Rubber', billDate: '2025-06-01', amount: 8_00_000_00, paidDate: '2025-07-01', daysLate: 15 };
const detail: MsmeData = {
  flag: { flagKey: 'R2:Delta Rubber', party: 'Delta Rubber', amount: 8_00_000_00, band: 'below', statusKnown: true },
  supplier: { status: 'Small', writtenDays: null }, bills: [bill], allowed: 15,
  context: 'The books show 1 bill from Delta Rubber, totalling ₹8,00,000. The bill dated 1 June 2025 was paid on 1 July 2025, 30 days after the bill date. The supplier master records the size as Small and no written credit terms.',
  followups: R2_FOLLOWUPS('Delta Rubber'),
  evidence: [{ id: 'R2-UDYAM', label: 'Udyam registration certificate' }, { id: 'R2-CREDIT-TERMS', label: 'Written credit terms (PO / agreement)' }],
  answer: null, snapshot: null, decision: null,
};
const due = {
  kind: 'interest_due' as const, allowed: 15, principal: 8_00_000_00, interest: 567_123,
  bankRate: { value: 5.75, date: '2026-10-20', sourceUrl: 'https://www.rbi.org.in/' },
  bills: [{ ...bill, interest: 567_123 }],
  notes: ['Interest accrues on each late bill (MSMED Act s.16); controller to confirm the dates and the rate.', 'This screen does not record an agreed interest rate, so the rate under MSMED Act s.16 is applied: three times the RBI Bank Rate (5.75%, as listed on rbi.org.in on 20 October 2026). Indicative: monthly rests, current rate only, controller to confirm.'],
};
const html = (state: MsmeState, selection = {}, extra = {}) => renderToStaticMarkup(createElement(MsmeDetailPage, { state, selection, passcode: '', busy: false, message: '', onSelect: noop, onPasscode: noop, onSave: noop, onDecide: noop, ...extra }));

test('detail: back link, party, bills table with plain dates and days late, supplier master facts', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('href="#/"'));
  assert.ok(out.includes('Delta Rubber'));
  assert.ok(out.includes('What the books show'));
  assert.match(out, /<th[^>]*>Bill date<\/th>/);
  assert.ok(out.includes('1 June 2025') && out.includes('1 July 2025'));
  assert.ok(out.includes('15 days late'));
  assert.ok(out.includes('The books show 1 bill from Delta Rubber'));
});

test('questions: certificate first, size only after "Yes, on file", terms always; nothing pre-selected', () => {
  assert.deepEqual(visibleMsmeFollowups(R2_FOLLOWUPS('Delta Rubber'), {}).map(f => f.id), ['certificate', 'terms']);
  assert.deepEqual(visibleMsmeFollowups(R2_FOLLOWUPS('Delta Rubber'), { certificate: 'no' }).map(f => f.id), ['certificate', 'terms']);
  assert.deepEqual(visibleMsmeFollowups(R2_FOLLOWUPS('Delta Rubber'), { certificate: 'yes' }).map(f => f.id), ['certificate', 'size', 'terms']);
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('Is the Udyam registration certificate for Delta Rubber on file?'));
  assert.ok(!out.includes('What size does it show?'));
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 0);
  const yes = html({ status: 'ready', data: detail }, { certificate: 'yes', terms: 'none' });
  assert.ok(yes.includes('What size does it show?'));
  assert.equal((yes.match(/aria-pressed="true"/g) ?? []).length, 2);
});

test('documents to ask for and the passcode box use the chosen words', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('Udyam registration certificate'));
  assert.ok(out.includes('Edit passcode') && out.includes('Needed to save an answer or a decision.'));
  assert.match(out, /type="password"/);
});

test('outcome: notes, late bills with interest, the interest-rate note with its date and source, totals', () => {
  const out = html({ status: 'ready', data: { ...detail, answer: { certificate: 'yes' }, snapshot: due } }, { certificate: 'yes' });
  assert.ok(out.includes('What this means for the accounts'));
  assert.ok(out.includes('MSMED Act s.16'));
  assert.ok(out.includes('₹5,671.23'));
  assert.ok(out.includes('This screen does not record an agreed interest rate') && out.includes('5.75%') && out.includes('rbi.org.in') && out.includes('20 October 2026'));
  assert.ok(out.includes('Late bills and interest'));
  assert.ok(out.includes('Nothing is written to the books. This records your decision only.'));
});

test('no Bank Rate stored: interest reads "Not priced yet", never a number', () => {
  const unpriced = { ...due, interest: null, bankRate: null, bills: [{ ...bill, interest: null }], notes: ['Not priced yet: no Bank Rate has been stored from the RBI site.'] };
  const out = html({ status: 'ready', data: { ...detail, answer: { certificate: 'yes' }, snapshot: unpriced } }, { certificate: 'yes' });
  assert.ok(out.includes('Not priced yet'));
  assert.doesNotMatch(out, /₹5,671/);
});

test('approve is offered for a final outcome only; escalate and ask-more offer no approval; the unsaved choice disables both buttons', () => {
  const saved = { ...detail, answer: { certificate: 'yes', size: 'small', terms: 'none' }, snapshot: due };
  const same = html({ status: 'ready', data: saved }, { certificate: 'yes', size: 'small', terms: 'none' }, { passcode: 'x' });
  assert.match(same, /<button type="button">Approve<\/button>/);
  const changed = html({ status: 'ready', data: saved }, { certificate: 'yes', size: 'micro', terms: 'none' }, { passcode: 'x' });
  assert.match(changed, /Save the answer first/);
  assert.match(changed, /<button type="button" disabled="">Approve<\/button>/);
  const esc = { ...due, kind: 'escalate' as const, interest: undefined, bills: [], notes: ['The size is not confirmed. Ask for the Udyam certificate before any interest is worked out.'] };
  const outEsc = html({ status: 'ready', data: { ...saved, snapshot: esc } }, { certificate: 'yes', size: 'small', terms: 'none' });
  assert.ok(!outEsc.includes('>Approve<') && outEsc.includes('>Send back<'));
  const ask = { ...esc, kind: 'ask_more' as const };
  assert.ok(!html({ status: 'ready', data: { ...saved, snapshot: ask } }).includes('>Send back<'));
  assert.equal(msmeDirty({ certificate: 'yes' }, { certificate: 'yes' }), false);
  assert.equal(msmeDirty({ certificate: 'yes' }, { certificate: 'no' }), true);
});

test('a recorded decision is shown in words; loading, error and missing states show no figures', () => {
  const saved = { ...detail, answer: { certificate: 'yes', size: 'small', terms: 'none' }, snapshot: due, decision: { decision: 'sent_back' as const, decidedAt: 1 } };
  assert.ok(html({ status: 'ready', data: saved }, { certificate: 'yes', size: 'small', terms: 'none' }).includes('Sent back'));
  assert.doesNotMatch(html({ status: 'loading' }), /₹/);
  assert.match(html({ status: 'error' }, {}, { onRetry: noop }), /role="alert"/);
  assert.ok(html({ status: 'missing' }).includes('Nothing to review here.'));
});

test('no banned wording', () => {
  const out = html({ status: 'ready', data: { ...detail, answer: { certificate: 'yes' }, snapshot: due } }, { certificate: 'yes' });
  assert.doesNotMatch(out, /fraud|forensic|platform|continuously tracks|red flag|error found|AI decided/i);
});

test('interest not priced yet: Approve is not offered, Send back is', () => {
  const unpriced = { ...due, interest: null, bankRate: null, bills: [{ ...bill, interest: null }], notes: ['Not priced yet: no Bank Rate has been stored from the RBI site.'] };
  const out = html({ status: 'ready', data: { ...detail, answer: { certificate: 'yes', size: 'small', terms: 'none' }, snapshot: unpriced } }, { certificate: 'yes', size: 'small', terms: 'none' }, { passcode: 'x' });
  assert.ok(!out.includes('>Approve<') && out.includes('>Send back<'));
});
