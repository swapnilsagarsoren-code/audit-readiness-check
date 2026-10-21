type Row = Record<string, unknown> & { _id: string };

// A small in-memory stand-in for ctx.db: tables, withIndex(eq/gte/lt), collect, unique, insert, replace, delete.
export function fakeDb(seed: Record<string, Record<string, unknown>[]> = {}) {
  const tables = new Map<string, Row[]>(Object.entries(seed).map(([name, rows]) => [name, rows.map((r, i) => ({ _id: `${name}:${i}`, ...r }))]));
  let next = 1000;
  const rows = (table: string) => { if (!tables.has(table)) tables.set(table, []); return tables.get(table)!; };
  const db = {
    query(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const api = {
        withIndex(_name: string, build: (q: unknown) => unknown) {
          const q = {
            eq: (f: string, v: unknown) => { filters.push(r => r[f] === v); return q; },
            gte: (f: string, v: number) => { filters.push(r => (r[f] as number) >= v); return q; },
            lt: (f: string, v: number) => { filters.push(r => (r[f] as number) < v); return q; },
          };
          build(q);
          return api;
        },
        collect: async () => rows(table).filter(r => filters.every(f => f(r))).map(r => ({ ...r })),
        unique: async () => {
          const found = rows(table).filter(r => filters.every(f => f(r)));
          if (found.length > 1) throw new Error('unique() matched more than one row');
          return found[0] ? { ...found[0] } : null;
        },
      };
      return api;
    },
    insert: async (table: string, doc: Record<string, unknown>) => { const _id = `${table}:${next++}`; rows(table).push({ _id, ...doc }); return _id; },
    replace: async (id: string, doc: Record<string, unknown>) => {
      for (const list of tables.values()) { const i = list.findIndex(r => r._id === id); if (i >= 0) { list[i] = { _id: id, ...doc }; return; } }
      throw new Error('replace: no such row');
    },
    delete: async (id: string) => { for (const list of tables.values()) { const i = list.findIndex(r => r._id === id); if (i >= 0) { list.splice(i, 1); return; } } },
  };
  return { db, rows: (table: string) => rows(table).map(r => ({ ...r })) };
}
