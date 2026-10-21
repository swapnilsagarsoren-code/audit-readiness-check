# M3 steps 1-4 independent review

Scope: base fee56ee, the uncommitted tree (M3 steps 1 to 4: story design, per-visitor sessions, the RBI rate button, story screens). Read-only reviewer: no project edits, no git writes, no Convex calls, no env changes. Reviewed 21 Oct 2026.

## Test runs (at review)
- npm test: 569 tests, 569 pass, 0 fail, 0 skipped (exit 0). npm run lint: clean (exit 0). npm run build: clean (exit 0). npm audit --audit-level=high: 0 vulnerabilities (exit 0). npx playwright test: 12 passed (exit 0), including story mode at 390 and 1440 px.

## Blocker
1. **One script could stop every visitor's saves for days** (convex/visitorCore.ts, guardFor). Every save purged all stale wrong-code rows across all visitors in one mutation. 20,000 wrong codes from 2,000 sessions would push that purge past Convex's 16,000-write limit, so every later save would throw. Wrong codes did not count toward the daily write cap.
2. **The daily cleanup could be made to fail forever** (convex/visitorCore.ts, cleanupExpired). It took every expired session in one run, about 7 index reads each. 1,000 expired sessions exceed Convex's 4,096-read limit. Each failed run makes the backlog bigger, so cleanup never recovers.
3. **A long-term R1 answer gave a wrong sentence and a wrong meter** (shared/story.ts, convex/storyCore.ts). Approving Rajesh Mehta as a loan repayable after 12 months said "to short-term borrowings". The current-ratio meter stayed at 1.23, though RULES_v1 says a long-term loan changes it (1.23 to 1.34). With R3 also approved, the meter showed 1.14 "breaks" where the true figure is 1.23 "holds".

## Should-fix
4. Many visitors pressing the RBI button together each read RBI, up to the 50-a-day cap. `latestRate` also read every stored check on every R2 screen, which would pass Convex's scan limit in about 21 months.
5. "RBI hasn't published the next schedule yet" becomes false once RBI publishes the 2027-28 schedule in March 2027, and the words were not in DESIGN.
6. Several on-screen phrases were not in DESIGN section 11: meter verdicts, debrief entry sentences, "No covenant effect", "Interest not priced yet.", "Couldn't check the rate. Nothing was changed.", "Couldn't read RBI's site." without a date.
7. The global caps (500 sessions, 5,000 writes, 50 RBI reads a day) can be used up by one script, because Convex functions see no client IP. Should be documented before release.

## Cosmetic
8. A comment said usage counters were deleted. They are not (3 small rows a day).
9. Dev only: a button check and a dev-script row on the same day were ordered without a time for the dev row.
10. The schedule reader silently dropped a meeting written across two months (2025-26 had one).
11. If the stored rate failed to load, the RBI block showed an empty line with no message.
12. A refused approval still used up one save of the hourly and daily allowance.
13. Release note: the public build still routes `#/gap/...` to the dev screens; keep EDIT_PASSCODE unset on production.

## Checked and fine
Visitor isolation through `by_session_flag`; sign-off code stored only as a 1,000-round salted SHA-256, compared in constant time, never returned, never stored in the browser; refusals returned not thrown; dev EDIT_PASSCODE path unchanged; `q.eq('sessionId', undefined)` matches missing fields in Convex; the index swap loses no data; all caps enforced inside mutations; the server fetches only the two fixed RBI pages (no redirects, 15 s timeout, 2 MB limit); meters 1.40 to 1.57 and 1.23 to 1.14 on the intended paths; the 2026-27 schedule parses to six meetings; IST day and hour boundaries; DESIGN words, states, 44 px targets, no sideways scroll, transform and opacity only, reduced motion, colour never the only signal; no skipped tests and no weakened earlier tests.

Unproven by tests: Convex behaviour runs on an in-memory fake (no transaction limits); `crons.ts` and function registration are checked as source text; the `rbi:check` action and a fetch to rbi.org.in from Convex's servers have never run; the browser tests mock every Convex call.

VERDICT: FAIL (three blockers, each with a small fix)

## Fixes after the review (21 Oct 2026, by Claude, checked by tests)
1. Fixed. A save now reads and prunes only that visitor's own wrong-code log (at most about 20 rows). Wrong codes count toward the 5,000-a-day write cap. The unused global index on the attempt log is removed. Tests: 20,000 other visitors' rows are untouched by one save; wrong codes reach the cap.
2. Fixed. Cleanup takes 100 expired sessions per run and schedules the next batch when more remain. Test: 150 expired sessions clear in two batches.
3. Fixed. The R1 sentence names the borrowings the server chose (long-term or short-term). The server works out the current ratio from both decisions together. Tests on the real books: long-term R1 gives 1.23 to 1.34 "holds"; long-term R1 plus the R3 split ends at 1.23 "holds".
4. Fixed. Presses within a minute of a claimed read share it (17 visitors pressing together cause one read). The newest check is read by index, so the cost stays flat.
5. Fixed, words for Swapnil to confirm: "No further meeting in RBI's 2026-27 schedule", or "No meeting schedule on file" when no schedule is stored.
6. Open: the phrases go to Swapnil for approval.
7. Documented in documentation/LIMITS.md ("Public story demo limits").
8. Fixed (comment rewritten with the batch change).
9. Fixed: rows without a check time fall back to their creation time.
10. Fixed: the reader refuses a schedule where any meeting cannot be read. Test added.
11. Fixed, words for Swapnil to confirm: "Couldn't load the stored rate. Press the button to try again."
12. Not changed: the allowance errs on the strict side and only a visitor's own refused approvals count against it.
13. Documented in documentation/LIMITS.md; part of the release gates.

After the fixes: npm test 575 of 575 pass; lint and build clean; Playwright 12 of 12 pass.
