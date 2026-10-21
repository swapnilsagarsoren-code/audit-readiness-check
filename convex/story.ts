import { v } from 'convex/values';
import { query } from './functions';
import { loadBooks } from './books';
import { companyFigures, storyBoard } from './storyCore';

export const board = query({ args: { sessionId: v.string() }, handler: async (ctx, { sessionId }) => storyBoard(ctx, sessionId, await loadBooks(ctx)) });
export const company = query({ args: {}, handler: async ctx => companyFigures(await loadBooks(ctx)) });
