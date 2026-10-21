# REVIEW_PROTOCOL — independent review gate

Rule (Swapnil, 13 Oct 2026): all code that ships is checked by an independent agent that did not write it.

## Who
- **Builder:** Codex (in ~/audit-readiness-app).
- **Reviewer:** a fresh Claude agent started by Claude for each gate. It sees only: the repo at the commit under review, AGENTS.md, docs/RULES_v1.md, docs/SYNTHETIC_COMPANY_SPEC.md, this file, private/PLAN.md (the milestone) and private/OPERATING_RULES.md. It does not see the build chat. Read-only: it never edits code.
- **Checker (operating rules §1):** a separate agent versed in release engineering reviews every command, finding, plan and review before Swapnil sees it, answering: are the facts right; does it already exist; is it needed for the placement story. Assumptions are labelled.
- **Claude (main):** runs the gate, checks numbers against official sources, passes findings to Codex as ONE prompt, re-runs the reviewer after fixes.
- **Swapnil:** checks the milestone; makes the one local commit (named files) that the reviewer reviews; pushes only after `VERDICT: PASS`; runs every prod command in a release phase.

## The reviewer checks, every gate
1. **Rules fidelity:** every outcome comes from docs/RULES_v1.md; options exactly as listed; "Not sure" present; effectiveFrom / fy on every rule; no outcome decided by the AI.
2. **Numbers:** no hard-coded rates, thresholds or citations that aren't in RULES_v1.md; RBI Bank Rate and tax rate read from stored inputs with date/source; materiality maths matches private/PLAN.md §7.
3. **AI safety (from M1):** AI call only in a Convex action, dev-locked until release; JSON-only output; code rejects any quote/amount/party/ledger not found word for word in the input and any option not in the fixed list; unverified output hidden until a person accepts it; prompt-injection text flagged; output cap 500, per-run and daily caps, kill switch off on prod, failure message; held-out eval score reported separately; no key in client code, `VITE_` vars or committed files.
4. **Data:** synthetic only; no real people/companies; answer key never sent to the AI or shown in the UI.
5. **Tests honesty:** RAW output in files; gate = exit 0, fail 0, cancelled 0, skipped 0, todo 0; no skipped, mocked-to-pass or deleted tests; new behaviour has tests; previous milestones' tests still pass; real-browser test runs on Swapnil's Mac (say if the sandbox can't).
6. **Security / prod readiness:** server-side validation on every mutation/action; passcode on edit functions; no secrets in git history (`git log -p | grep -i -E "sk-ant|api_key|passcode"`); `npm audit` high/critical = 0; loading and failure states never show a flag as final.
7. **Scope:** nothing outside the milestone; parked ideas in PROGRESS.md.
8. **Words:** no "fraud", "forensic proof", "error found", "platform", "continuously tracks", or "red flag" as a verdict.
9. **Release (release phases only):** Gate 1 and Gate 2 evidence complete per AGENTS.md §3; every Convex call names its deployment.

## Output
`reviews/<milestone>-review.md`:
- Commit reviewed (hash), date.
- Findings: Blocker / Should-fix / Cosmetic, each with file:line and why.
- Last line exactly `VERDICT: PASS` or `VERDICT: FAIL`. Any blocker = FAIL.

## Ship rule
Only a commit with a PASS review is pushed. Each milestone deploys to dev only. Prod only through a release phase with Gate 1 and Gate 2 (AGENTS.md §3). HQ site changes also need Swapnil's explicit OK.
