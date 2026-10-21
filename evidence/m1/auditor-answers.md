# Auditor answers collected in chat (Swapnil, 20 Oct 2026)

## Spot-check of AI questions (verdict options: Good / Leading / Wrong question / Two questions / free text)
- S1 (P1, R1, MD funds, 3 entries): Good
- S2 (P2, R1, Anita Mehta "loan recd"): Good
- S3 (P3, R1, Mehta Family Trust "recd for working capital"; AI asked what it was for, quoting the narration): Leading
- S4 (P5, R2, Bharat Fasteners; master says Micro, 45 days; one bill paid at day 68; AI asked "registered as Micro/Small/Medium or not"): free text — "the question should ask whether the MSME certificate notifying classification is there in file and also the reason for the late payment"
- S5 (P6, R2, Delta Rubber; master Small, no written terms; paid day 30; AI asked registered as M/S/M or not): Good
- S6 (P7, R2, Kumar Packaging; no status, no terms; unpaid; same registration question): Wrong question (no comment; follow-up needed: what should it ask?)
- S7 (P8, R3, Meridian term loan; AI asked how much principal falls due before next 31 March): free text — "the loan terms can be automatically calculated by the system and classified into current and non current. instead ask if the loan documents are properly documented and where is it"  => R3 question goal should be about whether the loan documents (sanction letter, repayment schedule) exist and where they are, not about amounts; the split is computed by code.
- S8 (P9, R4, Kaveri spindle assembly ₹38 lakh): Leading (no comment)
- S9 (P10, R4, Om Constructions shed ₹1.2 cr): Good
- S10 (P11, R4, Arena Motors MPV ₹22 lakh): Good
- S11 (P12, R5, Gupta Scrap Dealers "sale of MS scrap"; AI asked "received for the sale of MS scrap, or for something else"): Leading
- S12 (P13, R5, Kestrel insurance "claim recd – fire at stores"; AI asked "for the fire-at-stores claim, rather than for goods supplied"): Leading
- S13 (P14, R5, RoDTEP credit ₹25 lakh): Good
- S14 (P15, R5, FD interest ₹12 lakh): Good
- S15 (P16, R5, exchange gain ₹9 lakh): Good
- S16 (P17, R5, sale of old lathe machine ₹40 lakh): Good
- S17 (A2-MIXED-AMOUNTS, R1, Sharma Traders ₹5.6 lakh written three ways): Good
- S18 (A3-SIMILAR-NAME, R1, ledger Rajesh Mehta Trading but party Sharma Traders): Good
- S19 (H33, R1, director Sunita Rao 3 receipts narrated "adv tooling jobwork"; AI asked "advances against future tooling jobwork supply rather than a loan"): Leading
- S20 (H35, R1, shareholder Northfield Holdings 13 receipts; AI asked "a loan, an advance against future scrap offtake, or a claimed refund"): Leading
- S21 (H36, R2, Pinnacle Gasket Works; Small, 45 days written; paid day 87; AI asked "Which Udyam category … or not registered"): Good  [compare S4: there he wanted certificate-on-file + reason for late payment]
- S22 (H37, R3, Riverbend term loan, moratorium till Jun-26; AI asked how much principal falls due before next 31 March, or on demand/no schedule): Good  [compare S7: there he said ask about loan documents instead]
- S23 (H38, R4, Tessera hydraulic cylinder + PLC panel ₹31.5 lakh): Leading
- S24 (H39, R4, Greenfield shed extension bills; mixed parties): Leading
- S25 (P1 again, full option list "goods or services, a loan, an advance, a security deposit, or something else"): Good
- S26 (P5 again, "Which Udyam category … Micro, Small, Medium, or not registered"): Good
- S27 (P8 again, "Given the term loan … 60 monthly instalments, how much principal falls due before next 31 March"): Wrong question
- S28 (H34, R1, Interim Funding A/c, "received as a loan under agreed terms"): Leading

