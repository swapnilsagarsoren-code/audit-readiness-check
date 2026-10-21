// Reads RBI's yearly press release "Meeting Schedule of the Monetary Policy Committee". The policy decision is announced on a meeting's last day.
export type Meeting = { start: string; end: string };
export type MpcSchedule = { fy: string; meetings: Meeting[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function parseMpcSchedule(html: string): MpcSchedule {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const heads = [...text.matchAll(/Dates of meetings of Monetary Policy Committee for (\d{4})-(\d{2})/g)];
  if (heads.length !== 1) throw new Error('The RBI page did not show exactly one MPC meeting schedule.');
  const startYear = Number(heads[0][1]);
  if ((startYear + 1) % 100 !== Number(heads[0][2])) throw new Error('The MPC schedule names an odd financial year.');
  // The dates run from the heading to the signature line that closes every RBI press release.
  const block = text.slice(heads[0].index! + heads[0][0].length).split(/\(\s*[A-Z][^)]*\)\s*(?:Chief )?General Manager|Press Release:/)[0];
  const meetings = [...block.matchAll(new RegExp(`(${MONTHS.join('|')}) (\\d{1,2})(?:, \\d{1,2})* and (\\d{1,2}), (\\d{4})`, 'g'))]
    .map(m => { const mo = MONTHS.indexOf(m[1]), y = Number(m[4]); return { start: iso(y, mo, Number(m[2])), end: iso(y, mo, Number(m[3])) }; });
  // A meeting written across two months would not match; refuse rather than silently drop it.
  if ((block.match(/\b20\d{2}\b/g) ?? []).length !== meetings.length) throw new Error('An MPC meeting in the schedule could not be read.');
  const fyStart = iso(startYear, 3, 1), fyEnd = iso(startYear + 1, 2, 31);
  if (meetings.length < 4 || meetings.length > 8) throw new Error('The MPC schedule did not list four to eight meetings.');
  meetings.forEach((m, i) => {
    if (m.start < fyStart || m.end > fyEnd || m.end < m.start) throw new Error('An MPC meeting falls outside the financial year.');
    if (i > 0 && m.start <= meetings[i - 1].end) throw new Error('The MPC meetings are not in date order.');
  });
  return { fy: `${startYear}-${heads[0][2]}`, meetings };
}

export function policyDates(s: MpcSchedule, today: string): { lastDecision: string | null; next: Meeting | null } {
  const past = s.meetings.filter(m => m.end <= today);
  return { lastDecision: past.length ? past[past.length - 1].end : null, next: s.meetings.find(m => m.end > today) ?? null };
}
