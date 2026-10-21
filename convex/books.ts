import type { Entry } from '../shared/accounting';
import type { MaterialityInputs } from '../shared/materiality';
import type { RuleData } from '../shared/rules';

// The one place the stored tables are turned into the shape the rules use. Reads every ledger, entry and supplier (fine at demo size).
export type Books = { data: RuleData & { company: { materialityInputs: MaterialityInputs } }; covenants: { currentRatio: number; debtEquity: number } };
export async function loadBooks(ctx: { db: any }): Promise<Books> {
  const companies = await ctx.db.query('company').collect();
  if (companies.length !== 1) throw new Error('Books refused: expected exactly one company.');
  const c = companies[0];
  if (!c.start || !c.end || !c.shareholders || !c.relatives || !c.covenantThresholds) throw new Error('Books refused: incomplete company record.');
  const ledgers = (await ctx.db.query('ledger').collect()).map((l: any) => ({ ledger_name: l.ledger_name, tally_group: l.tally_group, opening_dr: l.opening_dr ?? 0, opening_cr: l.opening_cr ?? 0 }));
  const entries = (await ctx.db.query('entry').collect()).map((e: any) => {
    if (e.ledger === undefined || e.dr === undefined || e.cr === undefined || e.voucher_no === undefined) throw new Error('Books refused: incomplete entries.');
    return e as Entry;
  });
  const suppliers = (await ctx.db.query('supplier').collect()).map((s: any) => ({ supplier: s.supplier, msme_status: s.msme_status, written_credit_days: s.written_credit_days }));
  return {
    data: { company: { start: c.start, end: c.end, directors: c.directors, relatives: c.relatives, shareholders: c.shareholders, materialityInputs: c.materialityInputs }, ledgers, entries, suppliers } as Books['data'],
    covenants: { currentRatio: c.covenantThresholds.currentRatio, debtEquity: c.covenantThresholds.debtEquity },
  };
}
