# DESIGN.md — Audit-Readiness Check

Read this before building or changing any screen. If a choice is not covered here, ask Swapnil instead of guessing.

Status: approved by Swapnil 21 Oct 2026 (Gate A); Gate B screens still to design. Anything marked **[WORDS: Swapnil]** is a placeholder; Swapnil writes the final words.

## 1. Who and what

- User: a finance person at a company (CFO, finance controller) getting ready for the statutory audit. Reads carefully, knows accounting, does not want to be lectured. Uses a laptop; sometimes checks on a phone.
- Job of the product: show what an auditor is likely to ask, how big it is, and what the books look like if the answer goes against the company, before the auditor does.
- Demo company: synthetic (Indian auto-component maker, Tally books). Every screen says figures are synthetic.

## 2. How it should feel

| Word | Means on screen |
| --- | --- |
| Calm | No red walls. Red only for a covenant that would break. |
| Exact | Every number has its source one tap away (the entries behind it). |
| In control | The product proposes; the person decides. Nothing is final until they approve. |
| Plain | Accountant's words, short sentences. No "AI magic" language. |

## 3. References (Take / Ignore)

| Reference | Take | Ignore |
| --- | --- | --- |
| Tally day book and ledger views | Dense rows, right-aligned numbers, Dr/Cr columns, voucher numbers as the handle | Menu-heavy chrome, keyboard-only navigation |
| An auditor's issues list (working paper) | One line per issue: ref, area, amount, status | Spreadsheet gridlines everywhere |
| Linear / Mail list-and-detail | List on the left, detail on the right on wide screens; list then detail on narrow | Keyboard shortcut layers, animations on every move |
| Apple Notes / Settings on phone | One thing per screen at 390px, large tap targets | Decorative translucency |

## 4. Type, colour, space

- Font: system UI stack (`system-ui, -apple-system, "Segoe UI", sans-serif`). Numbers use `font-variant-numeric: tabular-nums`.
- Scale: 13 / 15 / 17 / 22 / 28 px. Body 15 px, line-height 1.5. Headings tighter (1.2) with slight negative tracking.
- Money: Indian grouping (₹1,50,00,000), shown in ₹ crore / lakh in headlines, full rupees in tables. Always right-aligned.
- Colour tokens (light and dark both defined): background, surface, text, muted text, border, accent (one blue), warning (amber, for "flagged"), danger (red, covenant breach only), ok (green, "within covenant").
- Contrast: text at least 4.5:1. Colour is never the only signal; every status also has a word.
- Space: 4 px base; gutters 16 px at 390 px, 24 px at 1440 px. Max content width 1100 px.
- Tap targets at least 44 px high.

## 5. Screens (Gate A builds 1; Gate B builds 2–4)

1. **Gaps list** (Gate A). Ranked list of flagged items. Each row: rule name in plain words, party or ledger, size in ₹, size as % of the flag line, status chip (Open / Answered). Header: company, year, "overall materiality ₹X · flag line ₹Y".
2. **Gap detail** (Gate B). The entries behind the flag; the question; the answer options; the documents to ask for (listed by code).
3. **Outcome** (Gate B). The fixed outcome in one sentence, the proposed reclassification entry, and a before / after table for debt-equity with the covenant line (1.50) and a plain verdict.
4. **Approval** (Gate B). Approve or send back. Nothing is written to the books; the product only records the decision.

### States (every screen)

| State | Gaps list | Detail / outcome |
| --- | --- | --- |
| Loading | Skeleton rows, same height as real rows; no spinner text | Skeleton blocks |
| Empty | "No gaps above the flag line." plus how the flag line was set | "Nothing to review here." |
| Error | One sentence, retry button, nothing partial shown as final | Same, plus "Nothing here is final." |
| Done | All rows Answered: header says so | Outcome shown with Approve / Send back |
| AI could not word the question | n/a | Show the fixed-wording fallback question and the note "Wording not ready"; the flag still works |
| Daily AI limit reached | n/a | Same fallback; one line saying why |

### Words on screen

Chosen by Swapnil (21 Oct 2026): heading "Gaps an auditor is likely to raise"; empty state "No gaps list yet. The books haven't been checked."; status chip "Open" (later Answered, Approved); chip for a listed party "Possible related party". Button labels and the Gate B screens are still **[WORDS: Swapnil]** (placeholders until written).

Rules for any words: say "gap" or "flag", not "exception" or "finding" (those are the auditor's words); never say "AI decided"; the AI only words a question. Never state a legal conclusion; say what the books show and what the auditor will ask.

## 6. Motion

- Rare actions only. List row open: 180 ms ease-out slide of detail, no bounce. Button press: scale 0.97, 120 ms.
- No animation on list sort or filter (used repeatedly).
- Respect `prefers-reduced-motion` (use a plain fade) and `prefers-contrast`.
- Animate only `transform` and `opacity`.

## 7. Layout rules

- 390 px: one column, list then detail; sticky header shows materiality line.
- 1440 px: list (420 px) and detail side by side.
- No horizontal page scroll at any width; tables scroll inside their own box.
- Checked in the browser at 390 px and 1440 px, in light and dark, before any gate closes.

## 8. Principles (the test for any choice)

1. Show the number and the evidence behind it together.
2. The person decides; the product proposes.
3. If unsure, say so plainly and show the fixed wording; never fill a gap with a guess.
4. Common path first; detail one tap deeper.
5. Same thing looks and behaves the same everywhere.
6. Synthetic data is labelled as synthetic on every screen.

## 9. Accessibility

Real buttons and links, visible focus ring, labels on every control, status announced with `aria-live="polite"`, list is a real list, tables have header cells.

## 10. Open questions for the author

1. Currency display: lakh/crore in headlines and full rupees in tables, or full rupees everywhere?
2. Status words: Open / Answered / Approved, or something else?
3. Dark mode in the demo: include or skip (saves time)?
