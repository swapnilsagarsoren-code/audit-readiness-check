# R2 and R3 independent review

Commit reviewed: d4444f4 ("R2 and R3: MSME late payment with RBI-rate interest, term-loan split with current ratio, code-written questions and screens"), on bc6c568. HEAD at review was c115204, which only regenerates the Convex api types. Read-only: no edits, no git writes, no Convex mutations or deploys; only `convex run` queries and scratch probes.

## Test runs
- npm test: 505 tests, 505 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo (exit 0). npm run lint: clean (exit 0). npm run build: tsc, convex tsc and vite clean (exit 0). npm audit --audit-level=high: 0 vulnerabilities (exit 0).
- npx playwright test: run 1 overlapped with the reviewer's other commands: 9 passed, 1 failed (termloan 1440 px, "Tearing down context exceeded the test timeout of 30000ms", exit 1). Run 2 alone: 10 passed, 0 failed (exit 0). Read as a load-related teardown timeout, not an assertion failure.

## Blocker
None.

## Should-fix
1. R3 crashed when the loan had a balance but no instalments left: due12 was 0 and the ratio function threw, so the screen showed "Couldn't load". (Fixed after the review: now cannot_compute with a plain note.)
2. computeSplit counts only this year's booked instalments, so a loan that started before the year gives wrong paid and remaining counts, and interest inside an instalment entry inflates the instalment. The note said only "equal instalments". (Disclosure widened on screen and in PROGRESS.md after the review.)
3. The R2 note "No agreed interest rate is on file" was an unhedged statement; the app has no field for an agreed rate and s.16 applies notwithstanding any agreement. (Reworded after the review to "This screen does not record an agreed interest rate".)

## Cosmetic
- When the answered terms differ from the supplier master (Bharat Fasteners), the first table and the outcome table can list different bills; correct by design, a one-line "on the terms you gave" caption would help.
- The tax note always cites s.43B(h) with no financial-year switch (RULES_v1 lists s.37(2)(g) of the 2025 Act for FY2026-27); fine for FY2025-26.
- rates:save does not check the date format, two rows with the same date resolve in arbitrary order, and the fetch script does not cap the response size.
- The Playwright tests mock Convex, so they prove the UI, not the backend.

## Checked and fine
- R2 detection: bill date as acceptance; written terms capped at 45 days; blank or 0 days gives 15; answered terms override the master; unpaid bills run to year end; Medium and Not registered skipped; payments matched by voucher token then oldest unmatched bill, one whole bill per payment (disclosed limit).
- Indicative interest recomputed by hand: Delta Rubber 567,123 paise; Kumar Packaging 336,885 paise (one 30-day month plus 7 days); Bharat Fasteners on "up to 30 days" 1,019,770 paise; 100, 65, 29, 30 and 365 days identical to an independent function. The 30-day-month method and the current-rate-only limit are stated on screen.
- Outcome table matches RULES_v1: Micro and Small priced; Medium and Not registered no interest; unknown or not sure escalates and is never approvable; approval refused with not_priced while the rate is null; legal and tax statements end "controller to confirm"; the rate is read from the stored row, never typed in.
- RBI rate: parseBankRate reads the fixture and the live rbi.org.in page (HTTP 200, 5.75); rejects missing, duplicate, zero, above 25 and Bank Rate versus Marginal Standing Facility mismatches, and a "Fixed Bank Rate" trap line. The fetch script uses a fixed host, redirect manual with non-200 refused, a 30-second timeout and the hard-coded dev deployment; no secret. rates:save is an internal mutation behind assertSeedAllowed and limited to rbi.org.in.
- R3: computeSplit returns null (cannot_compute) for a moratorium with no principal yet, no stated instalment count or a zero balance; due12 capped at the balance; current-ratio groups cover every group in the seed; floor is >= so exactly 1.20 is within; only a confirmed split (both documents or the schedule only) can be approved, an estimate allows Send back only.
- Security: guard first in record and decide, refusals returned not thrown, stale-answer check, snapshot recomputed on the server, validators are literal unions, nothing written to the books, no passcode stored or returned, schema change additive (four new tables), no secrets in the new diff.
- UI: fieldset and legend, aria-pressed, scope on headers, aria-live; loading, error and missing states; 44 px targets and no sideways scroll at 390 and 1440 px; no banned words; password field.
- Tests: no skip, only or todo; earlier tests not weakened (answers-api guard text moved to guard.ts and is equal or stronger; boundaries has the four new tables; gaps-page flipped because R2 and R3 rows now link). Convex behaviour is covered only by text and regex tests; browser tests mock Convex.
- Live dev (read-only): Delta Rubber stored answer certificate yes, size small, terms none; snapshot interest_due, 567,123 paise at 5.75% (stored 20 Oct 2026, rbi.org.in); approved. Meridian stored answer documents both; split Rs 24 cr (balance Rs 96 cr, 12 paid, 48 left, Rs 2 cr each); current ratio 1.2292 to 1.1385 against the 1.20 floor; approved. Matches spec A3 (1.23 to 1.14).

## Verdict reasoning
No blocker. The accounting was reproduced by hand, the security model matches Gate B, and the dev data matches the owner's run. The three should-fix items are an edge-case crash that failed safe and two missing disclosures; none produces a wrong number on the synthetic books. The single Playwright failure was a load-related teardown timeout that passed on a clean rerun.

VERDICT: PASS
