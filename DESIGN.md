# DESIGN.md — Audit-Readiness Check

Read this before building or changing any screen. If a choice is not covered here, ask Swapnil instead of guessing.

Status: approved by Swapnil 21 Oct 2026 (Gate A); Gate B screens built with working words; story mode (section 11) words picked 21 Oct 2026. Anything marked **[WORDS: Swapnil]** is a placeholder; Swapnil writes the final words.

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

## 11. Story mode (M3 public demo)

Approved plan: `artifacts/m3/plan.md`. The public demo wraps the three existing gap screens in a short mission. Words below were picked by Swapnil on 21 Oct 2026, except where marked **[WORDS: Swapnil]**.

### Screens and flow

1. **Briefing.** Heading: "Your first week as controller." Line: "Northfield's books close for audit soon. Three entries look wrong. Find out what they are, decide, and see what each answer does to the loan covenants." Below it: the two covenant meters at their as-booked values and the three case cards. Button: "Start the clock" appears only after a sign-off code is set.
2. **Sign-off code.** Label: "Pick a sign-off code." Help: "You'll enter it each time you approve something, the way a controller signs off. It stays in this browser session and is never shared. Any 4 to 20 characters." Button: "Start the clock".
3. **Case board.** Three cards, each a plain question with its amount and party:
   - "Whose money is this?" (₹2.5 crore, Rajesh Mehta)
   - "Did we pay a small supplier late?" (₹8 lakh, Delta Rubber)
   - "How much of this loan is due this year?" (₹9.6 crore, Meridian Co-operative Bank)
   Each card shows a status chip: Open, Answered, Approved, Sent back.
4. **Case screens.** The existing R1, R2 and R3 detail screens, opened from a card, with a back link to the board. The sign-off code replaces the edit passcode on these screens.
5. **Debrief.** Heading: "Audit-ready?" Line: "Here's what you decided, and what each decision did to the covenants." Then one row per case (the decision, the entry, the covenant effect), the two meters at their final values, and the ending with links to the write-up and the code (see the ending below; "Case closed." shows only once all three cases are decided). Unfinished cases say so; the debrief never invents a decision.

### The covenant meters

- Two horizontal meters, always visible on the board and the debrief: debt-equity against the 1.50 limit (higher is worse) and current ratio against the 1.20 floor (lower is worse). The breaking side of each meter is tinted.
- A meter moves only when a decision is approved, from its current value to the new one (never from zero), 300 ms with a strong ease-out. Value text changes at the same moment. Reduced motion: no movement, the new value appears.
- The meters show the server's figures. They never compute anything in the browser.

### The RBI rate block (R2 screen and debrief)

- Button: "Check today's RBI rate". Under it: "Last checked [date, time] IST · Bank Rate [x]% · Next scheduled change: [date]".
- Pressed while the stored rate is fresh, it says "Already up to date (checked [time])" and does not call RBI. When a visitor's daily presses are used up: "You've checked 3 times today. The rate can only change at an RBI decision." (approved).
- If RBI's page can't be read: "Couldn't read RBI's site. Showing the rate from [date]." Nothing is guessed.

### States

| State | Board | Case screen | Debrief |
| --- | --- | --- | --- |
| Loading | Skeleton cards and meters | Skeleton blocks | Skeleton rows |
| No code yet | Briefing with code field | Back to the briefing | Back to the briefing |
| Error | One sentence and Try again | Same | Same |
| Session expired (after 7 days) | "This session has ended. Start a new one." | Same | Same |
| Limit reached | "You've saved a lot this hour. Try again in a few minutes." | Same | n/a |

### Motion and feel (Emil Kowalski and Apple checks)

- Press feedback on every button: scale 0.97 on press, 120 ms.
- Entrances: case cards and debrief rows fade up from 8 px and 0.97 scale, 200 ms, strong ease-out (`cubic-bezier(.23,1,.32,1)`), staggered 40 ms. Nothing appears from scale 0.
- No animation on actions done often: choosing an answer button, typing the code, opening the same card again.
- Only `transform` and `opacity` animate. Everything is interruptible.
- `prefers-reduced-motion: reduce`: cross-fade only, no movement.
- Status chips change colour without animation. The status word changes with it, so colour is never the only signal.
- One celebration only: when all three cases are decided, the debrief's heading gets a single 300 ms settle. No confetti.

