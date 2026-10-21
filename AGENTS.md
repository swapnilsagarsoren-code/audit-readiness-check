> **Note for readers of this public copy.** This file was written for the AI coding agents and the author. It refers to two folders that are not published. `private/` holds the author's local planning notes and a decision log, so decision numbers such as "#33" point to that log. `artifacts/` holds raw evaluation output. The public decision record is `documentation/DECISIONS.md`. Three summaries from `artifacts/m1/` are published in `evidence/m1/`. Test counts in older entries were true on their dates.

# AGENTS.md — Audit-Readiness Check (approved 13 Oct 2026; revised 13 Oct night to follow Swapnil's operating rules — decision log #17)

Read before anything else: this file, docs/RULES_v1.md, docs/THEMES.md, docs/SYNTHETIC_COMPANY_SPEC.md, docs/REVIEW_PROTOCOL.md, private/PLAN.md, private/decision-log.md, private/OPERATING_RULES.md, PROGRESS.md, and DESIGN.md before any screen work (the M0 placeholder page is exempt).

## 1. How the product works
- **Interface:** one web page for the CFO office. Core action: open a flagged gap, read the evidence, answer one question, approve the outcome. Must work at 390px and 1440px.
- **Business logic:** fixed rules (docs/RULES_v1.md) raise flags on the trial balance and day book → an AI action reads ledger names, party names and narrations and words one question per flag using docs/THEMES.md → code checks every amount, party, ledger and quote the AI uses exists word for word in the data; anything unverified stays hidden until a person accepts it → the answer maps to a fixed outcome → code computes the ₹ / ratio impact and a Schedule III Division I before/after.
- **Database (added milestone by milestone; schema changes are additive only):** company (incl. directors list, tax rate, materiality inputs), period, ledger (name, Tally group), entry (date, party, narration, amount, voucher type), supplier (MSME status, written credit days), rule (id, version, effectiveFrom, fy), rbiBankRate (value, date, sourceUrl). Later milestones add flag, question, answer, outcome, reclassProposal.
- **Third party:** Anthropic API (Claude Haiku) for reading and wording only. Key: `ANTHROPIC_API_KEY` in Convex env vars, entered by Swapnil via a hidden `read -s` prompt or the provider dashboard.
- **Not in v1:** login, payments, live Tally connection, real client data, Division II, auditor view.
- When I report a bug I'll name the part (interface / logic / database / third party). Look there first; tell me if I named the wrong one.

