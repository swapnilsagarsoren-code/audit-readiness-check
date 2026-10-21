# Audit-readiness check

A demo that reads the books of a synthetic Indian company, lists the gaps an auditor is likely to raise, and shows what the accounts look like if the answer goes against the company. A person answers the code-written questions for a gap, which are one main question and a few short follow-ups. Fixed rules, not an AI, decide the outcome.

The company is fictional (an auto-component maker on Tally, Schedule III Division I, financial year 2025-26). All figures are synthetic. The code is a working prototype, not a product. It has no sign-in and must not hold real books.

## What the demo shows

The demo flags seven gaps and walks three of them end to end.

| Rule | Gap | What the demo shows |
| --- | --- | --- |
| R1 | Money booked as a trade payable that may be a loan (the walkthrough uses a director's) | Moving ₹2.5 crore to related-party borrowings takes debt-equity from 1.40 to 1.57. The covenant limit is 1.50. |
| R2 | A small supplier paid late | A ₹8 lakh bill paid 15 days past the 15 allowed accrues ₹5,671.23 of indicative interest at three times the RBI Bank Rate. The figure assumes the stored Bank Rate is 5.75%, the rate on the day it was fetched. |
| R3 | A term loan with no current-maturity split | ₹2.4 crore falls due within 12 months. Splitting it takes the current ratio from 1.23 to 1.14. The covenant floor is 1.20. |

For each walked gap, the screen shows the entries behind the flag, a code-written question with answer buttons, the documents to ask for, the fixed outcome, a proposed entry, and the covenant effect. The person approves or sends it back. Nothing is written to the books. The decision is recorded and nothing else changes.

See [documentation/DEMO.md](documentation/DEMO.md) for the click-by-click walkthrough with expected numbers.

## Status

| Milestone | State |
| --- | --- |
| M0, synthetic company and seed | Done. Independent review: PASS. |
| M1, AI question wording | Closed as "marks not met". The locked accuracy marks were missed on five scored runs, and the marks were not changed. The AI is not connected to any screen. |
| M2, three rules, ranked list, answer and approval screens | Built and live on a dev deployment. Three independent reviews (Gate A, Gate B, and R2 with R3) passed. A later commit that merged the save and approve code and added tests was not independently reviewed. |

[PROGRESS.md](PROGRESS.md) has the dated record and the known limits. [reviews/](reviews/) holds the independent review reports.

## Run it

You need Node 24.15.0 (see `.nvmrc`) and, for the live app, a free Convex account.

```bash
npm ci
npm test            # 517 offline unit tests, no network
npm run lint
npm run build
npm run test:browser  # needs Google Chrome, tests 390 px and 1440 px
```

The unit tests and the browser tests run without Convex. The browser tests mock the backend.

### Run the app against your own Convex dev deployment

1. Create a Convex project and a dev deployment with `npx convex dev`. Stop it with Ctrl+C once it has written `.env.local`. Check that the file holds `CONVEX_DEPLOYMENT=dev:<name>` and `VITE_CONVEX_URL=<your deployment URL>`. Add the second line yourself if it is missing.
2. Replace the placeholder deployment name with yours. Use the name that appears in `CONVEX_DEPLOYMENT=dev:<name>` in `.env.local`. The command edits five files in `scripts/` and `tests/`, so the working tree shows them as changed.

   ```bash
   grep -rl your-dev-deployment scripts tests | xargs sed -i '' 's/your-dev-deployment/<your-name>/g'
   ```

   On Linux, drop the empty `''` after `-i`. The seed and RBI scripts refuse any deployment other than the one named in the code.
3. Seed the synthetic books. This sets `SEED_ALLOWED`, pushes the functions, and loads the data.

   ```bash
   npm run seed:dev
   ```

4. Set the edit passcode. The prompt hides what you type.

   ```bash
   read -s -p "Edit passcode: " P; echo; npx convex env set EDIT_PASSCODE "$P" --deployment <your-name>; unset P
   ```

5. Build the gap list and store the RBI Bank Rate.

   ```bash
   npx convex run flags:refresh
   node --import tsx scripts/fetch-rbi-rate.mts
   ```

   The second command reads the Bank Rate from rbi.org.in and stores it with today's date.
6. Start the app with `npm run dev` and open the address it prints.

### Commands

- `npm run generate:synthetic` rebuilds the synthetic CSVs, the company master and the SHA-256 manifest. Amounts are integer paise.
- `npm run build:m1-flags` rebuilds the 17 positive AI fixtures from the handwritten cases and the day book.
- `npm run eval:m1` runs the paid AI evaluation. It needs your own Anthropic API key set as a Convex environment variable, refuses any deployment except the one named in the code, and is off unless you set `AI_ALLOWED=dev-only` and `AI_ENABLED=true`.

## How it is built

Rules are pure TypeScript functions in `shared/`. Convex functions in `convex/` load the stored books, call those rules, and store answers and decisions. The React screens in `src/` show the result.

[documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) explains the flow, the data model, the security model, and how the tests work. [documentation/DECISIONS.md](documentation/DECISIONS.md) records why the main choices were made. [documentation/LIMITS.md](documentation/LIMITS.md) lists what the demo does not do.

| Path | Holds |
| --- | --- |
| `shared/` | Rule signals, materiality and ranking, ratios, outcomes, interest, the AI checker (pure functions) |
| `convex/` | Database schema, seed, gap list, the three rule modules, the passcode guard, the AI action |
| `src/` | The gap list and the three detail screens |
| `scripts/` | Synthetic data generator, seed runner, RBI rate fetcher, AI evaluation runner |
| `data/synthetic/` | The fictional company's ledgers, day book, suppliers and master |
| `data/answer-key/` | The planted cases and the Division I account mapping |
| `evidence/m1/` | Published summaries of the M1 evaluation runs and the auditor's answers |
| `docs/` | Rule definitions (`RULES_v1.md`), question themes, the company spec, the review protocol |
| `tests/` | Unit tests, browser tests, and the labelled question bank |
| `reviews/` | Independent review reports |
| `DESIGN.md` | The screen design brief |

`AGENTS.md` and `CLAUDE.md` are the instructions the AI coding agents followed while building this. They, and `PROGRESS.md`, refer to two things that are not published. `private/` holds the author's local planning notes and a decision log, and `artifacts/` holds raw evaluation output. Decision numbers in those files (such as "#33") refer to the private log, and [documentation/DECISIONS.md](documentation/DECISIONS.md) is the public record. Three summaries from `artifacts/m1/` are published under [evidence/m1/](evidence/m1/): `gate.md`, `eval-log.md` and `auditor-answers.md`. They back the M1 numbers in these docs.

## Licence

[MIT](LICENSE). The data in `data/` is synthetic, and every company, person, bank and supplier name in it is fictional. Any resemblance to a real firm is coincidental. The files in `docs/` quote a few real names as examples, such as banks and rating-agency comparables.
