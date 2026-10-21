export type MsmeSelection = { certificate?: string; size?: string; terms?: string };
type Followup = { id: string; question: string; onlyWhen?: Record<string, string>; buttons: { value: string; label: string }[] };

export function visibleMsmeFollowups<T extends Followup>(all: T[], sel: MsmeSelection): T[] {
  return all.filter(f => !f.onlyWhen || Object.entries(f.onlyWhen).every(([k, v]) => (sel as Record<string, string | undefined>)[k] === v));
}
export const msmeDirty = (selection: MsmeSelection, saved: MsmeSelection) =>
  (['certificate', 'size', 'terms'] as const).some(k => (selection[k] ?? undefined) !== (saved[k] ?? undefined));
