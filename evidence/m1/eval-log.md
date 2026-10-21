# M1 eval log — every run, results and findings

Source: the `question` table on dev `your-dev-deployment` (read-only export, 16 Oct 2026). Full stored answers for each run are in `artifacts/m1/runs/<date>_<time>_<runId>.json`. Times are IST (first stored row). "First try" is what the locked pass marks use; "after retry" is information only.

Locked pass marks (set before any scored run, never changed):
- Dev: invented = 0 and at least 15 of 17 planted positives verified on all 3 runs.
- Held-out (from 16 Oct): invented = 0 and at least 6 of 8 verified on all 3 runs.

## Summary

| # | Time (IST) | Run id | Paid calls | Held-out set | Dev all-3 (first try) | Dev invented | Held-out all-3 | Held-out invented | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 16 Oct 01:46 | m1-953f3306 | 0 | none | — | — | — | — | Not a model result: AI_KEY_MISSING_OR_INVALID on all 57 |
| 2 | 16 Oct 01:53 | m1-03b3eff1 | 0 | none | — | — | — | — | Not a model result: 42 AI_HTTP_FAILED, 15 cap_hit |
| 3 | 16 Oct 02:00 | m1-e4e30666 | 57 | none | 10/17 | 4 | — | — | FAIL |
| 4 | 16 Oct 02:12 | m1-070bd158 | 57 | none | 11/17 | 3 | — | — | FAIL |
| 5 | 16 Oct 17:29 | m1-f0a3ab41 | 0 | v1 H1–H8 | — | — | — | — | Not a model result: all DAILY_TOKEN_CAP |
| 6 | 16 Oct 17:33 | m1-c4f98dc7 | 0 | v1 H1–H8 | — | — | — | — | Not a model result: all DAILY_TOKEN_CAP |
| 7 | 16 Oct 17:37 | m1-598a73f8 | 0 | v1 H1–H8 | — | — | — | — | Not a model result: all DAILY_TOKEN_CAP |
| 8 | 16 Oct 17:42 | m1-1650ad69 | 104 | v1 H1–H8 | 9/17 (14 after retry) | 0 | 3/8 (5 after retry) | 3 | FAIL both |
| 9 | 16 Oct 18:19 | m1-742d0c6e | 88 | v2 H9–H16 | **15/17** (17) | 0 | 5/8 (8) | 0 | Dev PASS, held-out FAIL |
| 10 | 16 Oct 18:50 | m1-7a1e5021 | 88 | v3 H17–H24 | 13/17 (16) | 0 | 3/8 (5) | 2 | FAIL both |

Paid calls today: 394 (runs 3, 4, 8, 9, 10). Tokens: 615,097 input / 74,755 output.

## Findings per run

**1 (01:46)** — Configuration: the API key was missing or invalid on dev. No call reached the model.

**2 (01:53)** — 42 provider HTTP errors (body withheld by design, so the cause is unknown; billing cannot be shown). Their 42 token reservations (195,711 tokens) were kept fail-closed for the whole IST day and later caused runs 5–7 to be refused.

**3 (02:00)** — First real run (code before the post-eval fixes). Rejections: 5 two-part questions, 4 quotes in the wrong field, 4 invented numbers (the AI counted or summed entries itself, e.g. "three receipts", "totalling ₹10,00,000"). Led to: code-supplied entryCount/totalAmount for single-party R1 flags, tallyGroup as a quote field, and quote-miss diagnostics.

