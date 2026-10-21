export type MsmeSelection = { certificate?: string; size?: string; terms?: string };
type Followup = { id: string; question: string; onlyWhen?: Record<string, string>; buttons: { value: string; label: string }[] };

export function visibleMsmeFollowups<T extends Followup>(all: T[], sel: MsmeSelection): T[] {
  return all.filter(f => !f.onlyWhen || Object.entries(f.onlyWhen).every(([k, v]) => (sel as Record<string, string | undefined>)[k] === v));
}
export const msmeDirty = (selection: MsmeSelection, saved: MsmeSelection) =>
  (['certificate', 'size', 'terms'] as const).some(k => (selection[k] ?? undefined) !== (saved[k] ?? undefined));
// Money in the table: whole paise to rupees with two decimals, Indian grouping.
export function rupeesAndPaise(paise: number): string {
  const rupees = Math.floor(paise / 100).toString(), p = (paise % 100).toString().padStart(2, '0');
  const lead = rupees.slice(0, -3).replace(/\B(?=(?:\d{2})+$)/g, ',');
  return `₹${lead ? `${lead},` : ''}${rupees.slice(-3)}.${p}`;
}
