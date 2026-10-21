# Decisions

This page records the main build and rule decisions, with the reason for each. The author kept a fuller private log, and the entries here are the ones that shape the code. Dates are October 2026. Where a reason cites a law or a standard, the author or an agent read most citations against official text. [LIMITS.md](LIMITS.md) lists the ones that are still unverified. Nothing here is legal advice.

## What the product is

- **Classification, not journal-entry testing (13 Oct).** The author, a former auditor, found account classification the most painful audit task. Journal-entry testing is audit work across many assertions and is not a product by itself.
- **Code decides, the AI words (13 and 14 Oct).** Rules raise the flag and pick the question type. A fixed table decides the outcome. An AI model may word one question and nothing else. This keeps every outcome testable.
- **Every gap carries a rupee or ratio effect computed by code (13 Oct).** The effect makes it a finance tool and not a list of audit queries.
- **The first three demo rules (13 Oct).** A director loan booked in creditors, a small supplier paid late, and a term loan with no current-maturity split. They have the highest rupee effect and clear Division I rules. Capex booked as repairs and other income booked in sales were planned and cut.

## Rules and sources

- **Materiality (13 Oct).** Overall materiality is the lower of 1% of revenue and 5% of profit before tax. A gap is flagged at 50% of it and ignored below 5%. Using 1% of revenue alone is looser than 5% of profit whenever the profit margin is under 20%.
- **Only official sources count (13 Oct).** India Code, MCA and Gazette texts, tax and GST departments, and ICAI texts labelled as guidance. A reviewer will ask for the source.
- **Schedule III, Division I (13 Oct).** The target company is unlisted and uses Indian accounting standards, not Ind AS. Most guidance-note references were for Division II, so a Division I mapping came first. The legal text used is India Code (to October 2018) plus G.S.R. 207(E) of 24 March 2021.
- **Ranking bands (20 Oct).** At or above the flag line, a gap is flagged. Between 5% and 50%, it is shown muted as "below flag line". Below 5%, it is hidden. R2 uses the bill date as the acceptance date for the synthetic data.
- **R1 flags on the bank-receipt pattern alone (20 Oct).** A creditor ledger is flagged when it has round-lakh bank receipts or interest debited. A match to the directors, relatives or shareholders list only adds a "possible related party" marker. The planned AI person-name signal was dropped. Requiring a list match would have missed Sharma Traders, a non-related party funded by NEFT.

## The synthetic company

- **Synthetic data only, with a planted answer key (13 Oct).** Real books are confidential, and planted cases give an exact answer to grade against. A first version of the data had a ₹135.68 crore year-end plug, no fixed assets, stock or debtors, and no covenant that could break. The cause was the spec. An addendum fixed the cost mix from industry figures for listed auto-component makers, built the balance sheet from rating-agency comparables, and set up the covenant story. The R3 fix takes the current ratio below 1.20, and the R1 fix takes debt-equity above 1.50.
- **Held-out cases written by someone else (13 Oct).** This avoids grading planted errors the author wrote. A held-out set is retired once its results drive a fix. Four sets were retired and the fifth was scored once.

## The AI step and why it closed as "marks not met"