**4 (02:12)** — After those fixes. Rejections: 4 two-part questions, 2 checker false alarms on names ("Rajesh Mehta's", "Sundry Creditor"), 1 counted "ten entries", 2 quote misses (a total quoted as an entry amount), 1 quote count. Led to: the frozen held-out set v1, the R1 related-party evidence change (#28), and step 3 (one retry, name false-alarm fix #29, totalAmount/entryCount quote fields, entry counts for single-party flags).

**5–7 (17:29–17:37)** — Refused by the daily token cap before any call: the run-2 reservations plus the day's usage exceeded the cap; in run 7 the raised value had not yet reached your-dev-deployment. No paid calls.

**8 (17:42)** — First run with retry and held-out v1. Main cause: the AI quoted one excerpt per field (6 quotes, limit 5): 24 QUOTE_COUNT rejections on first tries, triggered by step 3's longer quote-field list. All 3 held-out invented facts were self-calculated totals on flags with no supplied total (H2 mixed party, H6 R4). Two-part questions dropped to 1. Led to: held-out v1 retired, v2 frozen, fix 1 (ask for 1–3 quotes) and fix 2 (a per-flag sentence saying which totals exist).

**9 (18:19)** — Fixes 1 and 2 worked: no quote-count rejections, no invented totals, invented 0 on both sets. Dev PASSED (15/17). Held-out v2 missed by one case (5/8). All 7 rejections were two-part questions; H9's two were a checker false alarm on "9% p.a.". Led to: the abbreviation fix, v2 retired, v3 frozen. A date-gap fix (dates add only their year as an allowed number) was also made before this run.

**10 (18:50)** — Dev 13/17 (two-part questions on P5, P8, P11, P17), held-out v3 3/8 with 2 invented: H21 wrote "31 March 2027" (year inferred, not in data) and H22 wrote "factory building" (matches a seeded ledger name inside the input ledger "Repairs - Factory Building"; the cautious rule counts it). H17 tripped the advice check on "must repay". The drop from 15 to 13 on dev looks like run-to-run variation, not a code effect.

## Cross-run findings (deep debug, 16 Oct evening, offline, no paid calls)

- Two-part questions are the main remaining cause, at about 7–9% of answers per run (1.9% in run 8, a single low run).
- By rule, across all runs: **R3 28% (8/29), R2 10% (6/61)**, R1 5%, R4 5%, R5 3%.
- Every R2 case is "registered under Udyam, **and** what size…": the answer options mix registration and size. R3 cases join "schedule / term" with "when due".
- Likely cause (not proven): the AI is shown every facet of the theme (4–5 sub-questions such as registration, approval, deadline, dispute) and tries to cover two. RULES_v1 gives a single primary question only for R3.
- Because a case must be verified on all 3 runs, a 7–8% per-answer rate alone gives roughly 13–14 of 17 on dev; the first-try mark is sensitive to run-to-run variation (estimate).
- Remaining invented / false-alarm flags (run 10): year inferred for "next 31 March"; lower-case generic phrase matching a seeded ledger; "must repay" read as advice.
- Independent checker confirmed the numbers and the diagnosis, with notes: removing facets alone may not fix R2 (the options mix two axes); four of five rule "asks" would be new rule-owned text needing a decision-log entry; a case-only seeded-name rule could let a lower-case wrong party through.

## Run 2026-10-19 1606 IST — m1-c7c8c70e-0f58-4bb7-a4e8-c9df625d34ed (pilot, not scored) (auto-logged)

```text
PILOT_M1 cases=4 runs=3 verified=12 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=4 retries=0 two_part_answers=0 answers=12
```

Detail: runs/2026-10-19_1606_m1-c7c8c70e-0f58-4bb7-a4e8-c9df625d34ed_pilot.md.

Findings (reviewed by an independent checker): 12 of 12 answers verified on the first try (P5, P6, P7 = R2; P8 = R3), none two-part, no retries, invented 0, 12 paid calls (17,664 in / 1,523 out tokens). Earlier runs gave 8 two-part answers out of 60 for these same four cases (13.3%: P5 2/15, P6 2/15, P7 0/15, P8 4/15). If the true rate had stayed at 13%, 0 of 12 would happen by chance about 19% of the time, so this is encouraging but not proof. Not a scored result: P5–P8 are development cases the earlier fixes were designed around. Notes: only 2 of the 9 R2 answers use "Which Udyam category…"; the other 7 are "Is X registered … as Micro, Small or Medium, or is it not registered?" (single question, yes/no with a list); P8 run 3 adds "given the monthly instalments set out in the sanction letter and repayment schedule", a mildly leading clause. Quotes were 1–3 per answer; evidence ids valid; nothing reads as advice.

## Run 2026-10-20 1238 IST — m1-678103a1-93d6-45bd-9432-3d83d8b829dd (auto-logged)

```text
EVAL_M1 cases=20 runs=3 verified=54 rejected=3 blocked=3 failed=0 invented=0 all3_verified_cases=15
EVAL_M1_AFTER_RETRY cases=20 runs=3 retries=3 verified=57 rejected=0 blocked=3 failed=0 invented=0 all3_verified_cases=17
HELDOUT_M1 cases=8 runs=3 verified=22 rejected=2 blocked=0 failed=0 invented=3 all3_verified_cases=6
HELDOUT_M1_AFTER_RETRY cases=8 runs=3 retries=1 verified=23 rejected=1 blocked=0 failed=0 invented=3 all3_verified_cases=7
```

Detail: runs/2026-10-20_1238_m1-678103a1-93d6-45bd-9432-3d83d8b829dd.md. Findings: to be added after review.

### Findings for the 20 Oct 12:38 IST scored run (v4) (added by hand; independent checker confirmed)

Dev 15/17 first try, invented 0 — mark MET. Held-out v4 6/8 first try, invented 3 — mark NOT met. The 3 invented are one answer (H26 run 2) that copied a raw ISO timestamp ("2025-05-14T00:00:00+05:30"), flagged by the date-gap rule: a checker false alarm. Single questions with a fronted phrase before ", what was …" (P4 run 3, H27 run 1) were rejected by the 19 Oct comma pattern: false alarms. P10 (R4) failed on genuine two-part questions in runs 1 and 2. 85 paid calls; 129,496 in / 14,836 out tokens. Not re-scored after any fix. Full detail: artifacts/m1/gate.md.

## Summary table, added rows

| # | Time (IST) | Run id | Paid calls | Held-out set | Dev all-3 (first try) | Dev invented | Held-out all-3 | Held-out invented | Result |
|---|---|---|---|---|---|---|---|---|---|
| 11 | 19 Oct 16:06 | m1-c7c8c70e | 12 | pilot P5–P8 (dev, unscored) | 4/4 pilot cases | 0 | — | — | Pilot: 12/12 verified, 0 two-part |
| 12 | 20 Oct 12:38 | see runs/2026-10-20_* | 85 | v4 H25–H32 | **15/17** (17 after retry) | 0 | 6/8 (7 after retry) | 3 | Dev MET; held-out NOT met (invented 3, false alarm) |

## Run 2026-10-20 1253 IST — m1-6c041d0c-b678-48da-9a85-dd005f5ea3f4 (auto-logged)

```text
EVAL_M1 cases=20 runs=3 verified=56 rejected=1 blocked=3 failed=0 invented=1 all3_verified_cases=16
EVAL_M1_AFTER_RETRY cases=20 runs=3 retries=0 verified=56 rejected=1 blocked=3 failed=0 invented=1 all3_verified_cases=16
HELDOUT_M1 cases=8 runs=3 verified=19 rejected=5 blocked=0 failed=0 invented=0 all3_verified_cases=4
HELDOUT_M1_AFTER_RETRY cases=8 runs=3 retries=5 verified=22 rejected=2 blocked=0 failed=0 invented=0 all3_verified_cases=6
```

Detail: runs/2026-10-20_1253_m1-6c041d0c-b678-48da-9a85-dd005f5ea3f4.md. Findings: to be added after review.

### Findings for the 20 Oct 12:53 IST scored run (held-out v5; added by hand; independent checker confirmed)

Dev 16/17 first try but invented 1 (P4 run 1: "2 NEFT transfers" — the supplied count was correct; "transfers" was missing from the counting-noun list: checker false alarm) → dev mark not met. Held-out v5 4/8, invented 0 → not met (H34 and H37 genuinely two-part; H36 "and if so" per the 19 Oct rule; H40 context statement + semicolon + one question). After retry: dev 16/17 invented 1; held-out 6/8 invented 0. 86 paid calls; 131,891 in / 15,153 out tokens.

| # | Time (IST) | Run id | Paid calls | Held-out set | Dev all-3 (first try) | Dev invented | Held-out all-3 | Held-out invented | Result |
|---|---|---|---|---|---|---|---|---|---|
| 13 | 20 Oct 12:53 | see runs/2026-10-20_1253_m1-6c041d0c* | 86 | v5 H33–H40 | **16/17** (16 after retry) | 1 (false alarm) | 4/8 (6 after retry) | 0 | Both marks NOT met |
