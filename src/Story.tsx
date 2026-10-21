import * as React from 'react';
import { formatCroreLakh } from './gaps-data.ts';
import { isValidCode } from '../shared/visitor.ts';
import { isDecided, nextStep, rbiLine, rbiMessage, STATUS_WORDS, type CompanyFigures, type RbiStatus, type StoryBoard, type StoryCard, type StoryRate } from '../shared/story.ts';

export const WRITE_UP = 'https://hq.swapnilsoren.com/builds/audit-readiness-check';
const CODE = 'https://github.com/swapnilsagarsoren-code/audit-readiness-check';

export function StoryShell({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return <main className="story" aria-busy={busy}>
    {children}
    <footer className="story-foot">Synthetic company and data. Nothing here is advice.</footer>
  </main>;
}

type Meters = StoryBoard['meters'];
// Debt-equity is a ceiling (higher is worse); the current ratio is a floor (lower is worse).
const METERS = [
  { key: 'debtEquity', label: 'Debt-equity', min: 0, max: 2, word: 'limit', mark: (m: Meters) => m.debtEquity.limit, now: (m: Meters) => m.debtEquity.now, worse: 'above' },
  { key: 'currentRatio', label: 'Current ratio', min: 0.8, max: 1.6, word: 'floor', mark: (m: Meters) => m.currentRatio.floor, now: (m: Meters) => m.currentRatio.now, worse: 'below' },
] as const;
const share = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
function covenant(value: number, mark: number, worse: 'above' | 'below', word: string) {
  const breaks = worse === 'above' ? value > mark : value < mark;
  const side = value === mark ? 'at' : breaks ? worse : worse === 'above' ? 'within' : 'above';
  return { breaks, verdict: `${side} the ${mark.toFixed(2)} ${word}` };
}
const sentence = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Meters({ meters }: { meters: Meters }) {
  return <div className="meters" role="group" aria-label="Loan covenants">
    {METERS.map(m => {
      const value = m.now(meters), mark = m.mark(meters), at = share(mark, m.min, m.max) * 100;
      const { breaks, verdict } = covenant(value, mark, m.worse, m.word);
      return <div key={m.key} className={`meter${breaks ? ' breaks' : ''}`} role="meter" aria-label={m.label} aria-valuenow={Number(value.toFixed(2))} aria-valuemin={m.min} aria-valuemax={m.max} aria-valuetext={`${value.toFixed(2)}, ${verdict}`}>
        <div className="meter-head"><span className="meter-label">{m.label}</span><span className="meter-value">{value.toFixed(2)}</span></div>
        <div className="meter-track" aria-hidden="true">
          <div className="meter-bad" style={m.worse === 'above' ? { left: `${at}%`, right: 0 } : { left: 0, right: `${100 - at}%` }} />
          <div className="meter-fill" style={{ transform: `scaleX(${share(value, m.min, m.max)})` }} />
          <div className="meter-mark" style={{ left: `${at}%` }} />
        </div>
        <div className="meter-scale" aria-hidden="true"><span style={{ left: `${at}%` }}>{mark.toFixed(2)}</span></div>
        <p className="meter-verdict">{sentence(verdict)}</p>
      </div>;
    })}
  </div>;
}

function Card({ c, i, link, chip, rise }: { c: StoryCard; i: number; link: boolean; chip: boolean; rise: boolean }) {
  const meta = [c.amount === null ? null : formatCroreLakh(c.amount, 'crore'), c.party].filter(Boolean).join(', ');
  const body = <>
    <span className="card-title">{c.title}</span>
    {meta && <span className="card-meta">{meta}</span>}
    {chip && <span className={`chip status-${c.status}`}>{STATUS_WORDS[c.status]}</span>}
  </>;
  return <li className={`story-card${rise ? ' rise' : ''}`} style={{ '--i': i } as React.CSSProperties}>
    {link ? <a className="card-inner" href={`#/story/case/${encodeURIComponent(c.flagKey)}`}>{body}</a> : <div className="card-inner">{body}</div>}
  </li>;
}

export function Briefing({ board, code, busy, message, onCode, onStart }: { board: StoryBoard; code: string; busy: boolean; message: string; onCode: (v: string) => void; onStart: () => void }) {
  return <StoryShell>
    <div className="story-layout">
      <header className="story-head">
        <h1>Your first week as controller.</h1>
        <p className="story-line">Northfield's books close for audit soon. Three entries look wrong. Find out what they are, decide, and see what each answer does to the loan covenants.</p>
      </header>
      <aside className="story-side"><Meters meters={board.meters} /></aside>
      <div className="story-body">
        <ul className="story-cards">{board.cases.map((c, i) => <Card key={c.flagKey} c={c} i={i} link={false} chip={false} rise />)}</ul>
        <a className="story-next" href="#/story/company">See the company's accounts</a>
        <form className="story-code" onSubmit={e => { e.preventDefault(); if (isValidCode(code) && !busy) onStart(); }}>
          <label htmlFor="story-code">Pick a sign-off code.</label>
          <p className="note" id="story-code-help">You'll enter it each time you approve something, the way a controller signs off. It stays in this browser session and is never shared. Any 4 to 20 characters.</p>
          <input id="story-code" type="password" autoComplete="off" aria-describedby="story-code-help" value={code} onChange={e => onCode(e.target.value)} />
          <button type="submit" disabled={busy || !isValidCode(code)}>Start the clock</button>
          <p aria-live="polite" className="message">{message}</p>
        </form>
      </div>
    </div>
  </StoryShell>;
}

export function CaseBoard({ board, enter }: { board: StoryBoard; enter: boolean }) {
  // Cards rise in once per visit; coming back from a case does not replay it.
  const [rise] = React.useState(enter);
  return <StoryShell>
    <div className="story-layout">
      <header className="story-head">
        <h1>Case board</h1>
        {board.cases.every(c => isDecided(c.status)) && <div className="story-done rise">
          <p className="story-line">All three cases decided.</p>
          <a className="story-go" href="#/story/debrief">See your debrief →</a>
        </div>}
      </header>
      <aside className="story-side"><Meters meters={board.meters} /></aside>
      <div className="story-body">
        <ul className="story-cards">{board.cases.map((c, i) => <Card key={c.flagKey} c={c} i={i} link chip rise={rise} />)}</ul>
        <p className="story-links"><a href="#/story/debrief">Go to the debrief</a><a href="#/story/company">See the company's accounts</a></p>
      </div>
    </div>
  </StoryShell>;
}

export function Debrief({ board, rbi, settle = true, onPlayAgain }: { board: StoryBoard; rbi: React.ReactNode; settle?: boolean; onPlayAgain: () => void }) {
  // The one celebration: a single settle the first time the debrief shows every case decided.
  const [once] = React.useState(settle);
  const allDecided = board.cases.every(c => isDecided(c.status));
  const { debtEquity: de, currentRatio: cr } = board.meters;
  const breaks = de.now > de.limit || cr.now < cr.floor;
  return <StoryShell>
    <a className="back" href="#/story">← Case board</a>
    <div className="story-layout">
      <header className="story-head">
        <h1 className={allDecided && once ? 'settle' : undefined}>Audit-ready?</h1>
        <p className="story-line">Here's what you decided, and what each decision did to the covenants.</p>
      </header>
      <aside className="story-side"><Meters meters={board.meters} /></aside>
      <div className="story-body">
        <ol className="debrief-rows">{board.cases.map((c, i) => {
          const decided = isDecided(c.status);
          return <li key={c.flagKey} className="debrief-row rise" style={{ '--i': i } as React.CSSProperties}>
            <span className="card-title">{c.title}</span>
            <span className={`chip status-${decided ? c.status : 'open'}`}>{decided ? STATUS_WORDS[c.status] : 'Not decided yet'}</span>
            {c.line?.entry && <p>{c.line.entry}</p>}
            {c.line?.effect && <p>{c.line.effect}</p>}
          </li>;
        })}</ol>
        {breaks && <p className="story-honest">The covenant breaks because the books are now right, not because the controller failed.</p>}
        {rbi}
        <div className="story-end">
          {allDecided && <><h2>Case closed.</h2>
          <p>That's your first week. Fixed rules worked out every number from the books; you made every call.</p></>}
          <p className="story-links"><a href={WRITE_UP}>Read how it was built</a><button type="button" onClick={onPlayAgain}>Play again</button><a href={CODE}>See the code</a></p>
        </div>
      </div>
    </div>
  </StoryShell>;
}

export function NextCase({ flagKey }: { flagKey: string }) {
  const n = nextStep(flagKey);
  return <p className="story-after rise">{n.kind === 'case'
    ? <a className="story-go" href={`#/story/case/${encodeURIComponent(n.flagKey)}`}>{`Next case: ${n.title} →`}</a>
    : <a className="story-go" href="#/story">Back to the case board →</a>}</p>;
}

export type CompanyState = { status: 'loading' | 'error' } | { status: 'ready'; data: CompanyFigures };
const CRORE = 1_00_00_000_00, LAKH = 1_00_000_00;
const oneDecimal = (paise: number) => Math.abs(paise) >= CRORE ? `₹${(paise / CRORE).toFixed(1)} crore` : `₹${(paise / LAKH).toFixed(1)} lakh`;
const days = (d: number) => `${Math.round(d)} days`;
type Row = [label: string, value: string, note?: string];
function companyTables({ profitAndLoss: p, balanceSheet: b, ratios: r, audit: a }: CompanyFigures): [string, Row[]][] {
  return [
    ['Profit and loss', [['Revenue', oneDecimal(p.revenue)], ['Materials', oneDecimal(p.materials)], ['Direct costs', oneDecimal(p.directCosts)], ['Other expenses', oneDecimal(p.otherExpenses)], ['Other income', oneDecimal(p.otherIncome)], ['Profit before tax', oneDecimal(p.pbt)]]],
    ['Balance sheet', [['Fixed assets', oneDecimal(b.fixedAssets)], ['Inventory', oneDecimal(b.inventory)], ['Receivables', oneDecimal(b.receivables)], ['Cash and bank', oneDecimal(b.cashAndBank)], ['Equity', oneDecimal(b.equity)], ['Borrowings', oneDecimal(b.borrowings)], ['Trade payables', oneDecimal(b.tradePayables)]]],
    ['Ratios', [
      ['Profit margin', `${(r.profitMargin * 100).toFixed(1)}%`],
      ['Debt-equity', r.debtEquity.toFixed(2), sentence(covenant(r.debtEquity, r.debtEquityCap, 'above', 'limit').verdict)],
      ['Current ratio', r.currentRatio.toFixed(2), sentence(covenant(r.currentRatio, r.currentFloor, 'below', 'floor').verdict)],
      ['Receivable days', days(r.receivableDays)], ['Inventory days', days(r.inventoryDays)], ['Payable days', days(r.payableDays)],
    ]],
    ['Audit lens', [['Materiality', oneDecimal(a.materiality)], ['Flag line', oneDecimal(a.flagLine)]]],
  ];
}

export function CompanyPage({ state, back, onRetry }: { state: CompanyState; back: string; onRetry: () => void }) {
  return <StoryShell busy={state.status === 'loading'}>
    <a className="back" href="#/story">{back}</a>
    <div className="company">
      <h1>Northfield's books, <span className="nowrap">FY2025-26</span></h1>
      {state.status === 'loading' && <div className="company-grid" aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div>}
      {state.status === 'error' && <><p role="alert">Couldn't load the story, so nothing here is final.</p><button type="button" onClick={onRetry}>Try again</button></>}
      {state.status === 'ready' && <>
        <p className="story-line">Year-end trial balance as booked, before your three decisions. Synthetic company.</p>
        <div className="company-grid">{companyTables(state.data).map(([title, rows], i) => <div key={title} className="company-group rise" style={{ '--i': i } as React.CSSProperties}>
          <h2 id={`company-${i}`}>{title}</h2>
          <div className="table-wrap"><table aria-labelledby={`company-${i}`}><tbody>{rows.map(([label, value, note]) => <tr key={label}>
            <th scope="row">{label}{note && <span className="note">{note}</span>}</th>
            <td className="num">{value}</td>
          </tr>)}</tbody></table></div>
        </div>)}</div>
      </>}
    </div>
  </StoryShell>;
}

export function StorySkeleton() {
  return <div className="story-layout" aria-hidden="true">
    <header className="story-head"><div className="skeleton line" /></header>
    <aside className="story-side"><div className="skeleton" /><div className="skeleton" /></aside>
    <div className="story-body"><ul className="story-cards">{[0, 1, 2].map(i => <li key={i} className="skeleton" />)}</ul></div>
  </div>;
}

type Check = { status: RbiStatus; rate: StoryRate };
export function RbiBlock({ load, check, onFresh }: { load: () => Promise<StoryRate>; check: () => Promise<Check>; onFresh?: () => void }) {
  const [rate, setRate] = React.useState<StoryRate | undefined>(undefined), [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let live = true;
    load().then(r => { if (live) setRate(r); }, () => { if (live) setMessage("Couldn't load the stored rate. Press the button to try again."); });
    return () => { live = false; };
  }, [load]);
  async function press() {
    setBusy(true); setMessage('');
    try {
      const r = await check();
      setRate(r.rate); setMessage(rbiMessage(r.status, r.rate));
      if (r.status === 'fresh') onFresh?.();
    } catch { setMessage("Couldn't check the rate. Nothing was changed."); }
    setBusy(false);
  }
  return <div className="rbi">
    <button type="button" onClick={() => void press()} disabled={busy}>Check today's RBI rate</button>
    <p className="note">{rate === undefined ? '' : rbiLine(rate)}</p>
    <p aria-live="polite" className="message">{message}</p>
  </div>;
}
