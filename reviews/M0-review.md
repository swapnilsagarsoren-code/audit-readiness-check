# M0 review

Commit reviewed: e7418d0b64d99620ee2978b795ec061664b93506
Date: 14 Oct 2026
Reviewer: independent agent (did not write the code)

## What I ran

All runs were on a fresh Linux copy of the commit (`/tmp/claude-0/review-m0/run-indep`), using Node v24.15.0 (the pinned version) and npm 10.9.4. The repo copy is a `git archive`, so there is no git history to search. Instead I searched all 56 committed files directly.

- `npm ci`: EXIT_CODE=0, "found 0 vulnerabilities".
- `npm test`: EXIT_CODE=0. Whole-line matches found: `ℹ tests 103`, `ℹ pass 103`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, `ℹ todo 0`.
- `node --import tsx --test --test-reporter=spec tests/unit/*.test.ts` (direct, Node 24): EXIT_CODE=0, with the same six lines (103 / 103 / 0 / 0 / 0 / 0).
- `npm run build` (tsc -b, Convex tsconfig check, vite build): EXIT_CODE=0, "✓ 79 modules transformed", "✓ built".
- `npm audit --audit-level=high`: EXIT_CODE=0, "found 0 vulnerabilities". `npm run lint` (oxlint): no warnings.
- Regenerated data with `node --import tsx scripts/generate-synthetic.ts <tmp>`:
  - `sha256sum -c SHA256SUMS` passed for all 4 files.
  - `diff -r` against the committed `data/` (synthetic and answer-key) showed no differences.
  - A second run under `TZ=Pacific/Kiritimati LC_ALL=fr_FR.UTF-8` was also byte-identical, so the output does not depend on time zone or locale.
  - No BOM and no CR characters in any file.
- Independent Python check of the committed CSVs. This did not use the builder's code. It used my own mapping of Tally groups. All amounts are integer paise.
  - 94 ledgers, 2,624 lines, 36 suppliers. 1,308 vouchers, 0 unbalanced. Opening TB nets to 0.
  - Closing TB: Dr = Cr = 229,150,000,000 paise.
  - Revenue from operations is exactly ₹150,00,00,000. PBT is exactly ₹9,00,00,000.
  - Cost mix: materials 63.00%, employee 10.50%, depreciation 3.00% (2.83% on opening assets), finance 1.50%, other 16.10%. All are inside the A1 bands.
  - The only expense journal outside payroll, depreciation and stock is NF-01262: ₹40,00,000 professional-fee provision, which is ≤ ₹50 lakh. The largest single expense line is the planted ₹1.2 cr R4 case.
  - Receivables ₹27 cr = 65.7 days. Inventory ₹9 cr = 34.8 days. Stores ₹0.5 cr. Net fixed assets ₹18.5 cr. Opening gross block ₹45 cr and accumulated depreciation ₹27 cr. Opening retained earnings ₹4.2 cr.
  - Equity 15.2, debt 21.3, current liabilities 30.1, current assets 37.0 (36.6 if the FD is left out).
    - As booked: current ratio 1.229 (1.216 without the FD), debt-equity 1.401.
    - After R3 alone: current ratio 1.138.
    - After R1 alone: debt-equity 1.599.
    - All three A3 checks pass. Equity is ≤ ₹20 cr.
  - Busiest party apart from Zenvar: Avenor Utilities, with 5.03% of lines (cap 20%). 10 customers and 3 posting users.
  - Only Rajesh Mehta, Anita Mehta, Mehta Family Trust and Sharma Traders receive bank money into creditor or unsecured-loan ledgers.
  - Sales lines that contain R5 keywords are only the 6 planted ones. Repairs lines that are ≥ ₹20 lakh or contain R4 words are only the 3 planted ones.
  - The only Micro, Small or blank-status suppliers are the planted or decoy cases.
  - Supplier payment ages: 55 days for all background bills. Day-end bank balance never falls below ₹0.10 cr.
- Mutation checks, to confirm the tests can fail. Each change was made on a separate scratch copy:
  - Changing the P9 narration: 4 tests fail.
  - Weakening `assertSeedAllowed`: 2 fail.
  - Showing "TB balanced: no" while loading: 3 fail.
  - Adding a `flag` table: 1 fails.
  - Adding an answer-key path to `convex/`: 1 fails.
  - Raising the balancing provision above ₹50 lakh: the generator throws and writes nothing.
