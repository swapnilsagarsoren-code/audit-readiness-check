# Audit-Readiness Check — question themes and the AI variant bank

Draft, 13 Oct 2026. Groups the full question bank (147 rows in QUESTION_BANK.md) into 10 themes, and defines what the AI may and may not do with them.

## 1. How the two banks work together

- **Codified bank (code owns it):** theme → facets → fixed answer options → fixed outcome per option → evidence to ask for. Changes only through the decision log.
- **AI variant bank (AI writes, code checks):** for each flagged transaction the AI picks a theme and the facets that apply, then writes the question in that transaction's own terms (amount, party, ledger, date). It can write several versions so the controller is asked about every aspect (facet) of the transaction, one question at a time.
- **The AI may:** pick theme + facets from the signals; word the question plainly; write follow-ups when an answer opens a branch; turn a free-text reply into one of the fixed options, quoting the reply, for a person to confirm.
- **The AI may not:** invent answer options, outcomes, amounts or rules; decide the outcome; skip the 'Not sure' option.
- **Every variant must:** name the amount, ledger/party and date; ask one thing; use the fixed options; be checked by code (amount, party and ledger exist in the data).
- **Two audiences, same engine:** CFO view = 'What is this?' + ₹ impact + owner + deadline. Auditor view = assertion + evidence request + standard reference, phrased as a client query. Store both wordings per facet. v1 still builds one view first.
- **Promotion:** variants that controllers answered without asking back are reviewed by Swapnil and added to the codified bank as new standard wordings.

## 2. Coverage

| Theme | Rows in bank |
|---|---|
| 1. Who is the counterparty? | 12 |
| 2. What was exchanged? | 25 |
| 3. When is it due or realised? | 12 |
| 4. Capital or revenue? | 11 |
| 5. Is it still valid and recoverable? | 22 |
| 6. Which period does it belong to? | 17 |
| 7. Is it restricted, pledged or held for others? | 6 |
| 8. What is its legal or regulatory status? | 22 |
| 9. Gross or net, and how measured? | 12 |
| 10. Why was this entry passed? | 8 |
| **Total** | **147** |

## 3. The themes

### Theme 1. Who is the counterparty?

**Why it matters:** Related-party, director and employee balances need separate presentation, approvals and disclosure; a person's name in a trade ledger is the most common nature-vs-name gap.

| Facet | Asks | Assertion |
|---|---|---|
| 1a Identity | Who is this party? | E / P |
| 1b Relationship | Is the party a director, KMP, relative or group company? | P (Ind AS 24 / AS 18) |
| 1c Approval | Was board / shareholder approval taken (s.185 / s.188 / s.197)? | P / compliance |
| 1d Terms | Interest, repayment date, arm's length? | CL / V |
| 1e Disclosure | Is it shown separately where the law requires? | P |

- **Fixed options:** Customer · Supplier · Director/KMP · Relative of a director · Employee · Group company · Other unrelated · Not sure
- **Outcomes (rules):** Related party → disclosure + approval check; director dues → show separately; employee → staff advance (other financial assets); trade party → no change; Not sure → escalate to owner
- **Evidence to ask for:** Party master / PAN, board minutes, agreement, register of contracts (s.189)
- **AI variant examples** (illustrative, synthetic data):
  - “₹4.2 lakh sits in Sundry Debtors under ‘Rajesh Mehta’. Who is Rajesh Mehta to the company?”
  - If Director: “Was this amount approved by the board, and is there a date by which it will be repaid?”
  - Payroll version: “‘Priya Mehta’ is paid ₹60,000 a month as salary. Is she related to any director?”