### Layout

- 390 px: one column, meters stacked under the briefing line, cards full width.
- 1440 px: meters in a side column next to the board, cards in a row of three.
- Targets at least 44 px. No sideways scroll.

### Words added while building (approved by Swapnil on 21 Oct 2026)

- Board heading "Case board"; links "Go to the debrief" and "See the code" ("Read the write-up" became "Read how it was built" in the ending below); back link "← Case board".
- Expired session button "Start a new session". Start failure "Couldn't start. Nothing was saved. Try again." Load failure "Couldn't load the story, so nothing here is final."
- Case code field label "Sign-off code"; wrong code "That sign-off code is wrong."; ended session "This session has ended. Start a new one."; daily cap "The demo has reached today's limit. Try again tomorrow."
- Debrief rows: unfinished cases "Not decided yet"; sent-back cases show the "Sent back" chip only; R2 entry "Indicative MSMED interest of ₹X."; covenant results end "holds" or "breaks".
- RBI block: "Updated from rbi.org.in." and "No Bank Rate has been stored yet."
- "Start the clock" is always shown and stays disabled until the code is 4 to 20 characters.
- Meter verdicts: "Within the 1.50 limit", "At the 1.50 limit", "Above the 1.50 limit"; "Above the 1.20 floor", "At the 1.20 floor", "Below the 1.20 floor".
- Debrief entries: "Move ₹X from trade payables to short-term borrowings." or "...to long-term borrowings." (from the entry the server chose); "Move ₹X due within 12 months to current liabilities."; "Interest not priced yet."; "No covenant effect". Covenant lines read "Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks", with "; current ratio 1.23 → 1.34 against the 1.20 floor: holds" added when a long-term R1 loan moves it.
- RBI block: "Couldn't check the rate. Nothing was changed."; "Couldn't read RBI's site." (when no date is stored); "Couldn't load the stored rate. Press the button to try again."; after the last meeting, "No further meeting in RBI's 2026-27 schedule", or "No meeting schedule on file" when none is stored.

### Next case, the ending and the company dashboard (approved by Swapnil on 21 Oct 2026)

- **Next case.** Once a case is decided (approved or sent back), its screen ends with a button: "Next case: Did we pay a small supplier late? →", "Next case: How much of this loan is due this year? →", and after the third "Back to the case board →". The order is the case registry order.
- **Board when done.** When all three are decided, the board shows "All three cases decided." with the button "See your debrief →".
- **Ending.** The debrief ends with "Case closed." and "That's your first week. Fixed rules worked out every number from the books; you made every call." Buttons: "Read how it was built" (the blog post), "Play again" (clears this browser's session and returns to the briefing), "See the code". The blog post links back to the demo, which closes the loop.
- **Company dashboard.** Screen "Northfield's books, FY2025-26", linked from the briefing and the board as "See the company's accounts". Four groups, every figure from the server: Profit and loss (Revenue, Materials, Direct costs, Other expenses, Other income, Profit before tax); Balance sheet (Fixed assets, Inventory, Receivables, Cash and bank, Equity, Borrowings, Trade payables); Ratios (Profit margin, Debt-equity with the 1.50 cap, Current ratio with the 1.20 floor, Receivable days, Inventory days, Payable days); Audit lens (Materiality, Flag line). Amounts in crore or lakh to one decimal. Note: "Year-end trial balance as booked, before your three decisions. Synthetic company." Tables, no charts. Also approved: the back link "← Back to the briefing" when there is no live session, the "days" suffix on the three days rows, the ratio rows reusing the meter verdicts ("Within the 1.50 limit", "Above the 1.20 floor"), and the error line reusing "Couldn't load the story, so nothing here is final." with "Try again".

### Honesty rules for the story

- The mission never rewards a wrong answer. The correct classification breaks a covenant on purpose, and the debrief says so plainly: the covenant breaks because the books are now right, not because the controller failed.
- Every number shown comes from the server's rules, the same as the dev demo.
- Footer on every screen: "Synthetic company and data. Nothing here is advice."
