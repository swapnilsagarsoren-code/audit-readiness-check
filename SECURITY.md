# Security

This repository is a demo that runs on synthetic data. It is not meant to hold real company books, and it has no sign-in.

## What is safe to publish

- All data in `data/` is synthetic. Every company, person, bank and supplier name in it is fictional, and any resemblance to a real firm is coincidental. The files in `docs/` quote a few real names as examples.
- The repository holds no API keys, passwords, deploy keys or passcodes. `.env*` files are ignored by git.
- The deployment name in the scripts and tests is the placeholder `your-dev-deployment`. Replace it with the name of your own Convex dev deployment (see the README).

## How edits are protected

- Every write to a gap (saving an answer, approving, sending back) needs the edit passcode.
- The passcode is a Convex environment variable named `EDIT_PASSCODE`. It is never stored in a table and never returned by a function. Set it with `npx convex env set EDIT_PASSCODE`. The README command reads it at a hidden prompt, so it stays out of your shell history. The value is briefly visible in the process list while the command runs, so run it only on a machine you control.
- If `EDIT_PASSCODE` is not set, every edit is refused.
- Ten wrong passcodes in one India clock hour lock all edits until the next hour. The count is global, so anyone who can reach the deployment can lock edits.
- Reads are public. The detail pages return figures derived from the synthetic books, and the saved answers and decisions. There is no per-user access.

## Known gaps

- There is no sign-in. Do not point this at a deployment that holds real data.
- The AI step calls a paid API. It is switched off by default, runs only when `AI_ALLOWED=dev-only` and `AI_ENABLED=true` are set on the deployment, and has daily and per-run caps. The API key is set only as a Convex environment variable.
- The injection scanner for text inside books is a short pattern list. The real defences are JSON-only output, code verification of every fact, fixed evidence ids, and no outcome authority for the AI. The M1 evidence in `evidence/m1/gate.md` lists the checker's known gaps.

## Reporting a problem

Open a GitHub issue. Do not include real company data or credentials in the report.