**Bank rows in this theme (12):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A2.3 | Investments | P | Subsidiary/associate/JV, firm/LLP partner, or unrelated? (signal: Pvt Ltd / LLP / "& Co") | GN-II 8.1.8 · 📘 ICAI guidance only |
| A4.1 | Trade receivables | CL/P | Customer, director/relative/KMP, employee, other? (signal: Person's name under Sundry Debtors) | GN-II 8.1.9, 8.1.15; Ind AS 24 · ✅ Verified (+ICAI GN) |
| A5.1 | Loans, advances, other assets | CL/P | Promoter/director/KMP, relative, group co, unrelated? Repayment schedule? (signal: Person/group co under Loans & Advances; no interest) | Sch III 2021 (on-demand / no-terms loans); CARO 3(iii)(f), 3(iv); s.185 · ✅ Verified |
| B2.7 | Borrowings | CL/P | Director, relative, shareholder, other? Declaration not borrowed? (signal: Person's name, round-sum receipts) | Deposit Rules 2(1)(c)(viii); s.73; CARO 3(v) · ✅ Verified |
| B2.8 | Borrowings | CL | Group or unrelated company? (signal: Loan from a company) | Deposit Rules 2(1)(c)(vi); related party · 🟡 Partly |
| B3.8 | Trade payables | P | Related party? (signal: Name matches director/group co) | Ind AS 24 / AS 18; SA 550 · ✅ Verified |
| C1.8 | Revenue vs other income | E | Unrelated, group co, director-linked? (signal: Customer matches director/group) | s.188; CARO 3(xiii) · ✅ Verified |
| C3.1 | Employee costs | E/P | Director, relative in office of profit, unrelated? Approval? (signal: Salary payee matches director/relative) | s.197, s.188(1)(f); Ind AS 24 · ✅ Verified |
| C3.2 | Employee costs | CL | Who controls hours/work? (signal: Same people via manpower vendor) | Ind AS 19; labour codes [verify] · ⚪ Judgment |
| C3.6 | Employee costs | E | On PF/ESI roll? If not, why? (signal: No PF/ESI, cash, round amounts) | SA 240 · ✅ Verified |
| C5.3 | Other expenses | E | Business or personal (recovered/perquisite)? (signal: School fees, family travel, club) | SA 240 · 🟡 Partly |
| C5.7 | Other expenses | E/P | Related? Arm's length? Approved? (signal: Payee is director's firm) | s.188; Ind AS 24; CARO 3(xiii) · ✅ Verified |

### Theme 2. What was exchanged?

**Why it matters:** Decides trade vs borrowing vs advance vs deposit vs other income: the core classification split.

| Facet | Asks | Assertion |
|---|---|---|
| 2a Consideration | Goods/services, or money only? | CL |
| 2b Direction | Did we give or receive it? | CL |
| 2c Purpose | What was it for? | CL / P |
| 2d Refundable | Must it be returned? | CL / R |
| 2e Interest | Does it carry interest? | CL |

- **Fixed options:** Goods/services supplied · Loan · Advance against future supply · Security deposit · Claim / refund · Capital / share money · Sale of a fixed asset · Not sure
- **Outcomes (rules):** Goods/services → trade; loan → borrowings / loans given (Deposit Rules check); advance → contract liability or advance to supplier; deposit → other financial asset/liability; claim → other financial asset / other income
- **Evidence to ask for:** Invoice or PO, loan agreement, deposit receipt, customer order
- **AI variant examples** (illustrative, synthetic data):
  - “‘Sharma Traders’ shows a credit of ₹12 lakh received in three round amounts with no sales invoices. What was this money for?”
  - “A credit of ₹3.8 lakh in Sales has the narration ‘scrap sale – Mar’. Was this (a) sale of your products, (b) scrap from production, (c) something else?”

**Bank rows in this theme (25):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A2.2 | Investments | CL | Bank FD, mutual fund, or shares/bonds? (signal: "FD – [bank]" under Investments) | GN-II 8.1.11, 8.1.16 · 📘 ICAI guidance only |
| A3.2 | Inventories | CL/P | Split RM / WIP / FG / traded / spares / tools? (signal: One "Stock-in-Hand" ledger) | GN-II 8.1.13(i) · 📘 ICAI guidance only |
| A4.2 | Trade receivables | CL | Normal sale, asset sale, claim, other? (signal: Debtor for insurance claim, asset sale, rent) | GN-II 8.1.9 → other financial assets · 📘 ICAI guidance only |
| A4.3 | Trade receivables | CL | Customer advance, refund due, unposted invoice? (signal: Debtor in credit) | Reclass to liabilities [I]; Deposit Rules if > 365 days · 🟡 Partly |
| A5.2 | Loans, advances, other assets | CL | Against PO (delivery date), no order, refund due? (signal: Advance > 365 days or > open orders) | May be a loan; CARO 3(iii) · ✅ Verified |
| A5.4 | Loans, advances, other assets | CL | Refundable or adjustable against rent? (signal: Rent/electricity deposits) | Div II other financial assets; Div I other non-current assets · ✅ Verified |
| A6.5 | Cash and bank | CL | Sanctioned OD/CC, or unpresented cheques? (signal: Bank ledger in credit) | GN-II 8.1.16 · 📘 ICAI guidance only |
| B1.4 | Equity | CL | Shares issued, director loan, advance against shares? (signal: "Capital A/c – Mr X") | Sch III; Deposit Rules [I] · 🟡 Partly |
| B1.5 | Equity | CL | Fixed redemption date? Mandatory dividend? (signal: Redeemable preference shares) | Ind AS 32 [I] · ⚪ Judgment |
| B1.6 | Equity | P | Accumulated loss? Show negative under surplus (signal: Debit P&L balance under assets) | Sch III Div I · ✅ Verified (+ICAI GN) |
| B2.9 | Borrowings | C/CL | OD/CC or unpresented cheques? (signal: Bank ledger in credit) | Sch III "repayable on demand" · ✅ Verified |
| B3.5 | Trade payables | CL | Advance, pending debit note, capital advance? (signal: Supplier in Dr) | Reclass to assets [I] · ⚪ Judgment |
| B3.6 | Trade payables | CL | Goods/services, loan, advance? (signal: Round sums, no invoices, interest) | Trade payable = goods/services only [I]; Deposit Rules · 🟡 Partly |
| B4.1 | Other liabilities | CL | Advance, excess receipt, security deposit? (signal: Debtor in Cr) | Deposit Rules 2(1)(c)(xii)(a) (365 days) · 🟡 Partly |
| B4.2 | Other liabilities | CL/R | Refundable? For performance of supply? (signal: "Dealer deposits") | Deposit Rules 2(1)(c)(xii)(c) · 🟡 Partly |
| C1.1 | Revenue vs other income | CL | Sale, production scrap, export incentive, claim/rent/interest? (signal: Sales credits: "scrap", "RoDTEP", "claim", "rent") | Sch III P&L · ✅ Verified |
| C1.2 | Revenue vs other income | CL | Customer interest, FD interest, forex on trade or on borrowings? (signal: "Interest recd", "exch gain" in Sales) | Sch III; Ind AS 21; Ind AS 23 6(e) · 🟡 Partly |
| C1.7 | Revenue vs other income | P | Split by product, domestic/export, timing? (signal: One "Sales" ledger) | Ind AS 115 · ✅ Verified |
| C2.1 | Materials and purchases | CL | Consumed in production or resold as-is? (signal: Traded SKUs in RM purchases) | Sch III separate heads · ✅ Verified |
| C3.5 | Employee costs | P | Split salaries, contribution to provident and other funds, share-based payment (ESOP), staff welfare? (signal: One "Salary & wages" ledger) | Sch III · 🟡 Partly (fixed) |
| C4.1 | Finance costs | CL | Loan-linked upfront fee or transaction fee? (signal: Processing fee in bank charges) | Ind AS 109 EIR; Ind AS 23 · ✅ Verified |
| C4.2 | Finance costs | CL | Compensatory interest or penalty? (signal: "Interest – vendor" in other expenses) | ICAI EAC vol 43 q41 → finance costs · ✅ Verified |
| C4.4 | Finance costs | CL | Compensatory or penalty? Income-tax interest (policy)? (signal: "Int on TDS/GST/IT" in finance cost) | ITFG Bulletin 17 Issue 8 (by analogy: it covers local-authority taxes) · 🟡 Partly (fixed) |
| C5.6 | Other expenses | P | Audit, tax, company law, other, reimbursement? (signal: Audit fee includes other services) | Sch III additional information · ✅ Verified |
| C5.8 | Other expenses | P | Show separately? (signal: Item above the higher of 1% of revenue and ₹1 lakh (Div I) / ₹10 lakh (Div II) inside "Misc") | Sch III Part II general instructions (Div I ₹1,00,000; Div II para 7(c) ₹10,00,000) · 🔧 Corrected |

### Theme 3. When is it due or realised?

**Why it matters:** Current vs non-current, cash equivalents vs other bank balances, current maturities: pure timing questions.

| Facet | Asks | Assertion |
|---|---|---|
| 3a Original term | What was the original period? | CL |
| 3b Remaining term | How long from 31 Mar until due? | CL |
| 3c Schedule | Is there a repayment schedule? | CL / P |
| 3d On demand | Repayable on demand or no terms? | P |
| 3e Covenants | Any breach that makes it payable now? | CL |

- **Fixed options:** Original term ≤ 3 months · Due within 12 months · Due after 12 months · Repayable on demand · No fixed terms · Not sure
- **Outcomes (rules):** Split current / non-current; FD → cash equivalent / other bank balance / non-current; term loan → current maturities to short-term borrowings; on-demand/no-terms loans → disclosure
- **Evidence to ask for:** Repayment schedule, FD receipt, sanction letter, covenant certificate
- **AI variant examples** (illustrative, synthetic data):
  - “Term loan from HDFC Bank: ₹2.4 crore in one ledger. How much principal is due before next 31 March?”
  - “FD of ₹50 lakh is in Bank Accounts. What was its original term when opened?”

**Bank rows in this theme (12):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A2.1 | Investments | CL | Sold/redeemed by next 31 Mar? Maturity date? (signal: No maturity/intent recorded) | GN-II 8.1.14 · 📘 ICAI guidance only |
| A4.4 | Trade receivables | P | Dues by due date: <6m, 6m–1y, 1–2y, 2–3y, >3y (signal: Bill-wise off) | Sch III 2021 · ✅ Verified |
| A4.8 | Trade receivables | CL | Due after 12m / operating cycle? (signal: Retention money, long instalments) | GN-II 8.1.15 · 📘 ICAI guidance only |
| A5.6 | Loans, advances, other assets | CL | Per assessment year: assessed? Refund in 12m? (signal: TDS/advance tax over many years) | GN-II (Jan 2022) 8.1.19: per assessment year, not cumulative · 🔧 Corrected |
| A6.1 | Cash and bank | CL | Original term ≤3m, 3–12m, >12m? (signal: FD under Bank Accounts) | GN-II 8.1.16; Ind AS 7 / AS 3 · ✅ Verified (+ICAI GN) |
| A6.2 | Cash and bank | CL | Remaining term at 31 Mar? (signal: FD maturing after next 31 Mar) | GN-II 8.1.11 · 📘 ICAI guidance only |
| B2.1 | Borrowings | CL | Repayment schedule? Principal due by next 31 Mar? (signal: Term loan single ledger) | Sch III 2021: current maturities → short-term borrowings · ✅ Verified |
| B2.2 | Borrowings | CL | Breached by 31 Mar? Waiver before/after year-end? (signal: Penal interest, overdue EMIs) | Ind AS 1 (2025 amendment). **Year-dependent:** FY25-26 vs FY26-27 differ · ⚪ Judgment |
| B3.3 | Trade payables | P | Credit days? Unbilled GRNs? (signal: No bill date/terms) | Sch III 2021 ageing · ✅ Verified |
| B6.3 | Provisions and contingencies | CL | Actuary's split? (signal: One gratuity/leave ledger) | Sch III · ✅ Verified |
| B7.1 | Tax | CL/P | Which years? Assessed? (signal: Advance tax/provision for many years) | Ind AS 12 / AS 22 · ✅ Verified |
| B7.3 | Tax | CL | Reclassify? (signal: DTL under current liabilities) | Sch III · ✅ Verified |

### Theme 4. Capital or revenue?

**Why it matters:** Capex in repairs or advances in CWIP distort profit, assets and depreciation.

| Facet | Asks | Assertion |
|---|---|---|
| 4a Effect | Restores, extends life/capacity, or new? | CL / C |
| 4b Life | Used for more than one year? | CL |
| 4c Ready date | When was it ready for use? | V / CO |
| 4d Project | Part of a project under construction? | CL / P |
| 4e R vs D | Research or development (intangibles)? | CL |

- **Fixed options:** Routine upkeep · Extends life/capacity · New asset · Part of a project under construction · Paid to supplier, asset not yet received · Research · Not sure
- **Outcomes (rules):** Expense; capitalise to PPE; CWIP; capital advance (other non-current assets); expense research
- **Evidence to ask for:** Invoice line detail, engineering note, installation / commissioning certificate
- **AI variant examples** (illustrative, synthetic data):
  - “₹18 lakh was booked in Repairs to ‘Kirloskar Machines’ with narration ‘new spindle assembly’. Did this restore the machine, add capacity/life, or replace a whole part?”

**Bank rows in this theme (11):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A1.1 | PPE, CWIP, intangibles, capital advances | CL | Paid but asset not received, or asset being built? (signal: "Advance – [vendor]" in CWIP; no GRN) | GN-II 8.1.2, 8.1.12: capital advance → other non-current assets · 📘 ICAI guidance only |
| A1.4 | PPE, CWIP, intangibles, capital advances | C/CL | Restores condition, adds life/capacity, or new asset? (signal: Large one-off Repairs; machinery vendor) | Ind AS 16 / AS 10 · ✅ Verified |
| A1.5 | PPE, CWIP, intangibles, capital advances | CL | Routine consumable, or standby/major spare used > 1 year? (signal: Large slow-moving stores & spares) | Ind AS 16 / AS 10 spares test: used "more than one period" (Ind AS) vs "more than 12 months" (AS) · ✅ Verified (fixed) |
| A1.9 | PPE, CWIP, intangibles, capital advances | CL | Research, development meeting criteria, or bought licence? (signal: "Software development" in CWIP) | Ind AS 38 / AS 26 · ✅ Verified |
| A5.3 | Loans, advances, other assets | CL | For a fixed asset or for materials/services? (signal: Payee is machinery/civil contractor) | GN-II 8.1.12 · 📘 ICAI guidance only |
| B3.7 | Trade payables | CL | For a fixed asset? (signal: Machinery supplier in trade payables) | Div II other financial liabilities [I] · 🟡 Partly |
| B4.6 | Other liabilities | CL | Split capital creditors? (signal: FA vendors in trade payables) | ICAI GN Div II 8.2.4.2 (guidance) · 🔧 Corrected |
| C2.2 | Materials and purchases | CL | Consumable or major spare > 1 year? (signal: Spares above threshold expensed) | Ind AS 16 / AS 10 spares test: "more than one period" (Ind AS) vs "more than 12 months" (AS) · ✅ Verified (fixed) |
| C3.3 | Employee costs | CL | Worked on building an asset or operations? (signal: Project team expensed) | Ind AS 16 para 17(a) · ✅ Verified |
| C4.5 | Finance costs | V | Substantial construction period? (signal: Project loan, no capitalisation) | Ind AS 23 · ✅ Verified |
| C5.1 | Other expenses | CL | Restore, add capacity/life, replace whole part? (signal: Large repairs; "new/replacement/upgrade") | Ind AS 16 paras 7, 12 · ✅ Verified |

### Theme 5. Is it still valid and recoverable?

**Why it matters:** Stale, disputed or doubtful balances drive existence/valuation queries and ageing disclosures.

| Facet | Asks | Assertion |
|---|---|---|
| 5a Status | Agreed, disputed, or settled? | E / P |
| 5b Recoverable | Will it be received/paid? By when? | V |
| 5c Physical | Does it physically exist / was it counted? | E |
| 5d Confirmation | Can the other party confirm? | E |
| 5e Provision | Is a provision or write-back needed? | V |

- **Fixed options:** Agreed, will settle by (date) · Disputed · No longer payable/receivable · Party insolvent / unreachable · Already settled, entry pending · Not sure
- **Outcomes (rules):** Ageing / disputed disclosure; provision for doubtful debts; write-back; contingent liability; correct pending entry
- **Evidence to ask for:** Confirmation, correspondence, legal notice, post-year-end receipt/payment
- **AI variant examples** (illustrative, synthetic data):
  - “GST Payable has shown ₹6.1 lakh unchanged since April 2024. Is this amount (a) paid but not adjusted, (b) still unpaid, (c) under dispute?”

**Bank rows in this theme (22):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A1.7 | PPE, CWIP, intangibles, capital advances | E | When last verified? Differences booked? (signal: FAR ≠ TB) | CARO 3(i)(b) · ✅ Verified |
| A2.5 | Investments | V | Cost, FVTPL, FVOCI, amortised cost? Any fall in value? (signal: Cost unchanged for years) | Div II: Ind AS 109; cost option for subsidiaries/associates/JVs Ind AS 27.10. Div I: AS 13 · 🔧 Corrected |
| A3.1 | Inventories | E | Counted at 31 Mar? By whom? Differences ≥ 10%? (signal: No count sheet; round closing stock) | SA 501; CARO 3(ii)(a) · ✅ Verified |
| A3.5 | Inventories | V | Saleable above cost, scrap, or sold below cost? (signal: No movement > 365 days) | Ind AS 2 / AS 2 · ✅ Verified |
| A4.5 | Trade receivables | P | Disputed or in litigation? (signal: Legal-case ledger) | Sch III 2021 · ✅ Verified |
| A4.6 | Trade receivables | V | Payment plan, insolvent, disputed? Provision? (signal: Overdue > 1y, no receipts) | GN-II (Jan 2022) 8.1.9 (impairment); Ind AS 109 · 🔧 Corrected |
| A4.9 | Trade receivables | E | Can we confirm directly? Objections? (signal: Large balance, no post-YE receipt) | SA 505 · ✅ Verified |
| A5.7 | Loans, advances, other assets | V | Still employed? Recovery date? Doubtful? (signal: Advance to employee who left) | GN-II (Jan 2022) 8.1.20; if recovered in cash it is a financial asset (GN-II 8.1.12) · 🔧 Corrected |
| A5.8 | Loans, advances, other assets | V/E | Received on time? Renewed to settle overdue? (signal: No receipts; new loan to same party) | CARO 3(iii)(c)–(e) · ✅ Verified |
| A6.6 | Cash and bank | E | Reason for each old reconciling item? (signal: BRS items > 3m old) | SA 505 · 🟡 Partly |
| A6.7 | Cash and bank | E | Counted at 31 Mar? Any negative-cash day? (signal: Negative daily cash; high closing cash) | SA 500 [I] · 🟡 Partly |
| B2.3 | Borrowings | P | Principal/interest overdue at year-end? Lender, amount, days (signal: Unpaid interest) | Sch III; CARO 3(ix)(a) · ✅ Verified |
| B2.10 | Borrowings | E/V | Upload 31 Mar lender statement (signal: Ledger ≠ lender statement) | SA 505 · ✅ Verified |
| B3.4 | Trade payables | P/E | Disputed, agreed unpaid, write back? (signal: Unchanged > 1 year) | Sch III 2021 · ✅ Verified |
| B3.9 | Trade payables | E | Supplier confirmations/statements? (signal: Large/old balances) | SA 505 · ✅ Verified |
| B5.1 | Statutory dues | E/V | Paid not set off, unpaid, disputed, ITC mismatch? (signal: GST payable unchanged 2 years) | CARO 3(vii)(a) (> 6 months) · ✅ Verified |
| B6.1 | Provisions and contingencies | E/CL | Obligation exists, only possible, or general cushion? (signal: Round-figure "provision for contingencies") | Ind AS 37 / AS 29 · ✅ Verified |
| B6.4 | Provisions and contingencies | C/V | Warranties given? Claims history? (signal: Warranty sales, no provision) | Ind AS 37 / AS 29 · ✅ Verified |
| B6.5 | Provisions and contingencies | C | Cases? Lawyer's view: probable/possible/remote? (signal: Legal fees, no disclosure) | SA 501; Ind AS 37 · ✅ Verified |
| B7.2 | Tax | E | Refund/demand received? (signal: Provision for assessed year) | [I] · ⚪ Judgment |
| B7.5 | Tax | V | Evidence of future profit? (signal: DTA on continuing losses) | AS 22 / Ind AS 12 [I] · ⚪ Judgment |
| C2.5 | Materials and purchases | V | Counted or book stock? Write-downs? (signal: Line ≠ opening − closing) | Sch III; Ind AS 2 · 🟡 Partly |

### Theme 6. Which period does it belong to?

**Why it matters:** Cutoff, prepaids, accruals, goods in transit.

| Facet | Asks | Assertion |
|---|---|---|
| 6a Event date | When did dispatch / receipt / service happen? | CO |
| 6b Coverage | What period does the cost cover? | CO |
| 6c Terms | Incoterm / when did risk pass? | CO |
| 6d Reversal | Is a March entry reversed in April? | CO / CL |
| 6e Missing month | Is a month's cost missing? | C |

- **Fixed options:** Wholly before 31 Mar · Wholly after · Spans both (give from/to dates) · Not sure
- **Outcomes (rules):** Cutoff adjustment; prepaid / accrual; no change
- **Evidence to ask for:** LR / e-way bill, GRN, policy or AMC period, contract terms
- **AI variant examples** (illustrative, synthetic data):
  - “Invoice 1147 to Maruti Suzuki dated 30 Mar for ₹22 lakh: the e-way bill is dated 2 April. When did the goods leave your premises?”

**Bank rows in this theme (17):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A1.2 | PPE, CWIP, intangibles, capital advances | CL/V | Ready for use by 31 Mar (date)? In progress (%)? Suspended since? (signal: CWIP flat or growing > 12m) | Ind AS 16 / AS 10; CWIP ageing (Sch III 2021) · ✅ Verified |
| A1.3 | PPE, CWIP, intangibles, capital advances | P | Is the project overdue or over its original budget? If yes: expected completion date and revised cost (signal: CWIP not tagged by project) | Sch III Div I Note 6 Y(iv)(b) / Div II L(vi)(b): completion schedule only for overdue or over-budget CWIP · 🟡 Partly (fixed) |
| A3.3 | Inventories | P/CO | Shipped before 31 Mar, received after: whose risk at 31 Mar? (signal: Purchase booked, GRN dated April) | GN-II 8.1.13(ii) · 🟡 Partly |
| A3.4 | Inventories | CO | Were invoiced goods excluded from closing stock? (signal: Invoices 28–31 Mar, goods still in stock) | SA 501 (count cut-off); Ind AS 115 / AS 9 · 🔧 Corrected |
| A4.7 | Trade receivables | CL/P | Only invoicing pending, or work still due? (signal: "Unbilled revenue" in debtors) | GN-II 8.1.11.1; contract asset · 📘 ICAI guidance only |
| A4.10 | Trade receivables | CO | Dispatched/accepted by 31 Mar? (signal: Invoice 31 Mar, dispatch April) | Ind AS 115 / AS 9 [I] · ⚪ Judgment |
| A5.9 | Loans, advances, other assets | CO | Coverage period? Portion after 31 Mar? (signal: Full-year insurance/AMC expensed) | Accrual basis [I] · ⚪ Judgment |
| B1.3 | Equity | CL | Allotted, refunded, still held? (signal: Share application money > 60 days) | Companies Act s.42(6): allot within 60 days, else refund within 15 days; then Deposit Rules r.2(1)(c)(vii) · 🔧 Corrected |
| B3.10 | Trade payables | C/CO | Which April payments relate to March? (signal: April payments for March goods) | SA 315 A123(b)(iii); SA 330 A45; SA 580 para 10(b) · 🔧 Corrected |
| B4.3 | Other liabilities | C/CO | March salary, bonus, F&F booked? (signal: Salary payable < one month run-rate) | Ind AS 19 / AS 15 · ✅ Verified |
| B4.5 | Other liabilities | C | March cost provided? (signal: Only 11 monthly entries) | [I] · ⚪ Judgment |
| B5.2 | Statutory dues | V | Which months unpaid? Payment dates? (signal: TDS/PF/ESI payable > one month) | CARO 3(vii)(a) · ✅ Verified |
| C1.4 | Revenue vs other income | CO | Left before 31 Mar? Incoterm? Bill-and-hold? (signal: Invoice 25–31 Mar, LR April) | Ind AS 115 para 38; SA 240 · ✅ Verified |
| C1.5 | Revenue vs other income | CO/E | April credit notes: March returns, price change, unrelated? (signal: Last-week spike, April credit notes) | Ind AS 115; SA 240 · ✅ Verified |
| C2.4 | Materials and purchases | CO | Arrived by 31 Mar? (signal: GRN March, invoice April) | SA 315 A123(a)(iv); SA 501 A4 (cut-off) · 🔧 Corrected |
| C5.2 | Other expenses | CO | Coverage from __ to __? (signal: Insurance/AMC beyond 31 Mar) | Accrual basis · ✅ Verified |
| C8.3 | GST and TDS | C | Deposited by due date? Challan? (signal: TDS payable past due date) | CARO 3(vii)(a) · ✅ Verified |

### Theme 7. Is it restricted, pledged or held for others?

**Why it matters:** Liens, margin money, pledged stock and restricted accounts change presentation and disclosure.

| Facet | Asks | Assertion |
|---|---|---|
| 7a Lien | Under lien for a guarantee, LC or loan? | CL / P |
| 7b Security | Given as security for borrowing? | R / P |
| 7c Custody | Held by or for a third party? | R |
| 7d Restriction | Legally restricted use? | P |

- **Fixed options:** Free to use · Lien for BG/LC/loan · Pledged as security · Held for others · Legally restricted · Not sure
- **Outcomes (rules):** Not a cash equivalent → other bank balances + disclosure; security disclosure; exclude stock held for others
- **Evidence to ask for:** Bank lien letter, sanction terms, consignment / job-work challans
- **AI variant examples** (illustrative, synthetic data):
  - “FD ‘Margin – SBI’ of ₹25 lakh: is it under lien for a bank guarantee or LC?”

**Bank rows in this theme (6):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A2.6 | Investments | R/E | Share 31 Mar statement. Anything pledged? (signal: No demat/MF statement) | SA 500, SA 505 · ✅ Verified |
| A3.7 | Inventories | R | With a third party, owned by others, or pledged? (signal: Stock at job worker / consignment) | SA 501 [I] · ✅ Verified |
| A6.3 | Cash and bank | CL/P | Under lien for guarantee, LC or loan? (signal: FD linked to BG/LC; "Margin") | GN-II 8.1.16 · 📘 ICAI guidance only |
| A6.4 | Cash and bank | P | Is use restricted? Why? (signal: Unpaid dividend, escrow, unspent CSR) | GN-II 8.1.11, 8.1.16 · 🟡 Partly |
| B2.4 | Borrowings | CL/R | Stock/debtors, mortgage, personal guarantee, none? (signal: Bank loan under "Unsecured") | Sch III · ✅ Verified |
| B6.6 | Provisions and contingencies | P | Guarantees outstanding? (signal: Margin FDs, BG charges) | Sch III contingent liabilities: Div I guarantees; Div II guarantees excluding financial guarantees · 🟡 Partly (fixed) |

### Theme 8. What is its legal or regulatory status?

**Why it matters:** MSME, charges, CSR, title deeds, approvals: items that become CARO / Schedule III disclosures or penalties.

| Facet | Asks | Assertion |
|---|---|---|
| 8a Registration | Is the party / asset registered (Udyam, charge, valuer)? | P |
| 8b Approval | Was the required approval / filing done? | P |
| 8c Deadline | Was the statutory deadline met? | V / P |
| 8d Dispute | Is a dispute or proceeding pending? | P |

- **Fixed options:** Depends on law (e.g. MSME: Micro · Small · Medium · Not registered · Unknown)
- **Outcomes (rules):** MSME disclosure + interest + tax disallowance; CARO reporting item; CSR disclosure; title / charge disclosure
- **Evidence to ask for:** Udyam certificate, MCA charge records, board resolution, CSR policy, challans
- **AI variant examples** (illustrative, synthetic data):
  - “Supplier ‘Precision Castings’ has ₹9 lakh due for 70 days. Is the supplier registered as Micro, Small or Medium (Udyam)?”

**Bank rows in this theme (22):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A1.6 | PPE, CWIP, intangibles, capital advances | R | Deed in company name, promoter/director/relative name, or leased? (signal: Land/building; deed missing or in director's name) | Sch III 2021; CARO 3(i)(c) · ✅ Verified |
| A1.8 | PPE, CWIP, intangibles, capital advances | V | Revaluation? Registered valuer? Date? (signal: Revaluation reserve credit) | Sch III 2021; CARO 3(i)(d) · ✅ Verified |
| A1.10 | PPE, CWIP, intangibles, capital advances | P | Any Benami Act proceedings pending? (signal: —) | CARO 3(i)(e); Sch III 2021 · ✅ Verified |
| A2.4 | Investments | P | Listed? Market value at 31 Mar? (signal: No market value) | GN-II 8.1.8(ii) · 📘 ICAI guidance only |
| A2.7 | Investments | P | Special resolution? Layers of companies? (signal: Large group investment) | CARO 3(iii), 3(iv) (s.186) · ✅ Verified |
| A3.8 | Inventories | P | Do quarterly stock statements match books? (signal: CC/OD secured on current assets (any amount; CARO adds the > ₹5 cr test)) | CARO 3(ii)(b); Sch III 2021 · 🟡 Partly (fixed) |
| B1.2 | Equity | P | Each promoter's shares at start/end; transfers? (signal: No promoter data) | Sch III 2021 · ✅ Verified |
| B2.5 | Borrowings | P | ROC charge ID? Satisfaction filed? (signal: No CHG-1 / CHG-4) | Sch III 2021; Companies Act s.77 (registration), s.82 (satisfaction) · 🔧 Corrected |
| B2.6 | Borrowings | P | Quarterly statements agree with books? (signal: CC/OD secured on current assets (any amount; CARO adds the > ₹5 cr test). Duplicate of A3.8) | Sch III 2021; CARO 3(ii)(b) · 🟡 Partly (fixed) |
| B2.11 | Borrowings | P | Used for sanctioned purpose? (signal: Loan money in FDs/ICDs) | Sch III 2021; CARO 3(ix)(c)–(d) · ✅ Verified |
| B2.12 | Borrowings | P | Declared wilful defaulter? Date? (signal: Recall notices) | Sch III 2021; CARO 3(ix)(b) · ✅ Verified |
| B3.1 | Trade payables | CL | Micro/small, medium, unregistered, unknown? (signal: No Udyam number) | MSMED Act s.2(n) (status; Chapter V protects micro and small only); s.22 disclosure; Sch III MSME disclosure · 🔧 Corrected |
| B3.2 | Trade payables | V | Agreed credit days? Payment date? (signal: Micro/small dues past the agreed date (max 45 days with a written agreement; 15 days without), no interest) | MSMED s.2(b), 15, 16, 23; IT Act 1961 s.43B(h) (FY25-26) / IT Act 2025 s.37(2)(g) (FY26-27) · ✅ Verified (fixed) |
| B4.4 | Other liabilities | P | Moved to unpaid dividend a/c? Transfer to IEPF? (signal: > 7 years old) | s.124/125 · ✅ Verified |
| B5.4 | Statutory dues | P | Under appeal? Forum, amount, deposit? (signal: Demands, deposits under protest) | CARO 3(vii)(b) · ✅ Verified |
| B5.5 | Statutory dues | P | Income surrendered in assessments? (signal: Tax search/survey) | Sch III 2021; CARO 3(viii) · ✅ Verified |
| B6.7 | Provisions and contingencies | P | Unexecuted contract value? (signal: Capital advances paid) | Sch III commitments · ✅ Verified |
| B6.8 | Provisions and contingencies | C | Sign representation on liabilities (signal: —) | SA 580 · ✅ Verified |
| C4.3 | Finance costs | C/P | Udyam registered? Paid within 45 days? (signal: MSME dues > 45 days, no interest) | MSMED s.16, 22, 23 · ✅ Verified |
| C5.4 | Other expenses | P | CSR under policy or voluntary donation? Unspent? (signal: "Donation" to trust; s.135 applies) | s.135(5); Sch III; CARO 3(xx) · ✅ Verified |
| C5.5 | Other expenses | P | Political payee? Board approval? (signal: Payee party/electoral trust) | Companies Act s.182 (India Code text not updated after the Supreme Court ruling of 15 Feb 2024) · 🟡 Partly (fixed) |
| C6.3 | Prior-period / exceptional | P | Income surrendered this year? (signal: Survey/search) | CARO 3(viii) · ✅ Verified |

### Theme 9. Gross or net, and how measured?

**Why it matters:** Tax components, principal vs agent, valuation basis: accuracy and measurement.

| Facet | Asks | Assertion |
|---|---|---|
| 9a Tax | GST / TDS treated correctly? | V |
| 9b Role | Principal or agent? | V / E |
| 9c Method | Which valuation / cost method? | V / P |
| 9d Basis | Actuarial / estimate / not recorded? | V / C |

- **Fixed options:** Depends on facet (e.g. GST: Credit claimed · Blocked (s.17(5)) · Missed)
- **Outcomes (rules):** Gross up expense; reclass ITC; revenue net/gross; method disclosure; provision
- **Evidence to ask for:** GSTR-2B, TDS challans, contract, actuarial report
- **AI variant examples** (illustrative, synthetic data):
  - “Rent of ₹1.8 lakh was booked equal to the amount paid. Was TDS deducted and booked separately?”

**Bank rows in this theme (12):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| A3.6 | Inventories | V/P | FIFO / weighted average / specific? (signal: Method not documented) | GN-II 8.1.13(iii) · 🟡 Partly |
| A5.5 | Loans, advances, other assets | CL/V | Usable ITC, refund claimed, or blocked? (signal: Debit balance under Duties & Taxes [I]) | GN-II 8.1.12; CGST s.17(5) · ✅ Verified (+ICAI GN) |
| B5.3 | Statutory dues | CL | Split ITC (asset) and output tax (liability)? (signal: Single net "GST" ledger) | [I] · ⚪ Judgment |
| B6.2 | Provisions and contingencies | V | Actuarial report, LIC-funded, pay-as-you-go? (signal: Gratuity booked on payment) | Ind AS 19 / AS 15 · 🟡 Partly |
| B7.4 | Tax | C | Depreciation difference computed? (signal: No DT ledger, WDV differs) | AS 22 / Ind AS 12 [I] · ⚪ Judgment |
| B7.6 | Tax | V | DT remeasured at new rate? (signal: Moved to s.115BAA) | IT Act 1961 s.115BAA (FY25-26) / IT Act 2025 s.200 (FY26-27); AS 22 / Ind AS 12 · ⚪ Judgment (fixed) |
| C1.3 | Revenue vs other income | E/V | Held inventory risk, set price, or only arranged? (signal: Same party/amount buy-sell, thin margin) | Ind AS 115 B34–B38; AS 9 · ✅ Verified |
| C1.6 | Revenue vs other income | V | Price reduction or payment for a distinct service? (signal: "Scheme" in other expenses) | Ind AS 115 [I] · ⚪ Judgment |
| C2.3 | Materials and purchases | V | ITC claimed or blocked? (signal: GST in purchase value) | Ind AS 2 para 11 · ✅ Verified |
| C3.4 | Employee costs | C | Actuarial, estimate, not recorded? (signal: No/round provision) | Ind AS 19 / AS 15 · ✅ Verified |
| C8.1 | GST and TDS | V/CL | Claimed, blocked s.17(5), missed? (signal: GST in expense; vendor not in GSTR-2B) | CGST s.16, 17(5) · ✅ Verified |
| C8.2 | GST and TDS | V | Gross with TDS payable, or net? (signal: Expense = net payment, no TDS line) | Accrual basis; IT Act 1961 s.40(a)(ia) (FY25-26) / IT Act 2025 s.35(b)(i) (FY26-27) · ✅ Verified (fixed) |

### Theme 10. Why was this entry passed?

**Why it matters:** Journal-entry testing under SA 240: post-close, round, vague or unusual entries need a reason and a working.

| Facet | Asks | Assertion |
|---|---|---|
| 10a Trigger | What triggered it? | E |
| 10b Support | What document supports it? | E / CL |
| 10c Approver | Who approved it? | E |
| 10d Period | Does it relate to a past year? | CL / P |

- **Fixed options:** Reconciliation adjustment · Error correction · Estimate / provision · Reclass for presentation · Auditor / consultant advice · Other (explain) · Not sure
- **Outcomes (rules):** Evidence attached → close; past-year error → Ind AS 8 / AS 5; unsupported → escalate
- **Evidence to ask for:** Working paper, approval trail, email / note
- **AI variant examples** (illustrative, synthetic data):
  - “Entry on 2 April, back-dated to 31 March: Dr Fixed Assets ₹14 lakh / Cr Sales, narration ‘being adjustment’. What triggered this entry?”

**Bank rows in this theme (8):**

| ID | Area | Assertion | Question (signal) | Rule · official check |
|---|---|---|---|---|
| B1.1 | Equity | E/V | Fresh allotment (PAS-3), rights/bonus, buy-back, correction? (signal: Capital moved, no allotment entry) | Sch III; SA 500 · 🟡 Partly |
| C6.1 | Prior-period / exceptional | CL | Error correction, estimate change, new info? (signal: "Pertaining to FY24") | Ind AS 8 para 42; AS 5 · ✅ Verified |
| C6.2 | Prior-period / exceptional | P | Recurs, or unusual size/incidence? (signal: Recurring items labelled exceptional) | Ind AS 1 paras 97–98; EAC 43/41 · ✅ Verified |
| C7.1 | Journal-entry flags | E/CL | Trigger: reconciliation, advice, error fix, other? Attach working (signal: Post-close, round, "being adjustment") | SA 240 para 32(a), A43(c),(e) · 🔧 Corrected |
| C7.2 | Journal-entry flags | CL | What document supports this pair? (signal: Dr FA / Cr Revenue; Dr Expense / Cr Capital) | SA 240 A43 (unrelated, unusual or seldom-used accounts); expected-pair list is the tool's own rule · 🔧 Corrected |
| C7.3 | Journal-entry flags | CL | What made up the suspense balance? (signal: Suspense at YE / one big clearing entry) | SA 240 A43(d) · 🔧 Corrected |
| C7.4 | Journal-entry flags | E | Who approved? (signal: Rare user posting) | SA 240 A43 · 🔧 Corrected |
| C7.5 | Journal-entry flags | CL | Presentation reclass, accrual reversal, correction? (signal: 31 Mar entry reversed in April) | SA 240 A41 (reclassifications); SA 450 · 🔧 Corrected |

## 4. Guardrails and evals for the variant bank

- Log every variant: transaction ID, theme, facet, wording, options shown, answer, outcome, who confirmed.
- Score (Swapnil writes the rubric): did the controller answer without asking back; did the answer map to one option; did the outcome match the sealed answer key; was any amount/party wrong (must be zero).
- Two lists: Fix next / Must keep working; 3 runs per case.
- Rules are dated: every outcome rule carries an effective-from date (e.g. Ind AS 1 covenant rule differs FY25-26 vs FY26-27).