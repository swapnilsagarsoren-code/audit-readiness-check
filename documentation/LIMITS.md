# Limits

This page lists what the demo does not do and where it can be wrong. It is a reference. The demo is a prototype on synthetic data.

## Product scope

- **The AI is not connected to any screen.** All questions are written by code. The AI step closed as "marks not met" and the checker still does not enforce neutral wording on the question part of an R1 reply, only on the context statements.
- **Three rules.** Capex booked as repairs (R4) and other income booked in sales (R5) have rule definitions in `docs/RULES_v1.md` and AI fixtures, but no signal, screen or outcome.
- **No sign-in.** Anyone who can reach a deployment can read the detail pages, and anyone can lock edits by sending wrong passcodes.
- **No Schedule III before and after statements.** The demo shows the covenant effect only, not full restated statements.
- **No tax effect.** The tax rate is empty. The R2 note mentions the tax rules and asks the controller to confirm.

## Rule limits

- **R1 does not test "no purchase vouchers".** The signal is round-lakh bank receipts or interest debited to the ledger.
- **R2 treats a payment as settling one whole bill.** It ignores part payments, opening payables and debit notes. The days run from the bill date, but the Act counts from acceptance. A supplier that the master wrongly labels medium is never raised.
- **R2 interest is indicative.** It uses the current Bank Rate only, not the rate history, and 30-day months. It also does not ask the reason for the delay.
- **R3 assumes equal instalments.** It counts only instalments booked in the year and uses the latest principal instalment as the instalment size. A moratorium, step-up or balloon schedule, interest inside an instalment, or a loan that started before the year would make the split wrong. The split is approvable only when the person says the schedule is on file. Code never compares the schedule with the number.
- **Documents are asked about as "on file".** There is no field for where they are.
- **Evidence lists are partial.** Recommended documents that are not built: a special-resolution threshold and board-report disclosure for R1, MSME Form 1 and the ageing schedule for R2, an auditor-sent lender confirmation and default evidence for R3, and written representations for all.

## Engineering limits

- **The reviews do not cover the final code.** The Gate A, Gate B, and R2 and R3 reviews passed on the commits they name. A later commit that merged the save and approve code, added the fake-database tests, and added the stale-list warning was checked by the author with tests, and no independent reviewer saw it.

- **The detail pages read the whole day book.** `convex/books.ts` loads every entry on each call. Convex stops a call after about 16,000 documents read, so a real company's books would fail. At demo size (2,624 entries) it is fine.
- **The Convex handlers are not run by an automated test against the Convex runtime.** Tests cover the rule code, the shared write path against a fake database, and the screens against a mocked backend.
- **The stored gap list can go stale.** Run `flags:refresh` after any rule change, and bump `RULE_SET_VERSION` in `shared/rule-set-version.ts` so the list screen warns.
- **The decision snapshot is recomputed when you decide.** The save checks that the answer is unchanged, but it does not check that the books are unchanged.
- **The retired held-out sets and the answer key are public in this repository,** so the AI step can no longer be evaluated blind. A new evaluation needs a fresh held-out set.

## Unverified legal and standards points

No official-text folder is bundled with this repository. These points came from agent research and need checking against the official text before anyone relies on them.

- The clause number of the deposit-rules exemption for a director's or relative's money.
- Whether a private company must file a form for a board resolution under section 179(3).
- The tax-audit form clause numbers for MSME dues.
- The paragraph numbers of the auditing standards that the evidence lists cite.
- Whether a trust with a director as trustee is a related party under the accounting standard.
