# Gate B independent review (R1 answer, fixed outcome, ratio before/after, approval)

Commit reviewed: b20b32a, on c591610. Reviewed 20 Oct 2026, read-only. Nothing edited; no mutation or deploy run.

## Test runs
- npm test: 443 tests, pass 443, fail 0, cancelled 0, skipped 0, todo 0 (exit 0).
- npm run lint: clean (exit 0). npm run build: tsc, convex tsc and vite built (exit 0).
- npx playwright test: 6 passed (detail, gaps, placeholder, each at 390 and 1440 px) (exit 0).
- npm audit --audit-level=high: 0 vulnerabilities (exit 0).
- No secret value in git history (matches are env-var names and prose); the built dist has no EDIT_PASSCODE.
- Read-only answers:detail for R1:Rajesh Mehta matches the owner's live check: director, loan, within 12 months, declaration no; reclass with legal review and related-party disclosure; debt-equity 1.4013 to 1.5658; covenant 1.50 within then breach. The answer object carries no passcode.

## Blocker
None.

## Should-fix
1. The R1 verifier word allowlist covered Latin letters only; a Hindi-script context statement passed. (Fixed after the review.)
2. The verifier does not enforce neutral wording on the question part (only the context statements); "Was this a loan?" passes. Fix before the AI is wired in.
3. A rejection test in m1-verify.test.ts was swapped for a narrower case. (Original case restored after the review.)
4. The reclass amount was checked against all trade payables, not the flagged ledger's own balance. (Capped at the ledger balance after the review.)
5. decide guards against a stale answer but not changed books.
6. Current ratio before/after is not built (RULES_v1 R1); name it as deferred.
7. Decision rows 34-40 were only in the draft at review time.
8. Limits not named in any repo document (books() scale, public detail read, dev-only AI, no AI call in Gate B, global lockout by any visitor). (Added to PROGRESS.md after the review.)
9. DESIGN.md still marks Gate B button and screen words as placeholders; the list chip is always "Open".

## Cosmetic
- With the answer "goods or services" on a loan ledger (Anita Mehta) the note says "stays a trade payable".
- The combined 1.60 target is never shown (each gap is computed alone).
- With counterparty "other", the Trust note carries the possible-related-party caveat but the caption says "Other loans and advances".
- The allowlist accepts mismatched statements such as the singular "a receipt" for three.
- editAttempt rows are never purged (at most 10 per hour). No focus move on hash navigation; the 180 ms row-open motion is not built.

## Checked and fine
- Security (convex/answers.ts): guard before every write; refusals returned, not thrown, so the failure log commits; lockout 10 wrong per India clock hour, checked before the compare; unset or empty EDIT_PASSCODE disables edits; passcode never stored, returned or logged; answeredAt set on the server; R1 only; approve refused on ask_more or escalate; snapshot computed on the server; a new answer clears the decision; writes only to answer, outcome and editAttempt; public read minimal.
- Accounting: debt = Secured + Unsecured + Bank OD; equity = capital + reserves + PBT before tax (stated on screen); Anita Mehta's loan ledger is not double counted; fixed outcomes match RULES_v1 R1; AS 18 worded "controller to confirm"; no legal conclusion; the 1.50 covenant comes from the company record.
- Wording probes: invented count, amount, date, name, second asks, three statements and advice are rejected; the code-built text passes and is rejected under R2; bank items Y1-Y8 pass.
- UI: loading, error (alert plus retry), missing and ready states; fieldset/legend with aria-pressed; aria-live message; labelled password field; 44 px targets; no horizontal scroll at 390 and 1440 px; chosen words used; no banned words; no secret in the DOM.
- Tests: no skip, only or todo; the M1 fixture diff is 78 added lines and 0 removed; no M1 file, data, docs or private file is in the commit; locked M1 marks untouched.

## Convex behaviour only text-tested (no Convex runtime here)
tests/unit/answers-api.test.ts reads convex/answers.ts as text: guard-before-write order, stale and incomplete refusals, no throw in the guard, no snapshot validator in decide, no books-table writes, no passcode in the schema. Not exercised against a runtime: the real commit of the failure log, the lockout across calls, .unique() and index behaviour, argument validators, and decide end to end. Pure functions are tested: checkPasscode, istHour, r1Outcome, debtEquity, decisionSnapshot. The browser test mocks Convex, so it proves the UI flow only.

## Verdict reasoning
No blocker. Passcode-before-write, the lockout, no stored secret, the server-side snapshot, the stale-answer guard, R1-only and no writes to the books all hold. The accounting matches RULES_v1 R1, Anita Mehta is not double counted and the Trust is a possible related party for the controller to confirm. Live figures match. All gates pass. Should-fixes 1 and 2 matter when the AI path is wired in; the rest are accuracy and documentation.

VERDICT: PASS