## Tally of item 1 (28 questions)
Good 15 (S1 S2 S5 S9 S10 S13 S14 S15 S16 S17 S18 S21 S22 S25 S26); Leading 9 (S3 S8 S11 S12 S19 S20 S23 S24 S28); Wrong question 2 (S6 S27); free-text comments 2 (S4 R2: ask certificate on file and reason for late payment; S7 R3: ask whether loan documents exist and where, the system computes current/non-current).
Open inconsistencies to reconcile: R2 (S4 wanted certificate + late-payment reason; S5, S21, S26 Good; S6 Wrong question); R3 (S7 and S27 wrong/ask documents; S22 Good).

## Rulings after reconciling item 1 (Swapnil, 20 Oct 2026)
- R2, supplier status already known in the master: "Certificate, then reason" — the question asks whether the Udyam certificate is on file and where; the reason for the late payment is a separate follow-up question.
- R3 term loans: "Documents only" — ask whether the sanction letter and repayment schedule are on file and where; code computes the current / non-current split. (This replaces the current R3 goal "how much principal falls due before the next 31 March".)
- What makes a question Leading: it proposes one answer taken from the narration; it uses treatment words ("new asset", "whole major part"); it repeats the narration as if it were the question. (Not selected: "offers too few choices".)
- R2 supplier with no MSME status and no written terms (Kumar Packaging): all three asks apply — the Udyam certificate, the agreed credit terms, and why the bill is unpaid / when it will be paid.
- Implication: the 273 stored "good" labels in the question bank include questions of the Leading kind; the R2 and R3 question goals need a new wording and a logged decision.

## Item 3: edge-case rulings
- E1 (context sentence + semicolon + question, H40): Yes, allow it (a short context line before one question is fine) -> checker currently rejects any ";" and needs a change
- E2 (document asked inside the question): Only for R3 and R2 (where the document question is the question)
- E3 ("…, and if so, …"): Confirm: two questions (keep rejecting)
- E4 (yes/no with a list vs open "which"): (a) yes/no with a list is better
- E5 (ask who a party is relative to the company): Yes, fine
- E6 (state entry count and total in the question): Yes, state them
- E7 (fronted phrase + full option list inside the question): Options lead — ask open and keep the options in the answer buttons. [Reconcile with E4: (a) yes/no with a list preferred; likely reading: the list is fine where the options are a fixed legal set (Udyam categories) but not for the nature of a receipt.]
- E8 (quote the narration back): Yes, fine
- E9 (call the money "the loan" before it is confirmed): No, stay neutral ("the money received")
- E10 (several parties in one ledger): One question per party
- E11 (date style in the question): Plain, e.g. 14 May 2025
- E12 (R2 late payment: state computed days taken and agreed terms): Yes, both

## Item 4: evidence answer key (documents you would ask for FIRST, 1 to 3, per case)
- P5, P6, P7, H36 (all R2): all four documents for every case — Udyam certificate, written credit terms, invoice + acceptance date (GRN), payment record. (Finding: for R2 the documents are a bundle; the rule's 1-3 id cap is narrower than an auditor's request.)
- P8, H37 (R3): all four — sanction letter, repayment schedule, loan statement, covenant certificate.
- P9, P10 (R4): all four — invoice with line detail, engineering note, commissioning certificate, capex approval/PO.
- Pattern: for R2, R3, R4 every case got the whole rule bundle. Remaining cases (P11, H38, H39, R5 cases, R1 cases) are being asked as principles instead of one by one.
- Principle R2, R3, R4: Yes, whole bundle — always request every document in the rule's list (P11, H38, H39 covered by this).
- Principle R5: Matching + related — the document matching the type of credit plus any other that could apply to the same credit.
- Principle R1: ALWAYS request loan agreement or letter, bank statement lines, lender's confirmation, director's/relative's declaration, party master/PAN, related-party list, invoices or POs. Board resolution was NOT chosen as "always" (treated as situational).
- R1 board resolution: only if it is a loan (the controller's answer says the money is a loan or borrowing).
- AI's job on evidence: Code lists the bundle — the AI only words the question; code shows the full document list for the rule (R5: the matching type plus related). The AI no longer picks 1 to 3 documents.
