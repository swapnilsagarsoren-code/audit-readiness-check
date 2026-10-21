import * as React from 'react';
import { formatIndianRupees, rupeesAndPaise } from '../shared/flag-input.ts';
import { plainDate } from '../shared/r1-question.ts';
import { msmeDirty, visibleMsmeFollowups, type MsmeSelection } from './msme-detail-logic.ts';
void React;

type Button = { value: string; label: string };
type Bill = { voucher_no: string; ledger: string; billDate: string; amount: number; paidDate: string | null; daysLate: number };
export type MsmeData = {
  flag: { flagKey: string; party: string; amount: number; band: 'flagged' | 'below'; statusKnown: boolean };
  supplier: { status: string; writtenDays: number | null }; bills: Bill[]; allowed: number;
  context: string; followups: { id: string; question: string; onlyWhen?: Record<string, string>; buttons: Button[] }[];
  evidence: { id: string; label: string }[];
  answer: Record<string, unknown> | null;
  snapshot: null | {
    kind: 'interest_due' | 'not_late' | 'no_interest' | 'escalate' | 'ask_more'; allowed?: number; principal?: number; interest?: number | null;
    bankRate: { value: number; date: string; sourceUrl: string } | null; bills: (Bill & { interest: number | null })[]; notes: string[];
  };
  decision: null | { decision: 'approved' | 'sent_back'; decidedAt: number };
};
export type MsmeState = { status: 'loading' | 'error' | 'missing' } | { status: 'ready'; data: MsmeData };
type Props = {
  state: MsmeState; selection: MsmeSelection; passcode: string; busy: boolean; message: string;
  onRetry?: () => void; onSelect: (field: keyof MsmeSelection, value: string) => void; onPasscode: (value: string) => void; onSave: () => void; onDecide: (decision: 'approved' | 'sent_back') => void;
  back?: { href: string; text: string }; codeLabel?: string; children?: React.ReactNode;
};

export function MsmeDetailPage({ state, selection, passcode, busy, message, onRetry, onSelect, onPasscode, onSave, onDecide, back, codeLabel, children }: Props) {
  const data = state.status === 'ready' ? state.data : null;
  const dirty = !!data && msmeDirty(selection, (data.answer ?? {}) as MsmeSelection);
  const snap = data?.snapshot ?? null;
  return <section className="detail" aria-label="Gap detail" aria-busy={state.status === 'loading'}>
    <a className="back" href={back?.href ?? '#/'}>{back?.text ?? '← All gaps'}</a>
    {state.status === 'loading' && <div className="skeleton" aria-hidden="true" />}
    {state.status === 'error' && <><p role="alert">Couldn't load this gap. Nothing here is final.</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</>}
    {state.status === 'missing' && <p>Nothing to review here.</p>}
    {data && <>
      <h2>{data.flag.party}</h2>
      <p className="gaps-line">{formatIndianRupees(data.flag.amount)} late · {data.flag.band === 'flagged' ? 'Flagged' : 'Below flag line'}{data.flag.statusKnown ? '' : ' · MSME status missing'}</p>

      <h3>What the books show</h3>
      <div className="table-wrap"><table>
        <thead><tr><th scope="col">Voucher</th><th scope="col">Bill date</th><th scope="col" className="num">Amount</th><th scope="col">Paid</th><th scope="col" className="num">Days late</th></tr></thead>
        <tbody>{data.bills.map(b => <tr key={b.voucher_no}><td>{b.voucher_no}</td><td>{plainDate(b.billDate)}</td><td className="num">{formatIndianRupees(b.amount)}</td><td>{b.paidDate ? plainDate(b.paidDate) : 'Not paid by year end'}</td><td className="num">{b.daysLate} days late</td></tr>)}</tbody>
      </table></div>

      <h3>The question</h3>
      <p className="question-context">{data.context}</p>
      {visibleMsmeFollowups(data.followups, selection).map(f => <fieldset key={f.id} className="ask">
        <legend>{f.question}</legend>
        <div className="choices">{f.buttons.map(b => <button key={b.value} type="button" className="choice" aria-pressed={(selection as Record<string, string | undefined>)[f.id] === b.value} onClick={() => onSelect(f.id as keyof MsmeSelection, b.value)}>{b.label}</button>)}</div>
      </fieldset>)}

      <h3>Documents to ask for</h3>
      <ul className="docs">{data.evidence.map(d => <li key={d.id}>{d.label}</li>)}</ul>

      <div className="passcode">
        <label htmlFor="edit-passcode">{codeLabel ?? 'Edit passcode'}</label>
        <input id="edit-passcode" type="password" autoComplete="off" value={passcode} onChange={ev => onPasscode(ev.target.value)} />
        <p className="note">Needed to save an answer or a decision.</p>
        <button type="button" onClick={onSave} disabled={busy || !selection.certificate || !selection.terms || passcode === ''}>Save answer</button>
        <p aria-live="polite" className="message">{message}</p>
      </div>

      {snap && <>
        <h3>What this means for the accounts</h3>
        {snap.notes.map((n, i) => <p key={i}>{n}</p>)}
        {snap.kind === 'interest_due' && <>
          <h4>Late bills and interest</h4>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Bill</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Days late</th><th scope="col" className="num">Interest</th></tr></thead>
            <tbody>
              {snap.bills.map(b => <tr key={b.voucher_no}><td>{b.voucher_no}</td><td className="num">{formatIndianRupees(b.amount)}</td><td className="num">{b.daysLate}</td><td className="num">{b.interest === null ? 'Not priced yet' : rupeesAndPaise(b.interest)}</td></tr>)}
              <tr><th scope="row">Total</th><td className="num">{formatIndianRupees(snap.principal ?? 0)}</td><td className="num" /><td className="num">{snap.interest === null || snap.interest === undefined ? 'Not priced yet' : rupeesAndPaise(snap.interest)}</td></tr>
            </tbody>
          </table></div>
        </>}
        {snap.kind !== 'ask_more' && <div className="approval">
          {dirty && <p className="note">Save the answer first. The outcome above is for the saved answer.</p>}
          {data.decision && <p className="decision">{data.decision.decision === 'approved' ? 'Approved' : 'Sent back'}</p>}
          <div className="actions">
            {snap.kind !== 'escalate' && !(snap.kind === 'interest_due' && (snap.interest === null || snap.interest === undefined)) && <button type="button" onClick={() => onDecide('approved')} disabled={busy || dirty || passcode === ''}>Approve</button>}
            <button type="button" className="secondary" onClick={() => onDecide('sent_back')} disabled={busy || dirty || passcode === ''}>Send back</button>
          </div>
          <p className="note">Nothing is written to the books. This records your decision only.</p>
        </div>}
      </>}
      {children}
    </>}
  </section>;
}
