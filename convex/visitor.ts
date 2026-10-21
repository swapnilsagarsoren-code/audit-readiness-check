import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { query, mutation, internalMutation } from './functions';
import { startSession, cleanupExpired } from './visitorCore';

const SESSION_TABLES = ['answer', 'outcome', 'msmeAnswer', 'msmeOutcome', 'termLoanAnswer', 'termLoanOutcome'];

export const start = mutation({ args: { sessionId: v.string(), code: v.string() }, handler: (ctx, args) => startSession(ctx, args) });

export const status = query({ args: { sessionId: v.string() }, handler: async (ctx, { sessionId }) => {
  const s = await ctx.db.query('visitorSession').withIndex('by_session', (q) => q.eq('sessionId', sessionId)).unique();
  if (!s) return { exists: false, expiresAt: null, expired: false };
  return { exists: true, expiresAt: s.expiresAt, expired: s.expiresAt < Date.now() };
} });

const cleanupRef = makeFunctionReference<'mutation'>('visitor:cleanup');
export const cleanup = internalMutation({ args: {}, handler: async (ctx) => {
  const r = await cleanupExpired(ctx, SESSION_TABLES);
  if (r.more) await ctx.scheduler.runAfter(0, cleanupRef, {});
  return r;
} });
