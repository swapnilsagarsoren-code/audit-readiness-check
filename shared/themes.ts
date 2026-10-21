export type ThemeId = 1 | 2 | 3 | 4 | 8;

export interface ThemeFacet {
  facet: string;
  asks: string;
  assertion: string;
}

export interface Theme {
  title: string;
  whyItMatters: string;
  facets: ThemeFacet[];
  options: string[];
}

// Copy only the approved titles, explanation, facets and fixed option text.
// Outcomes, examples, citations and the older AI-routing guidance stay out.
export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  1: {
    title: 'Who is the counterparty?',
    whyItMatters: "Related-party, director and employee balances need separate presentation, approvals and disclosure; a person's name in a trade ledger is the most common nature-vs-name gap.",
    facets: [
      { facet: '1a Identity', asks: 'Who is this party?', assertion: 'E / P' },
      { facet: '1b Relationship', asks: 'Is the party a director, KMP, relative or group company?', assertion: 'P (Ind AS 24 / AS 18)' },
      { facet: '1c Approval', asks: 'Was board / shareholder approval taken (s.185 / s.188 / s.197)?', assertion: 'P / compliance' },
      { facet: '1d Terms', asks: "Interest, repayment date, arm's length?", assertion: 'CL / V' },
      { facet: '1e Disclosure', asks: 'Is it shown separately where the law requires?', assertion: 'P' },
    ],
    options: ['Customer', 'Supplier', 'Director/KMP', 'Relative of a director', 'Employee', 'Group company', 'Other unrelated', 'Not sure'],
  },
  2: {
    title: 'What was exchanged?',
    whyItMatters: 'Decides trade vs borrowing vs advance vs deposit vs other income: the core classification split.',
    facets: [
      { facet: '2a Consideration', asks: 'Goods/services, or money only?', assertion: 'CL' },
      { facet: '2b Direction', asks: 'Did we give or receive it?', assertion: 'CL' },
      { facet: '2c Purpose', asks: 'What was it for?', assertion: 'CL / P' },
      { facet: '2d Refundable', asks: 'Must it be returned?', assertion: 'CL / R' },
      { facet: '2e Interest', asks: 'Does it carry interest?', assertion: 'CL' },
    ],
    options: ['Goods/services supplied', 'Loan', 'Advance against future supply', 'Security deposit', 'Claim / refund', 'Capital / share money', 'Sale of a fixed asset', 'Not sure'],
  },
  3: {
    title: 'When is it due or realised?',
    whyItMatters: 'Current vs non-current, cash equivalents vs other bank balances, current maturities: pure timing questions.',
    facets: [
      { facet: '3a Original term', asks: 'What was the original period?', assertion: 'CL' },
      { facet: '3b Remaining term', asks: 'How long from 31 Mar until due?', assertion: 'CL' },
      { facet: '3c Schedule', asks: 'Is there a repayment schedule?', assertion: 'CL / P' },
      { facet: '3d On demand', asks: 'Repayable on demand or no terms?', assertion: 'P' },
      { facet: '3e Covenants', asks: 'Any breach that makes it payable now?', assertion: 'CL' },
    ],
    options: ['Original term ≤ 3 months', 'Due within 12 months', 'Due after 12 months', 'Repayable on demand', 'No fixed terms', 'Not sure'],
  },
  4: {
    title: 'Capital or revenue?',
    whyItMatters: 'Capex in repairs or advances in CWIP distort profit, assets and depreciation.',
    facets: [
      { facet: '4a Effect', asks: 'Restores, extends life/capacity, or new?', assertion: 'CL / C' },
      { facet: '4b Life', asks: 'Used for more than one year?', assertion: 'CL' },
      { facet: '4c Ready date', asks: 'When was it ready for use?', assertion: 'V / CO' },
      { facet: '4d Project', asks: 'Part of a project under construction?', assertion: 'CL / P' },
      { facet: '4e R vs D', asks: 'Research or development (intangibles)?', assertion: 'CL' },
    ],
    options: ['Routine upkeep', 'Extends life/capacity', 'New asset', 'Part of a project under construction', 'Paid to supplier, asset not yet received', 'Research', 'Not sure'],
  },
  8: {
    title: 'What is its legal or regulatory status?',
    whyItMatters: 'MSME, charges, CSR, title deeds, approvals: items that become CARO / Schedule III disclosures or penalties.',
    facets: [
      { facet: '8a Registration', asks: 'Is the party / asset registered (Udyam, charge, valuer)?', assertion: 'P' },
      { facet: '8b Approval', asks: 'Was the required approval / filing done?', assertion: 'P' },
      { facet: '8c Deadline', asks: 'Was the statutory deadline met?', assertion: 'V / P' },
      { facet: '8d Dispute', asks: 'Is a dispute or proceeding pending?', assertion: 'P' },
    ],
    // THEMES gives the MSME options inside its "Depends on law" example.
    options: ['Micro', 'Small', 'Medium', 'Not registered', 'Unknown'],
  },
};

export function getTheme(themeId: ThemeId): Theme {
  const theme = THEMES[themeId];
  if (!theme) throw new Error('Unknown question theme.');
  return {
    title: theme.title,
    whyItMatters: theme.whyItMatters,
    facets: theme.facets.map(facet => ({ ...facet })),
    options: [...theme.options],
  };
}
