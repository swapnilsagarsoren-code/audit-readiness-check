import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { action, internalMutation, internalQuery, query } from './functions';
import { claimCheck, fetchRbi, latestRate, runCheck, storeCheck } from './rbiCore';

const claimRef = makeFunctionReference<'mutation'>('rbi:claim');
const storeRef = makeFunctionReference<'mutation'>('rbi:store');
const latestRef = makeFunctionReference<'query'>('rbi:latestInternal');
const stored = { value: v.number(), date: v.string(), sourceUrl: v.string(), lastDecision: v.union(v.string(), v.null()), nextStart: v.optional(v.string()), nextEnd: v.optional(v.string()), scheduleUrl: v.string(), scheduleFy: v.string() };

export const claim = internalMutation({ args: { sessionId: v.string() }, handler: (ctx, { sessionId }) => claimCheck(ctx, sessionId) });
export const store = internalMutation({ args: stored, handler: (ctx, row) => storeCheck(ctx, row) });
export const latestInternal = internalQuery({ args: {}, handler: (ctx) => latestRate(ctx) });
export const latest = query({ args: {}, handler: (ctx) => latestRate(ctx) });

export const check = action({ args: { sessionId: v.string() }, handler: (ctx, { sessionId }) => runCheck({
  claim: () => ctx.runMutation(claimRef, { sessionId }),
  fetchText: fetchRbi,
  store: (row) => ctx.runMutation(storeRef, row),
  latest: () => ctx.runQuery(latestRef, {}),
}) });
