import * as React from 'react';
import { formatIndianRupees } from '../shared/flag-input.ts';
import { plainDate } from '../shared/r1-question.ts';
import { visibleFollowups, type Selection } from './gap-detail-logic.ts';
void React;

type Button = { value: string; label: string };
type Ratio = { debt: number; equity: number; ratio: number };
export type DetailData = {
  flag: { flagKey: string; ledger: string; party: string; amount: number; band: 'flagged' | 'below'; related: boolean };
  entries: { voucher_no?: string; date: string; amount: number; narration: string }[];
  question: { context: string; question: string; text: string };
  natureButtons: Button[]; followups: { id: string; question: string; buttons: Button[]; onlyFor?: string[] }[];
  evidence: { id: string; label: string }[];
  answer: Record<string, unknown> | null;
  snapshot: null | {
    outcome: { kind: 'no_change' | 'reclass' | 'escalate' | 'ask_more'; caption?: string; entry?: { debit: string; credit: string; amount: number }; relatedPartyDisclosure: boolean; legalReview: boolean; note: string };
    before: Ratio; after?: Ratio; covenantMax: number; covenantBefore: 'within' | 'breach'; covenantAfter?: 'within' | 'breach';
  };
  decision: null | { decision: 'approved' | 'sent_back'; decidedAt: number };
};
export type DetailState = { status: 'loading' | 'error' | 'missing' } | { status: 'ready'; data: DetailData };

// Near the limit two decimals could print "1.50" beside "Above the 1.50 limit", so show three there.
const ratioText = (r: Ratio, max: number) => (Math.abs(r.ratio - max) < 0.005 && r.ratio !== max ? r.ratio.toFixed(3) : r.ratio.toFixed(2));
const verdictText = (v: 'within' | 'breach', max: number) => `${v === 'within' ? 'Within' : 'Above'} the ${max.toFixed(2)} limit`;

type Props = {
  state: DetailState; selection: Selection; passcode: string; busy: boolean; message: string;
  onRetry?: () => void; onSelect: (field: keyof Selection, value: string) => void; onPasscode: (value: string) => void; onSave: () => void; onDecide: (decision: 'approved' | 'sent_back') => void;
  back?: { href: string; text: string }; codeLabel?: string;
};