- Greps across all committed files found:
  - no `/Users/`, `/home/` or `/tmp/` paths;
  - no keys or tokens (only refusal lists and fake test values);
  - no answer-key path in `src/`, `convex/`, `shared/` or `scripts/seed*`;
  - none of the banned words in `src/` ("platform" appears only in comments in Convex's generated files);
  - no `.skip`, `.only` or `.todo`;
  - no AI SDK in `package-lock.json`;
  - no CLI-written section in `AGENTS.md`.
- Builder's evidence I checked:
  - Mac browser run: "2 passed (9.7s)", EXIT_CODE=0, no failed, skipped or flaky lines.
  - Seed: `SEED_RESULT ledgers=94 entries=2624 suppliers=36`, EXIT_CODE=0.
  - `live-summary.txt` (94 ledgers, 1,308 vouchers, Dr = Cr = 229,150,000,000) matches my own numbers exactly.
  - `gate.md` A1–A3 figures match my own numbers exactly.

## Checklist (REVIEW_PROTOCOL items 1–9)

1. **Rules fidelity:** OK for M0.
   - There are no outcomes in the app.
   - The `rule` table has `effectiveFrom` and `fy`.
   - Answer-key options come from RULES_v1 or THEMES (one wording note under Cosmetic).
2. **Numbers:** OK.
   - Tax rate and RBI Bank Rate are stored as `null`, with a source note.
   - Materiality inputs are stored as 100 / 500 / 5000 / 500 basis points. This matches PLAN §7. The gate's information-only maths (₹45 lakh / ₹22.5 lakh / ₹2.25 lakh) is correct.
   - There is no materiality test.
3. **AI safety:** N/A for M0. There is no AI call and no AI dependency.
4. **Data:** OK.
   - All data is synthetic, and generated names are fictional.
   - The real-company list appears only in a test that makes sure those names are absent. Real comparables (ACMA, CRISIL, Marathwada, IM Gears) appear only in the approved spec text.
   - The answer key is never imported by the client, Convex or seed code.
5. **Tests honesty:** OK.
   - Raw outputs are in files. The gate lines are clean.
   - Planted cases are checked against the hand-written fixture, not `planted.json`.
   - The guard tests classify hits by fixture party, ledger and narration, without reading the answer key.
   - The browser test uses mocked HTTP fixtures. This is labelled plainly in the spec file, README, PROGRESS and gate.md. `live-summary.txt` covers the seeded data, and its numbers match my own. One evidence gap is listed under Should-fix.
6. **Security:** OK.
   - The only public function is the read-only `summary:get`. It returns name, FY, counts and Dr/Cr only.
   - `seedSynthetic` and `counts` are internal and gated by `SEED_ALLOWED === "dev-only"`, which fails closed.
   - The runner refuses any non-`dev:` selector, `prod`/`local`/`anonymous` names, any name other than the approved dev name, and deploy keys or self-hosted selectors. Its refusal messages contain no secrets.
   - Every Convex CLI call names the deployment.
   - npm audit shows 0 vulnerabilities.
   - Loading and error states show "—" and no balance verdict.
7. **Scope:** OK.
   - Exactly 7 tables.
   - No flag, question, answer, outcome or reclassProposal table.
   - No rules engine.
   - PROGRESS.md has the M0 line and a Parked list.
8. **Words:** OK. None of the banned words appear in `src/`.
9. **Release:** N/A for M0. There is no prod release. Dev deployment names are explicit everywhere.

M0 prompt acceptance items:

- `aiFiles.enabled: false`: OK. I checked it is a valid key in Convex 1.46.
- Pinned versions, lockfile, `.nvmrc` and `engines`: OK.
- Generator determinism rules: OK.
- `assertSeedAllowed`: OK. All 5 cases are tested and the exact refusal message is used.
- Natural-key upsert planning and its tests: OK.
- Internal seed mutation that checks the guard first: OK.
- Chunked `convex run --deployment` loading: OK. No `convex import` is used.
- Placeholder page states and error wording: OK. 390 px and 1440 px pass on the Mac.
- Test list: OK.
- `.gitignore`: OK.
- `reviews/README.md`: OK.
- HARD RULES: OK.
- Linux clean-install test: OK. The builder could not run it; I ran it and it passed.

## Blocker

None.

## Should-fix

1. **README describes the seed as not run, which is no longer true.** `README.md:14`
   - It says the seed runner "has NOT been run" and "Swapnil runs the seed after reviewing the gate evidence".
   - In the same commit, `PROGRESS.md:3` and the seed evidence say it ran on `your-dev-deployment` with EXIT_CODE=0.
   - Why it matters: the public front page of the repo contradicts the progress file. Status text should match the evidence.
   - Fix: update the paragraph.

2. **Evidence for live data shown on the page is thin.** `evidence/live-summary.txt` (not committed); `AGENTS.md:20`
   - `live-summary.txt` holds only JSON and an exit code. It does not record the command or the deployment it ran against; only gate.md claims "summary:get on cloud dev your-dev-deployment".
   - Nobody has looked at the real page against the seeded dev data. The browser test only ever talks to a mock URL.
   - AGENTS §2 asks for "tests + screenshots at 390px and 1440px" before calling something done.
   - Why it matters: the numbers do match the CSVs exactly, but how the evidence was produced should be visible in the file, not only stated in the builder's report.
   - Fix: re-capture the file with the exact command line (with `--deployment your-dev-deployment`) printed at the top. Have Swapnil take one 390 px and one 1440 px look, or screenshot, at the dev page.

3. **The answer-key boundary test skips `shared/`.** `tests/unit/boundaries.test.ts:10`
   - The test scans `src/`, `convex/` and `scripts/seed*`. It does not scan `shared/`, but `convex/seed.ts`, `convex/summary.ts` and `scripts/seed-data.ts` all import code from `shared/` and bundle it.
   - Today `shared/` is clean (I grepped it).
   - Why it matters: a future reference to the answer key in `shared/` would reach Convex without failing this test.
   - Fix: add `shared` to the scanned paths.

## Cosmetic

1. **Page text is hard-coded.** `src/App.tsx:12-14`
   - The company name, "FY2025-26" and "1 April 2025 – 31 March 2026" are fixed text. They show while loading or on error, and the eyebrow and date line never come from the data.
   - This is allowed by the spec (only the totals must show "—"), but it can drift from what is in the database.
2. **The ₹40 lakh balancing provision looks tuned.** `scripts/generate-synthetic.ts:208`
   - It is labelled "Routine professional fee provision for the quarter" and is credited to "Audit Fee Payable", with an advisory firm as the party.
   - It is within the ₹50 lakh cap. But Q4 professional-fee bills are already booked, and ₹40 lakh is about 1.6 times the normal quarterly amount (₹1 cr ÷ 4), so it reads as tuned.
   - Clearer wording (or crediting a professional-fees payable ledger) would look more routine to a reviewer.
3. **The R1 guard is narrower than the rule text.** `tests/helpers/addendum-analysis.ts:24-29`
   - The guard needs round bank receipts AND no purchases. RULES_v1 R1 reads as (a), (b) or (c).
   - Today the data passes either reading: I checked, and only the 4 planted ledgers have no purchases or receive bank money.
   - Why it matters: a future background creditor with no purchases would not trip this guard.
4. **Fixed-asset vendors also sell production materials.** `scripts/generate-synthetic.ts:110,142-143,175-177`
   - Talvori Equipment Works and Elvani Civil Works supply the capex, but they also bill "Purchase of production materials" every month.
   - Why it matters: a "fixed-asset vendor list" in M2 will need care with these two.
5. **One answer-key option uses THEMES wording.** `scripts/generate-synthetic.ts:78`
   - P8's `correct_option` is "Due within 12 months". That is a THEMES Theme 3 option. RULES_v1 R3 Q3 is a ₹ amount input with "Repayable on demand · No fixed schedule · Not sure".
   - Align this before M2/M3, because outcomes must come only from RULES_v1.
6. **Test temp folder is not ignored.** `tests/unit/synthetic.test.ts:70`
   - The regeneration test creates `.synthetic-test-*` inside the repo, and `.gitignore` does not cover it.
   - A killed test run could leave a stray folder behind. Named-file commits make this low risk.
7. **Browser test uses old counts.** `tests/browser/placeholder.spec.ts:6`
   - The mock summary uses ledgerCount 60 and voucherCount 1250, the counts from before Addendum A. This is harmless but stale.

VERDICT: PASS
