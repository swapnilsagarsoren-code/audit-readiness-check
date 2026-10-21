# Gate A independent review

Commit reviewed: a873a28 ("Gate A: R1-R3 flag signals, materiality ranking, evidence bundles and gaps list screen"), on 80b9038. Reviewed 20 Oct 2026, read-only.

## Test runs
- npm test: exit 0; 385 tests, 385 pass, fail 0, cancelled 0, skipped 0, todo 0.
- npm run lint: exit 0. npm run build: exit 0.
- npx playwright test: exit 0; 4 passed (gaps and placeholder at 390 and 1440 px).
- No .skip/.only/.todo/fixme in tests. No secrets in new files. No AI call in Gate A.

## Blocker
None.

## Should-fix
1. The "Related party" chip marks Mehta Family Trust (shared/rules.ts R1 related; src/GapsPage.tsx; asserted in tests/unit/rules-signals.test.ts). Draft decision row 37 says a trust is not a "relative" and DESIGN.md says never state a legal conclusion. Soften the wording ("Possible related party") or carry row 37 into Gate B.
2. Rows 34-35 must be logged before the push: the code depends on the bank-receipt-only R1 signal, the 5%/50% bands and bill-date-as-acceptance. docs/RULES_v1.md R1 still reads "(a)/(b)/(c) plus AI person-name". Name the R1 "no purchase vouchers" limit explicitly in row 34.
3. convex/flags.ts refresh is only regex-tested (tests/unit/flag-list.test.ts). Run it on dev (your-dev-deployment) and compare flags:list with the unit-test order (R3 Meridian; R1 Rajesh, Anita, Trust, Sharma; R2 Delta, Bharat) before calling Gate A done.

## Cosmetic
- R1 amount sums cr + dr, so an interest debit adds to the receipt total; no synthetic case, but separate or define before Gate B prices it.
- index.css is light-only with hard-coded colours; DESIGN.md light/dark tokens and the sticky materiality header at 390 px are not built (open question 3 covers dark mode).
- Stray `void React;` in GapsPage.tsx; `getByRole('list',{name:undefined})` in gaps.spec.ts is the same as no name filter.
- "[empty]" shows when the query returns null; the DESIGN empty sentence shows only for the zero-rows done case. Keep the two apart when the final words arrive.

## Checked and fine
- R1: exactly P1-P4 flagged (Rs 2.5 cr, 60 lakh, 50 lakh, 10 lakh); D1 and D2 not flagged; related marker from company lists only, case and spacing normalised.
- R2: Bharat Fasteners 5.6 lakh (one bill, day 68 vs 45), Delta Rubber 8 lakh (day 30 vs 15), Kumar Packaging 1.9 lakh (blank status, unpaid); D3 and D4 not flagged; written terms capped at 45 days, 0 or blank = 15; Medium and Not registered skipped.
- R3: only the Meridian term loan (closing balance Rs 9.6 cr); Unity cash credit not flagged; a named current-maturities ledger clears only its own loan; TL, Term-Loan and Termloan spellings tested.
- Materiality: overall Rs 45 lakh (PBT basis), flag line Rs 22.5 lakh, hide line Rs 2.25 lakh; integer paise with floor; guards for loss, unsafe integers and hide line above flag line; deterministic order. Kumar Packaging (1.9 lakh) dropped; Sharma and Delta shown as "below". Matches row 35.
- Convex: refresh is an internalMutation whose first statement is assertSeedAllowed(process.env); public list returns null on a half-written state; returns no secrets or answer-key data; schema change is additive (flag, flagRun); boundaries.test.ts update is legitimate.
- UI vs DESIGN.md: skeleton loading with aria-busy, role="alert" error with "Nothing here is final", empty and done states, real ordered list, band words on every row, placeholders [heading] [empty] [status] visible and tested, no banned words (test-enforced), no sideways scroll at 390/1440. The placeholder.spec.ts edit only stubs flags:list and narrows the alert locator; the exact original error text is still asserted.
- Known limits disclosed (not new findings): R3 size is the closing balance, not the 12-month split; R2 treats a payment as settling one whole bill and ignores opening payables; R1 does not test "no purchase vouchers"; bill date used as acceptance date.

## Verdict reasoning
The signals reproduce every planted positive and none of the decoys on the synthetic books. Ranking and materiality match the logged numbers. The Convex surface is dev-guarded, additive and leaks nothing. The UI follows DESIGN.md states with marked placeholders. Tests are honest and gate-clean. The open items are wording, logging and one unrun dev check, none of which breaks a rule or produces a wrong number.

VERDICT: PASS
