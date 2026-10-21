import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export const companyFields = {
  name:v.string(), directors:v.array(v.string()), taxRate:v.union(v.number(),v.null()),
  materialityInputs:v.object({revenueBasisPoints:v.number(),pbtBasisPoints:v.number(),flagBasisPoints:v.number(),trivialBasisPoints:v.number()}),
  fy:v.optional(v.string()), start:v.optional(v.string()), end:v.optional(v.string()), division:v.optional(v.string()), description:v.optional(v.string()),
  relatives:v.optional(v.array(v.object({name:v.string(),relationship:v.string()}))), shareholders:v.optional(v.array(v.string())),
  taxRateSource:v.optional(v.string()), taxRateDate:v.optional(v.union(v.string(),v.null())),
  covenantThresholds:v.optional(v.object({currentRatio:v.number(),debtEquity:v.number(),source:v.string()})),rbiBankRate:v.optional(v.null()),
  expectedLedgerCount:v.optional(v.number()),expectedEntryCount:v.optional(v.number()),expectedSupplierCount:v.optional(v.number()),
};
export const ledgerFields={ledger_name:v.string(),tally_group:v.string(),opening_dr:v.optional(v.number()),opening_cr:v.optional(v.number())};
export const entryFields={date:v.string(),party:v.string(),narration:v.string(),amount:v.number(),voucher_type:v.string(),voucher_no:v.optional(v.string()),line_no:v.optional(v.number()),ledger:v.optional(v.string()),dr:v.optional(v.number()),cr:v.optional(v.number()),entered_by:v.optional(v.string()),entered_at:v.optional(v.string())};
export const supplierFields={supplier:v.string(),msme_status:v.string(),written_credit_days:v.union(v.number(),v.null())};
export const questionFields={
  flagKey:v.string(),ruleId:v.union(v.literal('R1'),v.literal('R2'),v.literal('R3'),v.literal('R4'),v.literal('R5')),
  theme:v.number(),followupTheme:v.optional(v.number()),questionText:v.string(),evidenceIds:v.array(v.string()),
  quotes:v.array(v.object({field:v.union(v.literal('ledger'),v.literal('tallyGroup'),v.literal('party'),v.literal('narration'),v.literal('date'),v.literal('amount'),v.literal('totalAmount'),v.literal('entryCount')),text:v.string()})),
  status:v.union(v.literal('verified'),v.literal('rejected'),v.literal('blocked_injection'),v.literal('failed'),v.literal('cap_hit'),v.literal('disabled')),
  reasons:v.array(v.string()),inventedCount:v.number(),model:v.string(),inputHash:v.string(),tokensIn:v.number(),tokensOut:v.number(),runId:v.string(),createdAt:v.number(),
  acceptedBy:v.optional(v.string()),acceptedAt:v.optional(v.number()),
  attempt:v.optional(v.number()),runNumber:v.optional(v.number()),
};
export const flagFields={
  flagKey:v.string(),ruleId:v.union(v.literal('R1'),v.literal('R2'),v.literal('R3')),party:v.string(),ledger:v.string(),amount:v.number(),
  band:v.union(v.literal('flagged'),v.literal('below')),percentOfFlagLine:v.number(),related:v.boolean(),statusKnown:v.boolean(),note:v.string(),
  entryRefs:v.array(v.object({voucher_no:v.string(),ledger:v.string()})),ruleVersion:v.string(),rank:v.number(),
};
export const flagRunFields={ruleVersion:v.string(),computedAt:v.number(),overall:v.number(),flagLine:v.number(),hideBelow:v.number(),basis:v.union(v.literal('revenue'),v.literal('pbt')),flagCount:v.number()};
const ratio=v.object({debt:v.number(),equity:v.number(),ratio:v.number()});
const verdict=v.union(v.literal('within'),v.literal('breach'));
export const answerFields={
  flagKey:v.string(),
  nature:v.union(v.literal('goods_services'),v.literal('loan'),v.literal('advance'),v.literal('deposit'),v.literal('not_sure')),
  counterparty:v.optional(v.union(v.literal('director'),v.literal('relative'),v.literal('shareholder'),v.literal('group_company'),v.literal('other'),v.literal('not_sure'))),
  term:v.optional(v.union(v.literal('within_12_months'),v.literal('after_12_months'),v.literal('on_demand'))),
  declaration:v.optional(v.union(v.literal('yes'),v.literal('no'),v.literal('unknown'))),
  answeredAt:v.number(),
};
export const outcomeFields={
  flagKey:v.string(),decision:v.union(v.literal('approved'),v.literal('sent_back')),decidedAt:v.number(),
  snapshot:v.object({
    outcome:v.object({kind:v.union(v.literal('no_change'),v.literal('reclass'),v.literal('escalate'),v.literal('ask_more')),caption:v.optional(v.string()),
      entry:v.optional(v.object({debit:v.string(),credit:v.string(),amount:v.number()})),missing:v.optional(v.array(v.string())),
      relatedPartyDisclosure:v.boolean(),legalReview:v.boolean(),note:v.string()}),
    before:ratio,after:v.optional(ratio),covenantMax:v.number(),covenantBefore:verdict,covenantAfter:v.optional(verdict),
  }),
};
export const msmeAnswerFields={
  flagKey:v.string(),
  certificate:v.optional(v.union(v.literal('yes'),v.literal('no'),v.literal('not_registered'),v.literal('not_sure'))),
  size:v.optional(v.union(v.literal('micro'),v.literal('small'),v.literal('medium'),v.literal('not_registered'),v.literal('not_sure'))),
  terms:v.optional(v.union(v.literal('none'),v.literal('up_to_15'),v.literal('up_to_30'),v.literal('up_to_45'),v.literal('over_45'))),
  answeredAt:v.number(),
};
export const msmeOutcomeFields={
  flagKey:v.string(),decision:v.union(v.literal('approved'),v.literal('sent_back')),decidedAt:v.number(),
  snapshot:v.object({
    kind:v.union(v.literal('interest_due'),v.literal('not_late'),v.literal('no_interest'),v.literal('escalate'),v.literal('ask_more')),
    allowed:v.optional(v.number()),principal:v.optional(v.number()),interest:v.optional(v.union(v.number(),v.null())),
    bankRate:v.union(v.object({value:v.number(),date:v.string(),sourceUrl:v.string()}),v.null()),
    bills:v.array(v.object({voucher_no:v.string(),ledger:v.string(),billDate:v.string(),amount:v.number(),paidDate:v.union(v.string(),v.null()),daysLate:v.number(),interest:v.union(v.number(),v.null())})),
    notes:v.array(v.string()),missing:v.optional(v.array(v.string())),
  }),
};
export const termLoanAnswerFields={
  flagKey:v.string(),
  documents:v.optional(v.union(v.literal('both'),v.literal('sanction_only'),v.literal('schedule_only'),v.literal('neither'),v.literal('not_sure'))),
  answeredAt:v.number(),
};
const currentRatioShape=v.object({assets:v.number(),liabilities:v.number(),ratio:v.number()});
const floorVerdict=v.union(v.literal('within'),v.literal('breach'));
export const termLoanOutcomeFields={
  flagKey:v.string(),decision:v.union(v.literal('approved'),v.literal('sent_back')),decidedAt:v.number(),
  snapshot:v.object({
    kind:v.union(v.literal('split'),v.literal('estimate'),v.literal('cannot_compute'),v.literal('ask_more')),
    split:v.union(v.object({balance:v.number(),totalInstalments:v.number(),paid:v.number(),remaining:v.number(),instalment:v.number(),due12:v.number()}),v.null()),
    entry:v.optional(v.object({debit:v.string(),credit:v.string(),amount:v.number()})),
    currentBefore:v.optional(currentRatioShape),currentAfter:v.optional(currentRatioShape),covenantMin:v.optional(v.number()),
    covenantBefore:v.optional(floorVerdict),covenantAfter:v.optional(floorVerdict),notes:v.array(v.string()),
  }),
};
export default defineSchema({
  company:defineTable(companyFields).index('by_name',['name']),
  period:defineTable({fy:v.string(),start:v.optional(v.string()),end:v.optional(v.string()),companyName:v.optional(v.string())}).index('by_fy',['fy']),
  ledger:defineTable(ledgerFields).index('by_name',['ledger_name']),
  entry:defineTable(entryFields).index('by_voucher_line',['voucher_no','line_no']),
  supplier:defineTable(supplierFields).index('by_name',['supplier']),
  rule:defineTable({id:v.string(),version:v.string(),effectiveFrom:v.string(),fy:v.string()}),
  rbiBankRate:defineTable({value:v.union(v.number(),v.null()),date:v.union(v.string(),v.null()),sourceUrl:v.union(v.string(),v.null())}),
  question:defineTable(questionFields).index('by_run',['runId']),
  flag:defineTable(flagFields).index('by_key',['flagKey']).index('by_rank',['rank']),
  flagRun:defineTable(flagRunFields),
  answer:defineTable(answerFields).index('by_flag',['flagKey']),
  outcome:defineTable(outcomeFields).index('by_flag',['flagKey']),
  editAttempt:defineTable({at:v.number()}).index('by_at',['at']),
  msmeAnswer:defineTable(msmeAnswerFields).index('by_flag',['flagKey']),
  msmeOutcome:defineTable(msmeOutcomeFields).index('by_flag',['flagKey']),
  termLoanAnswer:defineTable(termLoanAnswerFields).index('by_flag',['flagKey']),
  termLoanOutcome:defineTable(termLoanOutcomeFields).index('by_flag',['flagKey']),
  aiUsage:defineTable({day:v.string(),calls:v.number(),tokensIn:v.number(),tokensOut:v.number(),
    reservations:v.optional(v.array(v.object({id:v.string(),runId:v.string(),tokens:v.number()}))),
    runCalls:v.optional(v.array(v.object({runId:v.string(),calls:v.number()}))),
  }).index('by_day',['day']),
});
