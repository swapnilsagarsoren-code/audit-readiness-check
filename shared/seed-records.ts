import type { Ledger, Entry, Supplier } from './accounting.ts';
export type SeedEntry = Entry & { line_no: number; amount: number };
export function numberFromCsv(s: string) {
  if (!/^\d+$/.test(s)) throw new Error('Seeding refused: amount is not integer paise.');
  const n=Number(s); if(!Number.isSafeInteger(n)) throw new Error('Seeding refused: amount exceeds safe integer range.'); return n;
}
export function decodeLedgers(rows: Record<string,string>[]): Ledger[] {
  return rows.map(r=>({ledger_name:r.ledger_name,tally_group:r.tally_group,opening_dr:numberFromCsv(r.opening_dr),opening_cr:numberFromCsv(r.opening_cr)}));
}
export function decodeEntries(rows: Record<string,string>[]): SeedEntry[] {
  const lines=new Map<string,number>();
  return rows.map(r=> {
    const dr=numberFromCsv(r.dr),cr=numberFromCsv(r.cr),line_no=(lines.get(r.voucher_no)??0)+1; lines.set(r.voucher_no,line_no);
    return {...r,dr,cr,line_no,amount:dr+cr} as SeedEntry;
  });
}
export function decodeSuppliers(rows: Record<string,string>[]): Supplier[] {
  return rows.map(r=>({supplier:r.supplier,msme_status:r.msme_status,written_credit_days:r.written_credit_days===''?null:numberFromCsv(r.written_credit_days)}));
}
export function validateLedger(l: Ledger) {
  if(!l.ledger_name || !l.tally_group || ![l.opening_dr,l.opening_cr].every(n=>Number.isSafeInteger(n)&&n>=0) || (l.opening_dr>0&&l.opening_cr>0)) throw new Error('Seeding refused: invalid ledger.');
}
export function validateEntry(e: SeedEntry) {
  if(!e.voucher_no || !e.ledger || !e.narration || !Number.isSafeInteger(e.line_no) || e.line_no<1 || ![e.dr,e.cr,e.amount].every(n=>Number.isSafeInteger(n)&&n>=0) || (e.dr>0)===(e.cr>0) || e.amount!==e.dr+e.cr || !['Sales','Purchase','Payment','Receipt','Journal','Contra'].includes(e.voucher_type) || ![e.date,e.entered_at].every(d=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/.test(d)&&Number.isFinite(Date.parse(d)))) throw new Error('Seeding refused: invalid entry.');
}
export function validateSupplier(s: Supplier) {
  if(!s.supplier || !['Micro','Small','Medium','Not registered',''].includes(s.msme_status) || (s.written_credit_days!==null && (!Number.isSafeInteger(s.written_credit_days)||s.written_credit_days<0))) throw new Error('Seeding refused: invalid supplier.');
}
