# Architecture

This page explains how the demo is put together and why. For the rule definitions, see [docs/RULES_v1.md](../docs/RULES_v1.md). For what the demo does not do, see [LIMITS.md](LIMITS.md).

## The idea in one paragraph

An auditor asks the same questions of most Indian company books. Is this "creditor" really a loan? Was this small supplier paid on time? Is the current part of this term loan shown as current? The demo turns each of those into a rule that code can raise from the books. A person answers a short question, and a fixed table turns the answer into an outcome with a rupee and ratio effect. The person approves it. An AI model can word the question, but it never picks the outcome, and it is not connected to any screen in the demo.

## Data flow

1. **Books in.** `data/synthetic/` holds the fictional company as CSV files. `npm run seed:dev` loads them into Convex tables (`ledger`, `entry`, `supplier`, `company`).
2. **Flags.** `flags:refresh` loads the books, runs the three rule signals from `shared/rules.ts`, computes materiality from the trial balance, ranks the results, and stores them in the `flag` and `flagRun` tables.
3. **List screen.** `flags:list` returns the stored list. `src/GapsPage.tsx` shows it, with a warning if the stored rule version is older than the running code.
4. **Detail screen.** Opening a gap calls the rule's `detail` query (`answers:detail`, `msme:detail` or `termloan:detail`). The query loads the books and returns the entries behind the flag, the code-written question, the answer buttons, the documents to ask for, and, once an answer exists, the outcome.
5. **Answer and decision.** `record` saves the buttons the person pressed. `decide` stores approval or send-back together with a snapshot of the outcome the server computed. Both need the edit passcode.

## Rules as code

Each rule lives in plain functions with integer paise for money, so tests can run them without a database.

| Rule | Signal | Question | Outcome | Impact |
| --- | --- | --- | --- | --- |
| R1 | A creditor or unsecured-loan ledger with round-lakh bank receipts, or interest debited | What was this money received for? Then who provided it, when it is repaid, and whether a written declaration is held | Goods or services: no change. Loan: move to borrowings with the right caption. Advance, deposit or not sure: goes to the owner. | Debt-equity before and after |
| R2 | A micro or small supplier paid after the allowed days (written terms capped at 45, else 15) | Is the Udyam certificate on file, what size does it show, are the terms in writing | Interest due, not late, no interest (medium or unregistered), or escalate | Late bills, days late, indicative interest |
| R3 | A term loan with no current-maturities ledger | Are the sanction letter and the repayment schedule on file | A split worked out from the booked instalments, approvable only when the schedule is on file | Current ratio before and after |

Supporting modules:

- `shared/materiality.ts` and `shared/rank.ts`. Overall materiality is the lower of 1% of revenue and 5% of profit before tax. A gap at or above 50% of it is flagged. Between 5% and 50% it is listed as below the flag line. Under 5% it is hidden.
- `shared/ratios.ts`. Debt-equity (a ceiling) and current ratio (a floor), with the reclassification and split arithmetic.
- `shared/msme-interest.ts`. Three times the RBI Bank Rate, 30-day months compounded, remaining days as simple interest. It is indicative and uses the current rate only.
- `shared/rbi-rate.ts`. Reads the Bank Rate from the RBI home page and refuses the page unless the Bank Rate appears once and equals the Marginal Standing Facility rate. The rate is never typed in.
- `shared/evidence-bundle.ts`. Lists the documents to ask for. Code lists them, not the AI.

## Convex layer

- `convex/books.ts` turns the stored tables into the shape the rules use. It reads every ledger, entry and supplier, which is fine at demo size.
- `convex/decisions.ts` holds the save and approve path that R1, R2 and R3 share. The order is fixed in one place. The passcode check comes first, then the flag lookup, then the writes. A refusal is returned and never thrown, because a thrown error would roll back the failed-attempt record and the lockout would never trigger.
- `convex/answers.ts`, `msme.ts` and `termloan.ts` are the three rule modules. Each builds its question and snapshot and hands the writes to `decisions.ts`. None writes to the books.

## Security model

The demo has no sign-in. The edit passcode is the only protection on writes, so treat the whole app as dev-only. See [SECURITY.md](../SECURITY.md) for the rules.

- The passcode lives in a Convex environment variable and is compared in constant time.
- Ten wrong tries in one India clock hour lock edits for everyone. Failure records older than two hours are deleted.
- The server recomputes every outcome from the books at decision time. The browser sends only the buttons pressed and the decision.
- A new answer clears the earlier decision, and `decide` refuses if the saved answer changed after the person saw it.
- The AI action is internal only. It runs only when `AI_ALLOWED=dev-only` and `AI_ENABLED=true`, within per-run and daily caps on calls and tokens that are reserved before each request.

## The AI step, and why it is parked

The AI step was built to word one question per flag and ask for documents from the rule's fixed list. Code verifies every number, date, name and quote in the reply, rejects advice and two-part questions, and decides all outcomes. The pass marks were locked before the final runs. At least 15 of 17 development positives, and at least 6 of 8 held-out cases, had to verify on all three runs, with zero invented facts in each set. Only first tries count. Five scored runs never met both marks together, and the marks were not changed. The milestone is closed as "marks not met". The numbers are in [DECISIONS.md](DECISIONS.md), and the run-by-run record is in [evidence/m1/](../evidence/m1/).

A 476-item labelled question bank in `tests/fixtures/m1-question-bank.json` guards the checker. Every change to the checker must keep every label right.

## Tests

- **Unit tests** (`tests/unit/`). Pure rules, the checker, the question bank, and the Convex write path. `tests/helpers/fake-db.ts` is a small in-memory stand-in for the database, so the passcode lockout and the save and approve steps run for real in the tests.
- **Source checks.** A few tests read the Convex modules as text to check things a runtime cannot, such as "no module writes to the books".
- **Browser tests** (`tests/browser/`). Playwright with Chrome, at 390 px and 1440 px, against a mocked backend. They prove the screens, not the database.
- **What no test covers.** The Convex handlers have not run against the Convex runtime in an automated test. The author checked them by hand on a dev deployment.

## Independent review

Every milestone was reviewed by a separate agent that did not write the code. The reports are in [reviews/](../reviews/). Each ends with a verdict line. Review findings were fixed or logged as known limits before the next step. Each review covers the code at the commit it names. Later changes, such as merging the save and approve code, were checked by the author with tests and were not independently reviewed.
