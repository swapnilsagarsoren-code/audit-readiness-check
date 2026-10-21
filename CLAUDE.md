> **Note for readers of this public copy.** This file was written for the AI coding agents and the author. It refers to two folders that are not published. `private/` holds the author's local planning notes and a decision log, so decision numbers such as "#33" point to that log. `artifacts/` holds raw evaluation output. The public decision record is `documentation/DECISIONS.md`. Three summaries from `artifacts/m1/` are published in `evidence/m1/`. Test counts in older entries were true on their dates.

# CLAUDE.md — Audit-Readiness Check

You are working in Swapnil's repo `~/audit-readiness-app` through Claude Code on his Mac. Codex is retired for this project (decision log #26, 16 Oct 2026). You plan and build; Swapnil decides.

@AGENTS.md

## Read first, every session
- `PROGRESS.md` (where the build stands), `private/PLAN.md` §11 (milestones), `private/decision-log.md` (latest entries), `private/OPERATING_RULES.md`, `docs/RULES_v1.md`, `docs/THEMES.md`, `docs/REVIEW_PROTOCOL.md`.
- The latest gate report under `artifacts/<milestone>/gate.md`.

## Who does what (overrides AGENTS.md §2 where they differ)
- **Claude Code:** plans, edits code, runs local tests/build/lint, writes raw output to `artifacts/<milestone>/`. Before writing code, say in 2–3 sentences what you think Swapnil is after, then the plan; wait for his yes.
- **Independent checker:** before Swapnil sees any finding, command or code change, launch a fresh subagent that did not write it to review it. Report its verdict and what you changed because of it.
- **Independent reviewer:** at each milestone gate, after Swapnil's commit, a fresh subagent reviews the commit and writes `reviews/<milestone>-review.md` (Swapnil saves it; you cannot edit `reviews/`).
- **Swapnil only:** commits, pushes, deploys, prod Convex env changes, the API key and EDIT_PASSCODE (anywhere), seed runs, anything public. Exception: Claude may get or set other dev (`your-dev-deployment`) env values with one command that Swapnil approves each time. He runs the rest himself with the `!` prefix in this session or in Terminal. Give each as ONE ready-to-run command, never a partial.
- **Paid AI calls:** `npm run eval:m1` costs money. Ask before running it, say the expected number of calls, and never rerun it to "see if it passes" without a code change that targets a known cause.

## Hard rules (permissions in `.claude/settings.json` enforce most of them — never try to work around a denied command)
- Dev deployment only: `your-dev-deployment`. Never prod, never a deploy key, never read `~/.convex/`.
- Secrets never in chat, code, logs, commits or URLs.
- No new files unless Swapnil asks. Never edit `docs/`, `private/`, `reviews/`, `data/` (spec copies, answer key and reviews are controlled elsewhere).
- Synthetic data only. Fixed rules decide outcomes; the AI only words questions and picks evidence ids from the rule's fixed list.
- Do not change a locked pass mark after seeing results. Freeze a held-out eval set before further tuning (AGENTS.md §4) and report its score separately.
- Plain, simple English in everything Swapnil reads. Bullets over long paragraphs.
- Run the full `npm test` (about 2 seconds, allowed without a prompt) rather than other test runners. Start `npm run dev` only when needed, in the background, and stop it after.
- If a Convex MCP server is connected here, never use its env or run tools; use the npm scripts above.
