import { v } from 'convex/values';
import { query, internalMutation } from './functions';
import { assertSeedAllowed } from '../shared/seed-plan';
import { istDate } from '../shared/rbi-rate';

// The Bank Rate is fetched from rbi.org.in by scripts/fetch-rbi-rate.mts, stored with its date and source, and never typed in.
export const save = internalMutation({ args: { value: v.number(), date: v.string(), sourceUrl: v.string() }, handler: async (ctx, { value, date, sourceUrl }) => {
  assertSeedAllowed(process.env);
  if (!(value > 0 && value <= 25)) throw new Error('Rate refused: outside 0 to 25 percent.');
  if (date !== istDate(Date.now())) throw new Error("Rate refused: the date must be today's date in India.");
  if (!/^https:\/\/www\.rbi\.org\.in\//.test(sourceUrl)) throw new Error('Rate refused: the source must be rbi.org.in.');
  await ctx.db.insert('rbiBankRate', { value, date, sourceUrl });
  return { stored: value };
} });

export const current = query({ args: {}, handler: async (ctx) => {
  const rows = (await ctx.db.query('rbiBankRate').collect()).filter(r => r.value !== null && r.date !== null);
  rows.sort((a, b) => (a.date! < b.date! ? 1 : a.date! > b.date! ? -1 : 0));
  return rows[0] ? { value: rows[0].value as number, date: rows[0].date as string, sourceUrl: rows[0].sourceUrl as string } : null;
} });