- **AI scope after the riskiest-guess test (14 Oct).** A blind model picked the right question type 12 of 20 times (the pass mark, set before the run, was 16) and the right outcome 19 of 20 times, with no invented facts. This result is recorded in the author's private log and is not published. The result moved the work from "the AI routes questions" to "rules route, the AI words one question and requests documents".
- **Pass marks locked (before the final runs).** At least 15 of 17 development positives, and at least 6 of 8 held-out cases, verified on all three runs, with zero invented facts in each set. Only first tries count. A retry result is reported as an extra line.
- **One question goal per rule (20 Oct).** The model had seen four or five sub-questions per theme, and two-part questions clustered in R3 (28%) and R2 (10%). Giving each rule one goal fixed that in a small pilot.
- **General checker rules (20 Oct).** Phrase-by-phrase patches kept opening new holes, and two independent reviews found about 30 holes in 300 probes each time. The checker now judges only the model's own words, judges advice by meaning, counts number words, and treats "and if so" as two questions. A labelled question bank (468 items when it was introduced, 476 now) must stay correct for every change.
- **A checker false-alarm fix after seeing results (16 Oct).** Two of three invented-fact counts on one run were detector false alarms. The fix was accepted and judged on the held-out set only.
- **M1 closed as "marks not met" (20 Oct).** On the last scored run, the development set verified 16 of 17 but flagged one invented fact (a correct supplied count that the checker misread), and the held-out set verified 4 of 8 with none invented. Five scored runs never met both marks together. The author chose to stop tuning, because each fix retires a held-out set and eight cases are a noisy judge, and chose to document the miss instead of moving the marks. On the last two runs, about 93 to 95% of first-try answers verified and about 96% after one retry. No answer with a genuinely invented fact was seen passing the checker in the runs reviewed, but the checker has known gaps. The run record is in [evidence/m1/](../evidence/m1/).

## Auditor rulings on question wording and evidence (20 Oct)

The author reviewed 28 AI questions, 12 edge cases and the evidence lists. Of the 28 questions, 15 were good and 9 were leading.

- A question is leading when it proposes one answer taken from the narration, uses treatment words, or repeats the narration. Prefer a neutral open question and keep the answer options on the answer buttons.
- R1 asks what the money was for. R2 asks whether the Udyam certificate is on file, then the size, then the credit terms. R3 asks only whether the sanction letter and the repayment schedule are on file, and code works out the split.
- A short context line before one question is allowed. "And if so" stays two questions.
- A question may state the entry count and total, quote the narration, and show plain dates. It stays neutral, so it says "the money received" and not "the loan".
- Evidence is a bundle that code lists. R2, R3 and R4 always list the whole set. R1 lists everything except the board resolution, which is added only when the answer is a loan.

A later standards check found these rulings sound as professional practice. It also found that no auditing standard mandates neutral wording of a management inquiry, so the demo describes it as a design principle and not a requirement. The same check recommended further documents (a board resolution threshold, MSME Form 1, an auditor-sent lender confirmation, written representations). They are not built yet. See [LIMITS.md](LIMITS.md).

## Rules found while building the demo

- **The R1 evidence list (16 Oct).** Added a list of related parties and a lender confirmation, and relabelled the director declaration to the wording of the deposit rules (a declaration from a director or relative, given when the money was paid, that it was not borrowed money). Section 188 approval and the MBP forms were left out.
- **Mehta Family Trust is a "possible related party" (20 Oct).** A trust is not an individual, and the Companies Act definition of relative lists individuals only. The demo therefore does not call the trust a relative. The note asks the controller to confirm.
- **R2 and R3 wording (20 Oct).** The R2 question also asks for the registration date and says which date the days count from. The R3 note says it assumes equal instalments. The R2 interest note says the screen does not record an agreed rate, so the rate under MSMED Act s.16 is applied.
- **One R1 verifier change (20 Oct).** For R1 only, the checker accepts up to two plain statements before exactly one question. Every other rule still needs one sentence. The statements may restate only the supplied facts, so no invented clause can ride in them.

## How it was built

- **Independent review gate (13 Oct).** A separate agent that did not write the code reviews every milestone. The reports are in [reviews/](../reviews/). The reviews and checks found real problems, and each was fixed before the next step. One example is that Anita Mehta's ledger, which is already a loan, would have been counted as debt a second time in the debt ratio. `shared/decision.ts` now skips a ledger that is already a loan, and `tests/unit/decision.test.ts` covers it.
- **AI coding agents under written rules (16 Oct).** An AI coding agent planned and built. The author alone ran commits, pushes, deploys, environment changes, data seeding, and approved each paid evaluation. Permission rules in the author's local Claude Code settings enforced this, and `AGENTS.md` and `CLAUDE.md` carry the written rules.
- **Passcode on every edit, with a lockout (20 Oct).** Ten wrong passcodes in one India hour lock edits. The check runs first on every write, and a refusal is returned and never thrown.
