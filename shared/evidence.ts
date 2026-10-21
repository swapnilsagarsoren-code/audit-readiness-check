export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface EvidenceItem {
  id: string;
  label: string;
}

// Decision #25: the flagged rule owns its approved document list.
export const EVIDENCE_BY_RULE: Readonly<Record<RuleId, readonly EvidenceItem[]>> = {
  R1: [
    { id: 'R1-LOAN-AGREEMENT', label: 'Loan agreement or letter stating terms' },
    { id: 'R1-BOARD-RESOLUTION', label: 'Board resolution / minutes approving the borrowing' },
    { id: 'R1-DIRECTOR-DECLARATION', label: "Director's or relative's written declaration, given when the money was paid, that it was not from money they borrowed or took as loans or deposits from others" },
    { id: 'R1-BANK-STATEMENT', label: 'Bank statement lines for the receipts' },
    { id: 'R1-PARTY-PAN', label: 'Party master / PAN of the lender' },
    { id: 'R1-INVOICE-PO', label: 'Invoices or POs, if goods/services were supplied' },
    { id: 'R1-RELATED-PARTY-LIST', label: "Management's list of related parties, showing how each is related to the company" },
    { id: 'R1-LENDER-CONFIRMATION', label: "Lender's signed confirmation of the amount, terms and purpose" },
  ],
  R2: [
    { id: 'R2-UDYAM', label: 'Udyam registration certificate' },
    { id: 'R2-CREDIT-TERMS', label: 'Written credit terms (PO / agreement)' },
    { id: 'R2-INVOICE-GRN', label: 'Invoice and goods-acceptance date (GRN)' },
    { id: 'R2-PAYMENT-RECORD', label: 'Payment record (bank statement / UTR)' },
  ],
  R3: [
    { id: 'R3-SANCTION', label: 'Sanction letter' },
    { id: 'R3-REPAYMENT-SCHEDULE', label: 'Repayment schedule' },
    { id: 'R3-LOAN-STATEMENT', label: 'Latest loan statement from the bank' },
    { id: 'R3-COVENANT-CERT', label: 'Covenant compliance certificate' },
  ],
  R4: [
    { id: 'R4-INVOICE-DETAIL', label: 'Vendor invoice with line detail' },
    { id: 'R4-ENGINEERING-NOTE', label: 'Engineering / technical note on what the work did' },
    { id: 'R4-COMMISSIONING', label: 'Installation or commissioning certificate' },
    { id: 'R4-CAPEX-APPROVAL', label: 'Capex approval / PO' },
  ],
  R5: [
    { id: 'R5-SCRAP-INVOICE', label: 'Scrap sale invoice' },
    { id: 'R5-CLAIM-LETTER', label: 'Insurance claim settlement letter' },
    { id: 'R5-RODTEP-LEDGER', label: 'RoDTEP e-scrip / credit ledger statement' },
    { id: 'R5-FD-ADVICE', label: 'FD interest certificate / bank advice' },
    { id: 'R5-ASSET-SALE', label: 'Asset sale invoice + fixed asset register entry' },
    { id: 'R5-FOREX-WORKING', label: 'Forex working (rates at invoice and receipt)' },
  ],
};

export function getEvidence(ruleId: RuleId): EvidenceItem[] {
  const evidence = EVIDENCE_BY_RULE[ruleId];
  if (!evidence) throw new Error('Unknown question rule.');
  return evidence.map(item => ({ ...item }));
}
