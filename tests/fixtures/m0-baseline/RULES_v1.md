# RULES_v1 — the 5 demo checks (Division I)

Approved by Swapnil 13 Oct 2026 (decision log #19), with the [TBC] items to be closed from official text before M2 (the rules milestone).
Every rule: code raises the flag, the AI only reads and words the question, the answer + fixed outcome decide, the controller approves. Every rule carries `effectiveFrom` / `fy`.
Citations: official texts in sources/official/ (see VERIFICATION.md). "[TBC]" = to confirm in the official text before coding.

---

## R1 · Loan hiding in creditors (likely director / related-party loan)
- **Code signal:** ledger under Sundry Creditors or Unsecured Loans where (a) credits are receipts from bank in round amounts, (b) no purchase vouchers in the period, or (c) interest is debited. Plus: ledger name matches the directors/relatives list in company master, or looks like a person's name (AI).
- **AI reads:** ledger name, party name, narrations ("temporary funds from MD", "loan recd"). Picks Theme 2 (what was exchanged), then Theme 1 (counterparty) if the answer is "loan".
- **Q2 options:** Goods/services supplied · Loan · Advance against future supply · Security deposit · Not sure
- **Q1 options (if Loan):** Director · Relative of a director · Shareholder · Group company · Other · Not sure
- **Follow-up (Q3):** Repayment terms: within 12 months · after 12 months · on demand / no terms
- **Fixed outcomes (Div I):**
  - Loan → reclass from Trade payables to Borrowings; related-party loan shown as "Loans and advances from related parties" (Sch III Div I, short-term borrowings item (b) / long-term borrowings; ICAI GN Div I 8.3.1.21). Long- vs short-term per the Q3 answer.
  - Director / relative → related-party disclosure (AS 18); **Deposit Rules check:** loan from a director is excluded from "deposit" only with the director's written declaration that the money is not borrowed (Deposit Rules r.2(1)(c)(viii) [clause number 🟡 partly verified]). No declaration → "Legal review needed" (not priced).
  - Goods/services → no change. Not sure → escalate to owner.
- **₹ / ratio impact (code):** Debt-equity ratio before/after = Total Debt ÷ Shareholders' Equity (ICAI GN Div I, Annexure B). Current ratio before/after (changes only if the loan is long-term).

## R2 · MSME supplier paid late
- **Code signal:** supplier marked micro or small in master, bill unpaid (or paid) beyond the appointed day: agreed period in writing (max 45 days) else 15 days from acceptance (MSMED Act s.2(b), s.15).
- **AI reads:** supplier names/narrations to spot suppliers with **missing** MSME status. Theme 8 question.
- **Q8 options:** Micro · Small · Medium · Not registered · Unknown. Follow-up: written credit terms? (days) / none.
- **Fixed outcomes:**
  - Micro/Small + overdue → accrue interest (s.16), disclose in MSME note (Sch III Div I trade payables MSME line), interest not deductible (s.23).
  - Tax: expense not deductible until paid — FY2025-26: Income-tax Act 1961 s.43B(h); FY2026-27: Income-tax Act 2025 s.37(2)(g) (verified 13 Oct).
  - Medium / not registered → no MSMED interest (Chapter V protects micro and small only).
  - Unknown → escalate (ask for Udyam certificate).
- **₹ impact (code):**
  - Interest = principal compounded with monthly rests at 3 × RBI Bank Rate (s.16), from the appointed day to payment date or year-end. **Bank Rate is fetched from RBI's official site with date and stored; never typed in.**
  - Tax effect = overdue amount unpaid within the s.15 period × company tax rate (input in company master, not hard-coded).

## R3 · Term loan with no current-maturity split
- **Code signal:** ledger under Secured/Unsecured Loans with "term loan" in name (or AI match) and no "current maturities" ledger or repayment schedule on file.
- **AI reads:** ledger name, disbursement narration. Theme 3 question.
- **Q3:** "How much principal falls due before next 31 March?" (₹ input + upload schedule) · Repayable on demand · No fixed schedule · Not sure
- **Fixed outcomes (Div I):** amount due within 12 months → "Current maturities of long-term borrowings" under short-term borrowings (Sch III Div I Note 6 F(v), 2021; ICAI GN Div I §8 notes non-current and current portion per category). On demand → "Loans repayable on demand".
- **₹ / ratio impact (code):** Current ratio before/after = Current Assets ÷ Current Liabilities (ICAI GN Div I, Annexure B). Covenant check if the user enters the covenant threshold.
- Note: Ind AS 1 covenant rules (FY25-26 vs FY26-27) apply to Division II only — out of v1.

## R4 · Capital spend booked as repairs
- **Code signal:** Repairs & Maintenance entry ≥ flag threshold, and (a) vendor in fixed-asset vendor list, or (b) narration words "new", "replacement", "installation", "upgrade", "construction".
- **AI reads:** narration + vendor. Theme 4 question.
- **Q4 options:** Routine upkeep · Extends life or capacity · New asset · Replaces a whole major part · Part of a project still being built · Not sure
- **Fixed outcomes:** upkeep → no change; extends life / new / major part → capitalise to PPE (AS 10 paras 7, 12–13); project still being built → CWIP; not sure → escalate.
- **₹ impact (code):** Profit before tax increases by the amount capitalised less depreciation from the put-to-use date (useful life from company policy; default from Companies Act Schedule II [TBC: exact Part C line]). Shows PPE and expense before/after.

## R5 · Non-sales income booked as sales
- **Code signal:** credits in Sales ledgers with narration keywords: scrap, claim, insurance, interest, rent, incentive, RoDTEP, exchange gain, sale of machine/asset.
- **AI reads:** narration + party. Theme 2 question.
- **Q2 options:** Sale of products · Manufacturing scrap · Export incentive · Insurance claim · Interest · Rent · Foreign-exchange gain · Sale of a fixed asset · Not sure
- **Fixed outcomes (Div I, ICAI GN Div I 9.1.8–9.1.10):**
  - Manufacturing scrap → Other operating revenue (within revenue from operations) — GN 9.1.9
  - Profit on sale of a fixed asset → Other income — GN 9.1.9 (and the asset's book value leaves PPE)
  - Net foreign-exchange gain → Other income — GN 9.1.10
  - Rent → depends on whether leasing is part of operations — GN 9.1.8 → escalate with a follow-up question
  - Interest on deposits → Other income [TBC in GN Div I]
  - Export incentive, insurance claim → [TBC in GN Div I before coding]
- **₹ / ratio impact (code):** Revenue from operations before/after; ratios that use it recomputed per ICAI GN Div I Annexure B.

---

## Shared settings
- Materiality: overall = lower of 1% of revenue and 5% of PBT (tool policy; SA 320 A6 examples); flag ≥ 50% of overall; ignore < 5%.
- Every flag stores: rule id + version, evidence entry ids, the AI's quoted fields (checked by code to exist), question shown, answer, who, when, outcome, approver.
- The AI may never: invent options, amounts, parties or outcomes; drop "Not sure"; mark anything final.