export function GapDetailPage({ state, selection, passcode, busy, message, onRetry, onSelect, onPasscode, onSave, onDecide, back, codeLabel }: Props) {
  const data = state.status === 'ready' ? state.data : null;
  const saved = (data?.answer ?? {}) as Selection;
  const dirty = !!data && (['nature', 'counterparty', 'term', 'declaration'] as const).some(k => (selection[k] ?? undefined) !== (saved[k] ?? undefined));
  const ask = (id: string, question: string, buttons: Button[], field: keyof Selection) => <fieldset key={id} className="ask">
    <legend>{question}</legend>
    <div className="choices">{buttons.map(b => <button key={b.value} type="button" className="choice" aria-pressed={selection[field] === b.value} onClick={() => onSelect(field, b.value)}>{b.label}</button>)}</div>
  </fieldset>;
  return <section className="detail" aria-label="Gap detail" aria-busy={state.status === 'loading'}>
    <a className="back" href={back?.href ?? '#/'}>{back?.text ?? '← All gaps'}</a>
    {state.status === 'loading' && <div className="skeleton" aria-hidden="true" />}
    {state.status === 'error' && <><p role="alert">Couldn't load this gap. Nothing here is final.</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</>}
    {state.status === 'missing' && <p>Nothing to review here.</p>}
    {data && <>
      <h2>{data.flag.party}</h2>
      <p className="gaps-line">{formatIndianRupees(data.flag.amount)} · {data.flag.band === 'flagged' ? 'Flagged' : 'Below flag line'}{data.flag.related ? ' · Possible related party' : ''}</p>

      <h3>What the books show</h3>
      <div className="table-wrap"><table>
        <thead><tr><th scope="col">Voucher</th><th scope="col">Date</th><th scope="col" className="num">Amount</th><th scope="col">Narration</th></tr></thead>
        <tbody>{data.entries.map((e, i) => <tr key={`${e.voucher_no}-${i}`}><td>{e.voucher_no}</td><td>{plainDate(e.date)}</td><td className="num">{formatIndianRupees(e.amount)}</td><td>{e.narration}</td></tr>)}</tbody>
      </table></div>

      <h3>The question</h3>
      <p className="question-context">{data.question.context}</p>
      {ask('nature', data.question.question, data.natureButtons, 'nature')}
      {visibleFollowups(selection).map(f => ask(f.id, f.question, f.buttons, f.id))}

      <h3>Documents to ask for</h3>
      <ul className="docs">{data.evidence.map(d => <li key={d.id}>{d.label}</li>)}</ul>

      <div className="passcode">
        <label htmlFor="edit-passcode">{codeLabel ?? 'Edit passcode'}</label>
        <input id="edit-passcode" type="password" autoComplete="off" value={passcode} onChange={ev => onPasscode(ev.target.value)} />
        <p className="note">Needed to save an answer or a decision.</p>
        <button type="button" onClick={onSave} disabled={busy || !selection.nature || passcode === ''}>Save answer</button>
        <p aria-live="polite" className="message">{message}</p>
      </div>

      {data.snapshot && <>
        <h3>What this means for the accounts</h3>
        <p>{data.snapshot.outcome.note}</p>
        {data.snapshot.outcome.entry && <>
          <h4>Proposed entry</h4>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Account</th><th scope="col" className="num">Debit</th><th scope="col" className="num">Credit</th></tr></thead>
            <tbody>
              <tr><td>{data.snapshot.outcome.entry.debit}</td><td className="num">{formatIndianRupees(data.snapshot.outcome.entry.amount)}</td><td className="num" /></tr>
              <tr><td>{data.snapshot.outcome.entry.credit}</td><td className="num" /><td className="num">{formatIndianRupees(data.snapshot.outcome.entry.amount)}</td></tr>
            </tbody>
          </table></div>
        </>}
        {data.snapshot.after && data.snapshot.covenantAfter && <>
          <h4>Debt-equity, before and after</h4>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col" /><th scope="col" className="num">Before</th><th scope="col" className="num">After</th></tr></thead>
            <tbody>
              <tr><th scope="row">Debt-equity</th><td className="num">{ratioText(data.snapshot.before, data.snapshot.covenantMax)}</td><td className="num">{ratioText(data.snapshot.after, data.snapshot.covenantMax)}</td></tr>
              <tr><th scope="row">Against the limit</th><td className="num">{verdictText(data.snapshot.covenantBefore, data.snapshot.covenantMax)}</td><td className="num">{verdictText(data.snapshot.covenantAfter, data.snapshot.covenantMax)}</td></tr>
            </tbody>
          </table></div>
          <p className="note">Covenant maximum {data.snapshot.covenantMax.toFixed(2)}. Equity includes profit before tax as booked.</p>
        </>}
        {data.snapshot.outcome.kind !== 'ask_more' && <div className="approval">
          {dirty && <p className="note">Save the answer first. The outcome above is for the saved answer.</p>}
          {data.decision && <p className="decision">{data.decision.decision === 'approved' ? 'Approved' : 'Sent back'}</p>}
          <div className="actions">
            {data.snapshot.outcome.kind !== 'escalate' && <button type="button" onClick={() => onDecide('approved')} disabled={busy || dirty || passcode === ''}>Approve</button>}
            <button type="button" className="secondary" onClick={() => onDecide('sent_back')} disabled={busy || dirty || passcode === ''}>Send back</button>
          </div>
          <p className="note">Nothing is written to the books. This records your decision only.</p>
        </div>}
      </>}
    </>}
  </section>;
}
