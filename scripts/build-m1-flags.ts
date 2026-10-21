import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsv } from '../shared/csv.ts';
import { decodeEntries } from '../shared/seed-records.ts';
import { buildFlagInput, orderFlagEntries } from '../shared/flag-input.ts';
import type { RawFlag, RawFlagEntry, RuleId } from '../shared/flag-input.ts';

interface SpecCase {
  id: string;
  rule: RuleId;
  party: string;
  ledger: string;
  narration: string;
  group: string;
}

// This builder reads only the hand-written case fixture and synthetic day book.
export async function buildM1Flags(root = '.'): Promise<RawFlag[]> {
  const fixture = JSON.parse(await readFile(resolve(root, 'tests/fixtures/spec-cases.json'), 'utf8')) as { cases: SpecCase[] };
  const entries = decodeEntries(readCsv(await readFile(resolve(root, 'data/synthetic/daybook.csv'), 'utf8')));
  const cases = fixture.cases.filter(item => /^P\d+$/.test(item.id))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  if (cases.length !== 17 || new Set(cases.map(item => item.id)).size !== 17) {
    throw new Error('M1 fixtures refused: expected 17 distinct positive cases.');
  }
  return cases.map(item => {
    const matched = entries.filter(entry => entry.party === item.party &&
      entry.ledger === item.ledger && entry.narration === item.narration);
    if (!matched.length) throw new Error(`M1 fixtures refused: no day-book match for ${item.id}.`);
    const matchingVouchers = new Set(matched.map(entry => entry.voucher_no));
    const billReferences = new Set(matched.map(entry => `Payment against invoice ${entry.voucher_no}`));
    const ownLines = entries.filter(entry => entry.party === item.party && entry.ledger === item.ledger &&
      (matchingVouchers.has(entry.voucher_no) || (item.rule === 'R2' && billReferences.has(entry.narration))));
    const rawEntries: RawFlagEntry[] = ownLines.map(entry => ({
      date: entry.date,
      party: entry.party,
      narration: entry.narration,
      amountPaise: entry.amount,
      voucherNo: entry.voucher_no,
      lineNo: entry.line_no,
    }));
    const flag: RawFlag = {
      flagKey: item.id,
      ruleId: item.rule,
      ledgerName: item.ledger,
      tallyGroup: item.group,
      entries: rawEntries,
    };
    flag.entries = orderFlagEntries(flag).slice(0, 10);
    // Applies the fixed route and validates rupee formatting without retaining
    // anything beyond the agreed raw fixture fields.
    buildFlagInput(flag);
    return flag;
  });
}

export async function writeM1Flags(output = 'tests/fixtures/m1-flags.json', root = '.') {
  const flags = await buildM1Flags(root);
  await writeFile(resolve(output), `${JSON.stringify(flags, null, 2)}\n`);
  return flags;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const output = process.argv[2] ?? 'tests/fixtures/m1-flags.json';
    const flags = await writeM1Flags(output);
    console.log(`M1_FLAGS cases=${flags.length}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'M1 fixtures refused.');
    process.exitCode = 1;
  }
}
