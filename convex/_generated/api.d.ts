/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as answers from "../answers.js";
import type * as books from "../books.js";
import type * as decisions from "../decisions.js";
import type * as flags from "../flags.js";
import type * as functions from "../functions.js";
import type * as guard from "../guard.js";
import type * as msme from "../msme.js";
import type * as rates from "../rates.js";
import type * as seed from "../seed.js";
import type * as summary from "../summary.js";
import type * as termloan from "../termloan.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  answers: typeof answers;
  books: typeof books;
  decisions: typeof decisions;
  flags: typeof flags;
  functions: typeof functions;
  guard: typeof guard;
  msme: typeof msme;
  rates: typeof rates;
  seed: typeof seed;
  summary: typeof summary;
  termloan: typeof termloan;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
