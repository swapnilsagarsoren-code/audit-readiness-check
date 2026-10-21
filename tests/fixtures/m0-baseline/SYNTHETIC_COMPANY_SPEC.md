# SYNTHETIC_COMPANY_SPEC — test company for v1

Status: v1, corrected 13 Oct after the checker review (fictional bank/insurer/customer names, Vega Castings moved to decoys, missing amounts and names filled). **Approved by Swapnil 13 Oct 2026 as the M0 dataset (decision log #18).** Addendum A (credible company: cost mix, balance sheet, covenant story, background data) added and approved 13 Oct 2026 (decision log #22).
Relation to PLAN §8: this is the M0 dataset. Swapnil's mess patterns (due Wed 14) EXTEND it (more planted cases, aiming at ~10 per check); they do not replace it. Seed charts (Odoo, ERPNext, Tally groups) feed the ledger list.

Everything here is invented. No real company, person or client data. Deterministic: same seed → same files.

## Company master (company.json)
- Name: Northfield Auto Components Pvt Ltd (fictional). Unlisted private company, manufacturer of brake and suspension parts. FY2025-26 (1 Apr 2025 – 31 Mar 2026). Schedule III **Division I**.
- Scale (synthetic, chosen for test design): revenue from operations ≈ ₹150 crore; profit before tax ≈ ₹9 crore (6% margin).
  - Materiality per PLAN.md §7: 1% of revenue ≈ ₹1.50 cr; 5% of PBT ≈ ₹45 lakh → overall ≈ ₹45 lakh; flag ≥ 50% ≈ ₹22.5 lakh; clearly trivial < 5% ≈ ₹2.25 lakh. (Computed by code from the generated TB, not hard-coded.)
- Directors: Rajesh Mehta (MD), Sunita Rao. Relatives of directors: Anita Mehta (spouse of MD), Mehta Family Trust (MD is a trustee). Shareholders: Rajesh Mehta, Sunita Rao, Northfield Holdings Pvt Ltd.
- Inputs (stored, editable, with source note "synthetic input"): company tax rate, covenant thresholds (current ratio ≥ 1.20; debt-equity ≤ 1.50), RBI Bank Rate placeholder = `null` until fetched from RBI with date.

## Files (CSV, Tally-export-like)
- `ledgers.csv`: ledger_name, tally_group, opening_dr, opening_cr. About 60 ledgers across Tally's default groups. The correct Division I head for each ledger goes only in `data/answer-key/div1-mapping.csv` (answer key).
- `daybook.csv`: date, voucher_no, voucher_type (Sales/Purchase/Payment/Receipt/Journal/Contra), ledger, dr, cr, party, narration, entered_by, entered_at. About 2,500 lines over 12 months; every voucher balances.
- `suppliers.csv`: supplier, msme_status (Micro/Small/Medium/Not registered/blank), written_credit_days (blank = no written terms).
- `answer-key/planted.json`: for every planted case: id, rule (R1–R5), ledger, voucher_no(s), correct question theme/facet, correct option, correct outcome, expected ₹ impact. **Never sent to the AI, never shown in the UI.**

## Planted cases (positives above and below the flag threshold, plus decoys)
| Rule | Positives | Decoys (must NOT flag) |
|---|---|---|
| R1 loan in creditors | Rajesh Mehta under Sundry Creditors: ₹2.50 cr in 3 round NEFT receipts, narration "temporary funds from MD", no purchases. Anita Mehta under Unsecured Loans ₹60 lakh "loan recd". Mehta Family Trust under Sundry Creditors ₹50 lakh "recd for working capital". Sharma Traders ₹10 lakh round receipts, no invoices (below threshold) | Kaveri Steel Traders ₹10 lakh and Lotus Paints ₹5 lakh: round-amount payments, each against a purchase invoice |
| R2 MSME late payment | Bharat Fasteners (Micro, written 45 days): ₹56 lakh in the year, one bill of ₹5.6 lakh paid at day 68. Delta Rubber (Small, no written terms): bill of ₹8 lakh paid at day 30 (over the 15-day default). Kumar Packaging (status blank, no written terms): bill of ₹1.9 lakh unpaid at day 52 → expected outcome "Unknown → ask for Udyam status" | Sai Precision Springs (Micro, written 45 days): ₹6 lakh paid at day 40. Vega Castings (Medium, no written terms): ₹12 lakh paid at day 90 → must NOT get MSMED interest (Chapter V covers micro and small only) |
| R3 term loan split | Meridian Co-operative Bank Term Loan ₹12 cr, 60 monthly EMIs from Apr 2025, principal ≈ ₹2.4 cr due within next 12 months, no current-maturities ledger | Unity Commercial Bank Cash Credit ₹1.1 cr (already short-term) |
| R4 capex in repairs | Kaveri Machine Tools ₹38 lakh "new spindle assembly installed on VMC-3"; Om Constructions ₹1.2 cr "construction of new shed – running bill 2"; Arena Motors ₹22 lakh "purchase of new MPV for sales team" (just below threshold) | Shree Engineering Works ₹45,000 "quarterly servicing – compressor"; Colour Craft Painters ₹3 lakh "repainting of office" |
| R5 non-sales income in sales | Gupta Scrap Dealers ₹45 lakh "sale of MS scrap"; Kestrel General Insurance ₹30 lakh "claim recd – fire at stores"; Export Incentive Authority (fictional) ₹25 lakh "RoDTEP credit"; Meridian Co-operative Bank ₹12 lakh "FD interest"; Corvel Bank ₹9 lakh "exchange gain on USD receivable"; Patel Enterprises ₹40 lakh "sale of old lathe machine" | Zenvar Motors Ltd ₹42 crore of genuine product sales across the year |

## Tests the generator must pass
- Trial balance debits = credits; every voucher balances.
- Same seed → byte-identical files.
- Every planted case exists exactly as specified; decoys exist.
- No name in the files matches a list of real company names used anywhere in docs (only the invented names above + generated filler names from a fixed fictional list).

---

## Addendum A — a credible company (approved by Swapnil 13 Oct 2026, decision log #22)

Why: the first generated set hit the pinned numbers, but one year-end journal of ₹135.68 cr was 96% of all costs; fixed assets, stock and debtors were zero; each planted case was the only line in its ledger; and no covenant could ever break. Cause: this spec had no cost mix or balance sheet. Everything above stays; this section adds to it.

**Unchanged:** every planted case and decoy above (names, amounts, dates, narrations); revenue from operations exactly ₹150,00,00,000 and profit before tax exactly ₹9,00,00,000 (as booked, before any fix); materiality inputs (so overall ≈ ₹45 lakh, flag line ≈ ₹22.5 lakh); fictional names only; determinism. All amounts net of GST.

### A1. Cost mix (as booked, % of revenue from operations, each within ±2 points)
Source: ACMA, "Financial analysis Q1 FY24", aggregate of 68 listed Indian auto-component makers: material cost ≈ 62–64% of net sales, employee ≈ 10–11%, depreciation ≈ 3%, finance cost ≈ 1%, EBITDA ≈ 10–11%. https://www.acma.in/uploads/ciculer-attachement/ACMA_Financial%20analysis_Q1_FY24.pdf
- Materials (purchases ± stock change): ~63%
- Employee costs (wages + salaries): ~10.5%
- Depreciation on opening fixed assets: ~3%
- Finance costs (interest on the loans below + bank charges): 1–2%
- Other expenses (power, freight, rent, insurance, repairs, professional fees, travel, etc.): the rest, so PBT = ₹9 cr
- Any PBT balancing amount is a single voucher of ≤ ₹50 lakh within routine provisions — never a large year-end plug.

### A2. Balance sheet (closing, as booked)
Comparables: CRISIL rating rationales for unlisted auto-component makers — Marathwada Auto Compo Pvt Ltd (FY25: receivables 56 days, inventory 21 days, raw-material credit 50–60 days, gearing 1.51x, current ratio 0.82x) and IM Gears Pvt Ltd (FY25: receivables ~94 days, gearing 0.97x, current ratio 1.45x).
- Receivable days 55–75; inventory days 20–45; bills settled on credit terms, not the same day.
- Payables: non-MSME vendors 50–60 days. Micro/Small background vendors are always paid within their terms (≤ 45 days written, ≤ 15 days with no written terms), so R2 only fires on the planted cases.
- Old asset base: gross block ≈ ₹45 cr, accumulated depreciation ≈ ₹27 cr at the start of the year; the year's depreciation ≈ 3% of revenue. Plant & Machinery includes the old lathe sold in R5 (its book value goes in the answer key). Stores inventory exists (so the "fire at stores" claim makes sense).
- Closing stock is posted by one year-end Stock-in-Hand journal (Tally style).
- Opening retained earnings balance the opening trial balance.
- Extra borrowing so the ratios land in range: one working-capital demand loan under **Bank OD A/c**, named e.g. "Unity Commercial Bank WCDL" (the name must not contain "term" or "loan"). It is an R3 decoy. Do NOT add any "current maturities" ledger: R3 must still flag the Meridian loan.

### A3. Covenant story (the demo's key moment)
Ratios per ICAI GN Div I Annexure B, as used in RULES_v1: debt-equity = total debt ÷ shareholders' equity; current ratio = current assets ÷ current liabilities. Covenants: current ratio ≥ 1.20, debt-equity ≤ 1.50.
- As booked: current ratio 1.21–1.25; debt-equity 1.38–1.45; shareholders' equity ≤ ₹20 cr.
- After the R3 fix alone (Meridian principal due within 12 months, ≈ ₹2.4 cr, moved to current liabilities): current ratio < 1.20.
- After the R1 fix alone (R1 positives above the flag line, Rajesh Mehta ₹2.5 cr + Mehta Family Trust ₹0.5 cr, moved from trade payables to borrowings): debt-equity > 1.50.
- Worked target that balances (₹ cr, checker round 2): equity 15.2 (capital 2 + opening retained earnings ≈ 4.2 + PBT 9); debt 21.3 (Meridian 9.6, Anita Mehta 0.6, cash credit 1.1, WCDL ≈ 10); current liabilities ≈ 30.1; current assets ≈ 37.0 (debtors ≈ 27, inventory ≈ 9, cash ≈ 1); net fixed assets ≈ 18.5. Gives CR 1.23 → 1.14 after R3, D/E 1.40 → 1.60 after R1.

### A4. Background data (so planted cases sit among normal lines, with zero unplanted flags)
- 8–12 customers and 25–40 vendors from a fixed fictional name list; Zenvar Motors Ltd stays at ₹42 cr. No single party except Zenvar has more than 20% of day-book lines.
- Background vendors: Medium or Not registered (no blank MSME status), or Micro/Small paid within terms.
- No bank receipts into any creditor ledger except the planted R1 cases.
- Background repairs: each < ₹20 lakh, no R4 keywords ("new", "replacement", "installation", "upgrade", "construction"), no fixed-asset vendors.
- Background Sales narrations: no R5 keywords (scrap, claim, insurance, interest, rent, incentive, RoDTEP, exchange gain, sale of machine/asset) — avoid the word "machine" entirely (say "precision parts", not "machined parts").
- Small genuine other income goes to Other Income, never to Sales.
- 2–4 `entered_by` users and varied `entered_at` times (cosmetic only).
- Day book stays about 2,500 lines (±20%).

### A5. Tests to add
- Each A1 percentage within its band; balancing voucher ≤ ₹50 lakh.
- Closing fixed assets, inventory and trade receivables > 0.
- A3: the three ratio checks (as booked; after R3 alone; after R1 alone) and equity ≤ ₹20 cr.
- Party concentration cap (A4).
- Guard tests: running a simple version of each R1–R5 code signal over the background data (everything except planted cases and decoys) finds zero hits.
- Every planted case still matches the hand-written fixture.
- gate.md reports the achieved values for A1–A3.
