import { test } from 'node:test';
import assert from 'node:assert/strict';
import { r1Outcome, NATURE_OPTIONS, COUNTERPARTY_OPTIONS, TERM_OPTIONS, type R1Answer } from '../../shared/outcomes.ts';

const base = { ledger: 'Rajesh Mehta', amount: 2_50_00_000_00 };
const loan = (o: Partial<R1Answer> = {}): R1Answer => ({ nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes', ...o });

test('answer options are the RULES_v1 R1 lists, in order', () => {
  assert.deepEqual(NATURE_OPTIONS, ['goods_services', 'loan', 'advance', 'deposit', 'not_sure']);
  assert.deepEqual(COUNTERPARTY_OPTIONS, ['director', 'relative', 'shareholder', 'group_company', 'other', 'not_sure']);
  assert.deepEqual(TERM_OPTIONS, ['within_12_months', 'after_12_months', 'on_demand']);
});

test('goods or services: no change and no entry', () => {
  const o = r1Outcome({ nature: 'goods_services' }, base);
  assert.equal(o.kind, 'no_change');
  assert.equal(o.entry, undefined);
});

test('loan from a director repayable within 12 months: short-term related-party borrowing, one entry, AS 18 note', () => {
  const o = r1Outcome(loan(), base);
  assert.equal(o.kind, 'reclass');
  assert.equal(o.caption, 'Short-term borrowings: Loans and advances from related parties');
  assert.deepEqual(o.entry, { debit: 'Rajesh Mehta', credit: 'Short-term borrowings: Loans and advances from related parties', amount: 2_50_00_000_00 });
  assert.equal(o.relatedPartyDisclosure, true);
  assert.equal(o.legalReview, false);
});

test('long-term and on-demand terms pick the right caption', () => {
  assert.match(r1Outcome(loan({ term: 'after_12_months' }), base).caption!, /^Long-term borrowings/);
  assert.match(r1Outcome(loan({ term: 'on_demand' }), base).caption!, /^Short-term borrowings/);
});

test('director or relative without the written declaration needs legal review; unknown declaration too', () => {
  assert.equal(r1Outcome(loan({ declaration: 'no' }), base).legalReview, true);
  assert.equal(r1Outcome(loan({ declaration: 'unknown' }), base).legalReview, true);
  assert.equal(r1Outcome(loan({ counterparty: 'relative', declaration: 'no' }), base).legalReview, true);
});

test('shareholder and group company are related-party borrowings without the director declaration step; other is a plain loan', () => {
  const sh = r1Outcome(loan({ counterparty: 'shareholder', declaration: undefined }), base);
  assert.match(sh.caption!, /related parties/);
  assert.equal(sh.legalReview, false);
  const other = r1Outcome(loan({ counterparty: 'other', declaration: undefined }), base);
  assert.match(other.caption!, /Other loans and advances/);
  assert.equal(other.relatedPartyDisclosure, false);
});

test('a loan with no counterparty or term yet asks for the missing answer and proposes nothing', () => {
  const noParty = r1Outcome({ nature: 'loan', term: 'on_demand' }, base);
  assert.equal(noParty.kind, 'ask_more');
  assert.deepEqual(noParty.missing, ['counterparty']);
  const noTerm = r1Outcome({ nature: 'loan', counterparty: 'other' }, base);
  assert.deepEqual(noTerm.missing, ['term']);
  assert.equal(noTerm.entry, undefined);
  const noDecl = r1Outcome({ nature: 'loan', counterparty: 'director', term: 'on_demand' }, base);
  assert.deepEqual(noDecl.missing, ['declaration']);
});

test('counterparty not sure is escalated, not guessed', () => {
  assert.equal(r1Outcome(loan({ counterparty: 'not_sure', declaration: undefined }), base).kind, 'escalate');
});

test('advance, deposit and not sure go to the owner: RULES_v1 has no fixed outcome for them', () => {
  for (const nature of ['advance', 'deposit', 'not_sure'] as const) {
    const o = r1Outcome({ nature }, base);
    assert.equal(o.kind, 'escalate');
    assert.equal(o.entry, undefined);
  }
});

test('refuses a bad amount and unknown answers', () => {
  assert.throws(() => r1Outcome(loan(), { ledger: 'x', amount: 0 }));
  assert.throws(() => r1Outcome(loan(), { ledger: 'x', amount: 1.5 }));
  assert.throws(() => r1Outcome({ nature: 'gift' } as never, base));
  assert.throws(() => r1Outcome(loan({ term: 'soon' as never }), base));
});

test('a trust is never called a relative: an unlisted counterparty is not turned into one, but the possible related party is kept in the note', () => {
  const o = r1Outcome(loan({ counterparty: 'other', declaration: undefined }), { ...base, ledger: 'Mehta Family Trust', related: true });
  assert.equal(o.relatedPartyDisclosure, false);
  assert.equal(o.legalReview, false);
  assert.match(o.note, /Possible related party: controller to confirm\./);
  assert.doesNotMatch(r1Outcome(loan({ counterparty: 'other', declaration: undefined }), base).note, /Possible related party/);
});