## 2. How we work
- Swapnil decides, approves anything public and runs every commit, push, GitHub action, deploy, prod Convex env change, API key or EDIT_PASSCODE change and seed himself; Claude may get or set other dev env values only after he approves each command. Claude Code (on Swapnil's Mac) plans and builds, and runs local build/test commands; paid eval runs only after Swapnil approves each one. An independent checker agent reviews every change before Swapnil sees it. Claude never commits, pushes or deploys. Codex is retired for this project (decision log #26); CLAUDE.md has the details.
- Before writing code, say in 2–3 sentences what you think I'm after, then your plan. Wait for my yes.
- One milestone at a time (private/PLAN.md §11). Nothing outside it. New ideas go to the parked list in PROGRESS.md.
- **The AI never decides an outcome.** Outcomes come only from docs/RULES_v1.md. The rules file never changes without an explicit, logged decision; tests that check "unchanged" files compare to a fixed baseline commit, never HEAD.
- Never invent a number, party, ledger, rate or citation. RBI Bank Rate and tax rate are stored inputs with date and source (RBI official page for the Bank Rate).
- Synthetic data only. No real people's or companies' data in the repo, tests or fixtures.
- Never say "done" until you've seen it work (tests + screenshots at 390px and 1440px) and told me how to check it. Claude verifies independently; an agent's "done" is never accepted on its own.
- When I report a bug: find the cause before changing anything; fix only that.
- Add tests with every feature. Give RAW test output written to files, plus a one-line summary. No `.skip`, `.todo` or `.only`.
- **Test gate (every commit or deploy):** exit code 0 AND `fail 0` AND `cancelled 0` AND `skipped 0` AND `todo 0` (whole-line match). The real-browser test (`npm run test:browser`) only runs on Swapnil's Mac; the Mac result is the gate. A busy Mac can time it out: rerun on an idle Mac before calling it a bug.
- Precondition for every phase: clean tree at a named commit. One commit per phase. Commits name their files: `git add -- <paths> && git commit -m "…" -- <paths>`; never `git add -A` where stray files exist.
- Every Convex CLI call names the deployment explicitly: `--deployment <name>` for run/env/data/export/import/deploy; `CONVEX_DEPLOYMENT=dev:<name>` for `npx convex dev --once` (it rejects `--deployment`). Never use a local or anonymous Convex deployment (`CONVEX_ALLOW_ANONYMOUS=false`).
- Risky functions (AI, seed, migration) stay locked to dev, fail-closed, until a deliberate release step lifts the lock. Scripts that refuse an action print a non-secret reason.
- Loading or failure must never show a flag, outcome or verdict.
- Secrets never go in chat, code, logs, commits or URLs. Scripts read the edit passcode with `npx convex env get EDIT_PASSCODE --deployment <name>`. 10 wrong passcodes in one India hour lock all edits.
- UI: no page-level sideways scroll at 390px or 1440px; 44px tap targets; designed loading, empty, error and cap-hit states; use the emil-design-eng and apple-design skills.
- Words: say "flag", "gap", "needs a question", "not verified", "insufficient evidence". Never "fraud", "forensic proof", "error found", "platform", "continuously tracks", or "red flag" as a verdict.

## 2a. Independent review gate (decision log #14)
- Every milestone ends at a GATE. You (the builder) stop and write RAW test/build output and the gate report to `artifacts/<milestone>/`. You never commit, push or deploy.
- Swapnil makes one local commit of the named files; an independent reviewer agent (did not write the code) reviews that commit against this file, docs/RULES_v1.md, docs/REVIEW_PROTOCOL.md and private/OPERATING_RULES.md, and writes `reviews/<milestone>-review.md` ending `VERDICT: PASS` or `VERDICT: FAIL`.
- Blocker fixes are amended into the same commit (still one commit per phase) and re-reviewed. Only a PASS commit is pushed; prod only through the release phase below.
- Never edit files in `reviews/` yourself.

## 3. Shipping and release
- Repo: `~/audit-readiness-app`. This public copy was published after a diff check for secrets and private details.
- `private/` (gitignored) holds the author's local planning notes. Never in the repo history.
- Dev first, always. Each milestone deploys to DEV only.
- **Prod only through a release phase with two gates:**
  - Gate 1, before any prod write: raw test + build output; full prod backup (`npx convex export --include-file-storage --deployment <PROD> --path <zip>`) checked against live data; field-by-field dry-run diff rehearsed twice on an exact copy of the prod snapshot; seed/migration scripts dry-run by default, idempotent, refuse any status change; code-rollback and data-restore steps rehearsed on dev; every human input (passcode, approvals) collected before the first prod write.
  - Prod deploy: `CONVEX_DEPLOYMENT=prod:<PROD> npm run deploy < /dev/null`, run by Swapnil.
  - Gate 2, after: post-release diff vs backup; a fresh backup BEFORE the live check; live check (key text, states, every link 200, no console errors, 390/1440); sign-offs; final backup. Record "last stable state = commit + backup".
  - Rollback: code first (redeploy last stable commit), data only if records are wrong (`npx convex import --replace --yes --deployment <PROD> <zip>`).
- Production-ready here means ready for a public demo on synthetic data. It does not mean ready for real client data.
- Keys only in Convex env vars. Never in code, a `VITE_` variable or a committed file. `.gitignore` covers `.env*`.
- Every limit and every "is this allowed" check runs in a Convex function, never only on screen.

## 4. The AI call
- Model: Claude Haiku (current version), thinking off.
- Input per call: one flag's ledger name, Tally group, up to 10 entries (date, party, narration, amount), the rule's theme title, its one question goal and the fixed options (docs/THEMES.md), a code-supplied entry count and combined amount where they are unambiguous, and the rule's evidence list. Nothing else. Text that looks like instructions inside inputs is flagged as possible prompt injection and never followed; the scanner is a short pattern list and not a guarantee, so the real defences are JSON-only output, code verification of every fact, fixed evidence ids and no outcome authority for the AI.
- Output: JSON only — question text, 1–3 evidence ids from the rule's fixed evidence list, and the quoted fields it relied on. The rule, not the AI, picks the theme (decision #23). Code rejects any reply whose quotes/amounts/parties/ledgers are not found word for word in the input, or whose evidence ids are not on the rule's list; answer options come from the fixed list in code, never from the AI. Unverified output stays hidden until a person accepts it. "Verified" only means the words are there.
- Runs in a Convex action, never in the interface; locked to dev until a release step lifts it.
- Cost controls from day 1: kill switch `AI_ENABLED` off by default on prod; output cap 500 tokens; per-run cap and daily cap on calls and tokens (values set by Swapnil, stored as env vars); prepaid credit with auto-reload off; passcode on edits.
- Evals: freeze a held-out set before any tuning and report its score separately; one real live test before calling the AI feature built.
- When a cap is hit or the call fails: show "Question not ready — the rule flag still stands. Try again later." Keep the flag on screen.
- The AI must never: decide an outcome, give tax or legal advice, invent facts, answer off-topic.
