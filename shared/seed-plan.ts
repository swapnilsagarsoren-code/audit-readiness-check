export function assertSeedAllowed(env: { SEED_ALLOWED?: string }) {
  if (env.SEED_ALLOWED !== 'dev-only') throw new Error('Seeding refused: SEED_ALLOWED is not set on this deployment.');
}
export function planUpserts<T>(existing: T[], incoming: T[], key: (row: T) => string) {
  const before = new Map(existing.map(row => [key(row), row]));
  if (before.size !== existing.length) throw new Error('Seeding refused: duplicate existing natural keys.');
  const seen = new Set<string>(); const inserts: T[] = [], updates: T[] = [];
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return JSON.stringify(value.map(canonical));
    if (value && typeof value === 'object') return JSON.stringify(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
    return JSON.stringify(value);
  };
  for (const row of incoming) {
    const k = key(row);
    if (seen.has(k)) throw new Error('Seeding refused: duplicate input natural keys.');
    seen.add(k);
    if (!before.has(k)) inserts.push(row);
    else if (canonical(before.get(k)) !== canonical(row)) updates.push(row);
    before.set(k, row);
  }
  return { inserts, updates, rows: [...before.values()] };
}
export const entryKey = (row: { voucher_no?: string; line_no?: number }) => JSON.stringify([row.voucher_no, row.line_no]);
