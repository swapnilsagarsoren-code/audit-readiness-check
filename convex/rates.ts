import { v } from 'convex/values';
import { query, internalMutation } from './functions';
import { assertSeedAllowed } from '../shared/seed-plan';
import { istDate } from '../shared/rbi-rate';
import { latestRate } from './rbiCore';

// The Bank Rate is fetched from rbi.org.in by scripts/fetch-rbi-rate.mts, stored with its date and source, and never typed in.
export const save = internalMutation({ args: { value: v.number(), date: v.string(), sourceUrl: v.string() }, handler: async (ctx, { value, date, sourceUrl }) => {
  assertSeedAllowed(process.env);
  if (!(value > 0 && value <= 25)) throw new Error('Rate refused: outside 0 to 25 percent.');
  if (date !== istDate(Date.now())) throw new Error("Rate refused: the date must be today's date in India.");
  if (!/^https:\/\/www\.rbi\.org\.in\//.test(sourceUrl)) throw new Error('Rate refused: the source must be rbi.org.in.');
  await ctx.db.insert('rbiBankRate', { value, date, sourceUrl });
  return { stored: value };
} });

export const current = query({ args: {}, handler: (ctx) => latestRate(ctx) });
