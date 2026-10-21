import type { FlagInput } from './flag-input';

export const VERIFY_REASONS = [
  'INVALID_JSON', 'REPLY_NOT_OBJECT', 'REPLY_KEYS', 'QUESTION_TYPE',
  'QUESTION_LENGTH', 'QUESTION_END', 'QUESTION_SENTENCE_COUNT', 'QUESTION_ADVICE_OR_OUTCOME',
  'EVIDENCE_TYPE', 'EVIDENCE_COUNT', 'EVIDENCE_DUPLICATE', 'EVIDENCE_NOT_ALLOWED',
  'QUOTES_TYPE', 'QUOTE_COUNT', 'QUOTE_SHAPE', 'QUOTE_FIELD', 'QUOTE_NOT_IN_FIELD',
  'INVENTED_NUMBER', 'INVENTED_DATE', 'SEEDED_NAME_NOT_IN_INPUT', 'UNKNOWN_TITLE_CASE_NAME', 'CITATION',
] as const;
export type VerifyReason = typeof VERIFY_REASONS[number];
export type Quote = { field: 'ledger' | 'tallyGroup' | 'party' | 'narration' | 'date' | 'amount' | 'totalAmount' | 'entryCount'; text: string };
export type VerifiedReply = {
  status: 'verified' | 'rejected'; question: string; evidenceIds: string[]; quotes: Quote[];
  reasons: VerifyReason[]; inventedCount: number;
  /** Diagnostics without quote text: 'claimedField>fieldsContainingText' or '>none'. */
  quoteMisses: string[];
};

const UNREADY = 'Question not ready — the rule flag still stands. Try again later.';
const quoteFields = ['ledger', 'tallyGroup', 'party', 'narration', 'date', 'amount', 'totalAmount', 'entryCount'] as const;
type EntryField = 'party' | 'narration' | 'date' | 'amount';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_PATTERN = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** JSON.parse keeps the last duplicate key; reject that ambiguity explicitly. */
function duplicateJsonKeys(raw: string): boolean {
  const objects: (Set<string> | null)[] = [];
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] === '{') objects.push(new Set());
    else if (raw[index] === '[') objects.push(null);
    else if (raw[index] === '}' || raw[index] === ']') objects.pop();
    else if (raw[index] === '"') {
      const start = index++;
      for (; index < raw.length; index++) {
        if (raw[index] === '\\') index++;
        else if (raw[index] === '"') break;
      }
      let next = index + 1;
      while (/\s/.test(raw[next] ?? '') && next < raw.length) next++;
      const keys = objects.at(-1);
      if (raw[next] === ':' && keys) {
        const key = JSON.parse(raw.slice(start, index + 1)) as string;
        if (keys.has(key)) return true;
        keys.add(key);
      }
    }
  }
  return false;
}

function inputStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(inputStrings);
  if (object(value)) return Object.values(value).flatMap(inputStrings);
  return [];
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasName(text: string, name: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapePattern(name)}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

function withoutIdentities(text: string, identities: string[]): string {
  let remainder = text;
  for (const identity of [...new Set(identities)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    remainder = remainder.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapePattern(identity)}(?![\\p{L}\\p{N}])`, 'giu'), ' ');
  }
  return remainder;
}

/** Exact decimal strings avoid floating-point rounding when units are expanded. */
function numericKey(value: string): string {
  const parsed = value.replace(/,/g, '').match(/^([+-]?\d+)(?:\.(\d+))?\s*(lakhs?|lacs?|crores?|cr|L)?$/i);
  if (!parsed) return value;
  const negative = parsed[1].startsWith('-');
  const integer = parsed[1].replace(/^[+-]/, '');
  const fraction = parsed[2] ?? '';
  const unit = parsed[3]?.toLowerCase();
  const multiplier = unit === 'cr' || unit?.startsWith('crore') ? 10_000_000n : unit ? 100_000n : 1n;
  const digits = BigInt(`${integer}${fraction}`) * multiplier;
  const padded = digits.toString().padStart(fraction.length + 1, '0');
  const whole = fraction.length ? padded.slice(0, -fraction.length) : padded;
  const decimal = fraction.length ? padded.slice(-fraction.length).replace(/0+$/, '') : '';
  return `${negative && digits !== 0n ? '-' : ''}${BigInt(whole).toString()}${decimal ? `.${decimal}` : ''}`;
}

const COUNT_NOUNS = 'entries|entry|receipts?|payments?|bills?|invoices?|credits?|debits?|transactions?|instalments?|installments?|emis?|tranches?|lines?|vouchers?|days?|weeks?|months?|years?|quarters?|times|percent|per cent|per annum|lakhs?|crores?|rupees?|amounts?|lots?|units?|nos';

/** "one" as an ordinary word ("an existing one", "no one", "one of the bills") is not a number; "one receipt" is. */
function isPronounOne(masked: string, index: number, matched: string): boolean {
  if (matched.toLowerCase() !== 'one') return false;
  if (/\b(?:no|any|every|some|each|which|that|this|another|same|other|existing|new|old|a|an|the)\s+$/i.test(masked.slice(0, index))) return true;
  const after = masked.slice(index + matched.length);
  if (/^\s+of\b/i.test(after)) return true;
  return !new RegExp(`^\\s+(?:[A-Za-z]+\\s+)?(?:${COUNT_NOUNS})\\b`, 'i').test(after);
}

function numbers(text: string): string[] {
  const digitMatches = [...text.matchAll(/[+-]?\d[\d,]*(?:\.\d+)?(?:\s*(?:lakhs?|lacs?|crores?|cr|L)\b)?/gi)];
  const digits = digitMatches.map(match => numericKey(match[0]));
  const onlyWords = text.split('');
  for (const match of digitMatches) for (let index = match.index ?? 0; index < (match.index ?? 0) + match[0].length; index++) onlyWords[index] = ' ';
  const small: Record<string, number> = Object.fromEntries(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'].map((word, index) => [word, index]));
  const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const units: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000, crore: 10000000, crores: 10000000, million: 1000000, billion: 1000000000 };
  const word = `(?:${Object.keys({ ...small, ...tens, ...units }).join('|')})`;
  // C: every number word counts, except "one" used as an ordinary word (see isPronounOne).
  const masked = onlyWords.join('');
  // "twice", "thrice", "half" and "dozen" are counts too.
  const extra = [...masked.matchAll(/\b(twice|thrice|half|dozen)\b/gi)].map(match => ({ twice: '2', thrice: '3', half: '0.5', dozen: '12' }[match[1].toLowerCase() as 'twice']));
  const written = [...masked.matchAll(new RegExp(`\\b${word}(?:[ -]+(?:and[ -]+)?${word})*\\b`, 'gi'))]
    .filter(match => !isPronounOne(masked, match.index ?? 0, match[0]))
    .map(match => {
    let total = 0, group = 0;
    for (const token of match[0].toLowerCase().split(/[ -]+/)) {
      if (token in small) group += small[token];
      else if (token in tens) group += tens[token as keyof typeof tens];
      else if (token === 'hundred') group = (group || 1) * 100;
      else if (token in units) { total += (group || 1) * units[token]; group = 0; }
    }
    return String(total + group);
  });
  return [...digits, ...written, ...extra];
}

type DateFact = { start: number; end: number; key: string; monthDay: string; monthYear?: string };
function dateKey(year: string | undefined, month: number, day: number): { key: string; monthDay: string } {
  const resolvedYear = year ? Number(year.length === 2 ? `20${year}` : year) : 2000;
  const leap = resolvedYear % 4 === 0 && (resolvedYear % 100 !== 0 || resolvedYear % 400 === 0);
  const monthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const valid = month >= 1 && month <= 12 && day >= 1 && day <= monthLengths[month - 1];
  return { key: `${valid ? '' : 'invalid:'}${year ? String(resolvedYear).padStart(4, '0') : '--'}-${monthDay}`, monthDay };
}

function dates(text: string): DateFact[] {
  const found: DateFact[] = [];
  const add = (match: RegExpMatchArray, year: string | undefined, month: number, day: number) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (found.some(date => start < date.end && end > date.start)) return;
    found.push({ start, end, ...dateKey(year, month, day) });
  };
  // A full timestamp in the stored form ("2025-05-14T00:00:00+05:30") is one date; any other time stays a loose number.
  for (const match of text.matchAll(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T00:00:00\+05:30)?(?=\b|T\d)/g)) add(match, match[1], Number(match[2]), Number(match[3]));
  for (const match of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g)) {
    const first = Number(match[1]), second = Number(match[2]);
    // Indian day/month order; month/day is accepted only when unambiguous.
    add(match, match[3], second > 12 && first <= 12 ? first : second, second > 12 && first <= 12 ? second : first);
  }
  const monthNumber = (value: string) => MONTHS.findIndex(month => month.startsWith(value.replace(/\.$/, '').toLowerCase().slice(0, 3))) + 1;
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[ -]+(${MONTH_PATTERN})\\.?(?:[ ,/-]+(\\d{4}|\\d{2})(?!\\d))?\\b`, 'gi'))) {
    add(match, match[3], monthNumber(match[2]), Number(match[1]));
  }
  for (const match of text.matchAll(new RegExp(`\\b(${MONTH_PATTERN})\\.?[ -]+(\\d{1,2})(?:st|nd|rd|th)?(?:[ ,/-]+(\\d{4}|\\d{2})(?!\\d))?\\b`, 'gi'))) {
    add(match, match[3], monthNumber(match[1]), Number(match[2]));
  }
  // "December 2025" / "Apr 2025": a month and year without a day must match a real month in the data.
  for (const match of text.matchAll(new RegExp(`\\b(${MONTH_PATTERN})\\.?[ ,-]+(\\d{4})\\b`, 'gi'))) {
    const start = match.index ?? 0, end = start + match[0].length;
    if (found.some(date => start < date.end && end > date.start)) continue;
    const monthYear = `${match[2]}-${String(monthNumber(match[1])).padStart(2, '0')}`;
    found.push({ start, end, key: `month:${monthYear}`, monthDay: '', monthYear });
  }
  for (const fact of found) if (!fact.monthYear && /^\d{4}-\d{2}-/.test(fact.key)) fact.monthYear = fact.key.slice(0, 7);
  return found.sort((left, right) => left.start - right.start);
}

const ENTRY_NOUNS = '(?:entries|entry|receipts|receipt|payments|payment|bills|bill|invoices|invoice|credits|credit|debits|debit|transactions|transaction|instalments|instalment|lines|line|vouchers|voucher)';
/** Blanks the supplied entry count where it directly counts entries ("3 receipts", "three NEFT receipts"). */
function countedEntries(text: string, entryCount: string | undefined): string {
  if (entryCount === undefined) return text;
  // Not a count after a currency sign, or with a unit or rate word between the number and the noun.
  const word = '(?!(?:per|percent|pc|days?|weeks?|months?|years?|lakhs?|lacs?|crores?|cr|rupees?|rs|inr|times)\\b)[A-Za-z]+';
  const pattern = new RegExp(`(?<!(?:₹|\\bRs\\.?|\\bINR)\\s*)\\b([\\w-]+)(?=\\s+(?:${word}\\s+){0,3}${ENTRY_NOUNS}\\b)`, 'gi');
  return text.replace(pattern, (token: string) => {
    const value = numbers(token);
    return value.length === 1 && value[0] === entryCount ? ' '.repeat(token.length) : token;
  });
}

function withoutDates(text: string, facts: DateFact[]): string {
  const letters = text.split('');
  for (const fact of facts) for (let index = fact.start; index < fact.end; index++) letters[index] = ' ';
  return letters.join('');
}

const INTERROGATIVE = '(?:was|were|is|are|did|does|do|has|have|will|would|can|could|should|what|when|who|why|how|where|which)';
/**
 * "Was it a loan, when was it repaid?" asks twice; "For the funds received by NEFT, what was the money for?" does not:
 * a separator followed by a question counts only when a question has already started before it.
 */
function secondQuestionAfterSeparator(text: string): boolean {
  const separator = /(?:[,:;–—]|\s-\s)\s*(?:what|when|who|why|how|where)\s+(?:was|were|is|are|did|does|do|has|have|will|would|can|could)\b/gi;
  const alreadyAsking = new RegExp(`(?:^|[,:;–—]\\s*|\\s-\\s)${INTERROGATIVE}\\b`, 'i');
  for (const match of text.matchAll(separator)) if (alreadyAsking.test(text.slice(0, match.index))) return true;
  return false;
}

// R1 only (ruling #33, 21 Oct 2026): up to two plain statements, none a question, then exactly one question.
// The context statements may only restate what code supplies, in the code-built shape: nothing else can ride in them.
const CONTEXT_WORDS = new Set(['the', 'books', 'show', 'receipt', 'receipts', 'from', 'bank', 'into', 'account', 's', 'totalling', 'between', 'and', 'on', 'narration', 'narrations', 'read', 'reads', 'a', 'of']);
const QUESTION_START = /^(?:what|when|which|who|where|why|how|is|are|did|does|do|was|were|can|could|will|has|have|would|should|at what|in what|on what)\b/i;
function singleSentence(question: string, allowContext = false): boolean {
  let text = withoutDates(question, dates(question));
  // Common name abbreviations do not end a sentence; a copied narration does.
  text = text.replace(/\b(?:Ltd|Co|Pvt|Dr|Mr|Mrs|Ms|Inc|Jr|Sr)\./g, '');
  // Common lower-case abbreviations ("9% p.a. on", "e.g. scrap") do not end a sentence when the next word
  // is lower case, a number, a comma or the closing "?". A following capital, or a following question word
  // ("p.a. was it repaid?"), still counts as a possible new sentence.
  // "etc." is deliberately absent: it often ends a sentence.
  text = text.replace(/(?<![\p{L}\p{N}])(?:p\.a|e\.g|i\.e|viz|approx|[Nn]os?|Rs|vs|incl|w\.e\.f)\.(?!\s+(?:what|when|which|who|where|why|how|is|are|did|does|do|was|were|can|could|will|has|have)\b)(?=\s+[a-z0-9₹(]|,|\?$)/gu,
    abbreviation => abbreviation.replaceAll('.', ''));
  text = text.replace(/(?<=\d)\.(?=\d)/g, '').replace(/\?$/, '');
  if (allowContext) {
    const m = text.match(/^((?:[^.!?;\r\n]+[.!]\s+){1,2})([^.!?;\r\n]+)$/);
    if (m && m[1].split(/[.!]\s+/).filter(Boolean).every(sentence => !QUESTION_START.test(sentence.trim()) && sentence.trim().split(/\s+/).length >= 3 && !/\p{L}/u.test(sentence.replace(/[A-Za-z]/g, '')) && (sentence.toLowerCase().match(/[a-z]+/g) ?? []).every(word => CONTEXT_WORDS.has(word)))) text = m[2];
  }
  const second = '(?:what|when|which|who|where|why|how|is|are|did|does|do|was|were|can|could|will|has|have|at what|in what|on what)';
  return !/[.!?;\r\n]/.test(text)
    && !new RegExp(`\\band\\s+${second}\\b`, 'i').test(text)
    // A second question restarting after a comma or "also", or after "and if so/yes/not".
    && !/,\s+(?:was|were|is|are|did|does|do|has|have|can|could|will|would)\s+(?:it|they|he|she)\b/i.test(text)
    && !/\balso,?\s+(?:was|were|is|are|did|does|do|has|have|can|could|will|would|what|when|which|who|how)\b/i.test(text)
    // "if so / yes" and "and if not / applicable / any" always open a follow-up ask (Swapnil, 19 Oct: "and if so" is two questions).
    && !/\bif\s+(?:so|yes)\b/i.test(text) && !/\band\s+if\s+(?:not|applicable|any)\b/i.test(text)
    // A second question after a comma, colon, semicolon or dash: "Was it a loan, when was it repaid?".
    && !secondQuestionAfterSeparator(text)
    // "… but is the other one due?", "… and then was it repaid?".
    && !/\b(?:but|yet|whereas|while)\s+(?:is|was|are|were|did|does|do|has|have|will|can|could)\b/i.test(text)
    && !/\band\s+then\s+(?:is|was|are|were|did|does|do|has|have|will|can|could)\b/i.test(text);
}

function citesLaw(question: string): boolean {
  return /\bInd AS\b/.test(question) || /\bAS\s+\d+/.test(question)
    || /\b(?:s\.|section|rule|r\.)\s*\d/i.test(question)
    || /\b(?:MSMED Act|Companies Act|Deposit Rules|Income[- ]tax Act|Companies\s*\([^?]*?\)\s*Rules|Schedule\s+(?:[IVXLCDM]+|\d+))\b/i.test(question)
    || /\b(?:[A-Z][A-Za-z'-]*[ -]+){1,8}(?:Act|Rules)\b/.test(question);
}

// B: advice = asking someone to apply, or stating, an accounting treatment.
// Questions about obligations or about what already happened are fine: "must it be repaid?", "was it disclosed to
// the auditors?", "was the cost capitalised in the register?", "did interest accrue on the amount?".
const TREATMENT_BASE = '(?:re-?classif(?:y|ying|ies)|re-?class|capitali[sz]e|capitali[sz]ing|accrue|accrues|accruing|deduct|write[- ]?(?:off|back)|writing[- ]?(?:off|back)|derecogni[sz]e|derecogni[sz]ing|regroup|disclose|disclosing|restate|re-?label|convert\\s+(?:it|this|that|them|these|the)|shift\\s+(?:it|this|that|them|these|the)|tag\\s+(?:it|this|that|them|these|the)|offset\\s+(?:it|this|that|them|these|against)|(?:requires?|needs?)\\s+(?:a\\s+)?provision|account\\s+for|provide\\s+for\\s+(?:interest|losses?|doubtful|bad|tax|expenses?|it|this|them)|set[- ]off|net\\s+(?:it|this|that|them|these|those|the))';
const TREATMENT_PAST = '(?:re-?classified|capitali[sz]ed|accrued|written[- ]?(?:off|back)|derecogni[sz]ed|regrouped|provided\\s+for|netted|set[- ]off|restated|re-?labell?ed|offset|shifted|tagged|converted)';
const PRESENTATION_VERBS = '(?:shown|show|classified|classify|presented|present|treated|treat|recorded|record|booked|book|disclosed|recognised|recognized|recognise|recognize|reported|transferred|transfer|moved|move|grouped|adjusted|placed|put)';
const JUDGEMENT = '(?:appropriate|correct|right|better|best|proper|acceptable|suitable|advisable|necessary|permissible|fine|fair|reasonable|ok|okay|apt)';
function advisesOrDecides(question: string): boolean {
  // "Did the company disclose …", "Did interest accrue …": the base form after did/does/do with a subject other than
  // we/you/I states what happened, so it is not asking for a treatment.
  // The words between must be a plain subject: no modal, "mean" or "to" (so "does this mean must capitalise" is still advice).
  const subjectWord = "(?!(?:must|should|ought|need|needs|have|has|to|mean|means|require|requires|say|says|said|think|thinks|prefer|prefers|write|writes|wrote|want|wants|ask|asks|tell|tells|decide|decides|intend|intends|expect|expects|suggest|suggests|believe|believes|agree|agrees|insist|insists|propose|proposes)\\b)[\\w'’&.-]+";
  const asked = question.replace(new RegExp(`\\b(?:did|does|do)\\s+(?!we\\b|you\\b|i\\b|us\\b)(?:${subjectWord}\\s+){0,4}?${TREATMENT_BASE}\\b`, 'gi'), ' ');
  return /\b(?:should|ought|recommend\w*|advis\w*|(?:we|i)\s+suggest)\b/i.test(asked)
    || /\b(?<!(?:remittance|debit|credit|bank|payment|dispatch|delivery|shipping|contra|fd)\s)advice\b/i.test(asked)
    // A present-tense ask for a treatment: "do the auditors want it reclassified as a loan?".
    || new RegExp(`\\b(?:want|wants|need|needs|require|requires)\\s+(?:it|this|that|them|these|the\\s+[^?]{1,40}?)\\s+${TREATMENT_PAST}\\b`, 'i').test(asked)
    || new RegExp(`\\b${TREATMENT_BASE}\\b`, 'i').test(asked)
    // Required or future treatment: "be capitalised", "be provided for".
    || new RegExp(`\\bbe\\s+${TREATMENT_PAST}\\b`, 'i').test(asked)
    // Required or future presentation: "be shown as", "has to be booked under", "needs to be treated as".
    || new RegExp(`\\bbe\\s+${PRESENTATION_VERBS}\\s+(?:as|under|in|to|within)\\b`, 'i').test(asked)
    // Imperative or infinitive presentation: "record it as", "treat the receipts as".
    || new RegExp(`\\b(?:to\\s+|please\\s+)?(?:classify|treat|record|book|show|present|transfer|move)\\s+(?:it|this|that|them|these|the\\s+[^?]{1,40}?)\\s+(?:as|under|to)\\b`, 'i').test(asked)
    // Asking the reader to judge a treatment: "is it appropriate to net …", "is it correct to call it a loan?".
    || new RegExp(`\\b${JUDGEMENT}\\s+(?:to|for\\s+\\w+\\s+to)\\s+(?:\\w+\\s+){0,2}(?:net|set\\s+off|call|treat|record|book|show|present|classify|leave|keep|stay|remain|account|report|group|move|put|place|accrue|provide|recognise|recognize|capitalise|capitalize|reclassify)\\b`, 'i').test(asked)
    || new RegExp(`\\b(?:appropriate|correct|right|acceptable|fine|ok|okay|permissible)\\s+that\\b`, 'i').test(asked)
    || new RegExp(`\\bbetter\\s+(?:recorded|booked|shown|classified|presented|treated|placed|grouped|regarded|described|called|labelled|labeled)\\b`, 'i').test(asked)
    || /\bmore\s+(?:apt|appropriate|suitable|correct|proper)\b/i.test(asked)
    || /\bright\s+(?:home|place|head|heading|bucket|ledger|group|category)\b/i.test(asked)
    || /\b(?:no adjustment|no change|legal review needed|is approved|is verified|the outcome is)\b/i.test(asked);
}

/**
 * A: blank every run of two or more words copied exactly from the flag's own data, so data is never judged as the
 * AI's wording. A copied run that would itself read as advice ("pls reclass to loan") is blanked only when the
 * question quotes it, so the AI cannot slip advice in by copying it unquoted.
 */
const MAX_WINDOW_TOKENS = 10, MAX_SOURCE_TOKENS = 40, MAX_WINDOWS = 1200;
// A quoted run counts as data only when a reading word introduces it ("the narration \"…\"", "wrote \"…\""), not when
// it is the object of a modal or an imperative ("Can we \"reclass to loan\" it?").
const READING_WORD = /(?:narration|says?|said|reads?|states?|stated|wrote|written|described|noted?|text|comment|remark|label+ed|marked|titled|called|words?|phrase|means?|meant|refers?|entry|voucher|reference)\b[^"'“‘]{0,25}["'“‘]\s*$/i;
function ownWords(question: string, input: FlagInput): string {
  const sources = [input.ledger, input.tallyGroup, ...input.entries.flatMap(entry => [entry.party, entry.narration])];
  const windows = new Set<string>();
  for (const source of sources) {
    const tokens = source.split(/\s+/).filter(Boolean).slice(0, MAX_SOURCE_TOKENS);
    for (let size = Math.min(tokens.length, MAX_WINDOW_TOKENS); size >= 2; size--) {
      for (let from = 0; from + size <= tokens.length && windows.size < MAX_WINDOWS; from++) {
        const run = tokens.slice(from, from + size);
        // A copied run starts and ends on a real word, never on a bare dash or symbol (which could hide a second question).
        if (!/[\p{L}\p{N}]/u.test(run[0]) || !/[\p{L}\p{N}]/u.test(run[run.length - 1])) continue;
        windows.add(run.map(escapePattern).join('\\s+'));
      }
    }
  }
  if (!windows.size) return question;
  const alternatives = [...windows].sort((a, b) => b.length - a.length).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
  // Copied words are blanked, but sentence breaks stay: "!", "?", ";" always, and a final "." when a new
  // capitalised sentence follows ("…received. What was it?"), so copied data cannot hide a second question.
  return question.replace(pattern, (match, offset: number, whole: string) => {
    const before = whole.slice(0, offset), after = whole.slice(offset + match.length);
    const quoted = READING_WORD.test(before) && /^\s*["'”’]/.test(after);
    if (advisesOrDecides(match) && !quoted) return match;
    const keepFinalStop = match.endsWith('.') && /^\s+[A-Z]/.test(after);
    return match.split('').map((char, index) => /[!?;\r\n]/.test(char) || (keepFinalStop && index === match.length - 1) ? char : ' ').join('');
  });
}

export function verifyReply(raw: string, input: FlagInput, knownNames: string[]): VerifiedReply {
  const reasons = new Set<VerifyReason>();
  const invented = new Set<string>();
  const fail = (reason: VerifyReason) => reasons.add(reason);
  const safeFailure = (): VerifiedReply => ({ status: 'rejected', question: UNREADY, evidenceIds: [], quotes: [], reasons: [...reasons], inventedCount: invented.size, quoteMisses: [] });
  const supplied = inputStrings(input);
  const corpus = supplied.join('\n');
  // A small code-supplied count would otherwise permit the same number anywhere ("three years");
  // it is allowed only where it counts entries (see countedEntries).
  // An entry date contributes only its year as a loose number: its month, day and time parts
  // ("…-04-05T00:00:00+05:30") would otherwise allow 4, 5, 0 and 30 on every flag. Dates stay checked as dates.
  const yearOnly = (date: string) => date.match(/^\d{4}/)?.[0] ?? '';
  // Rule and evidence ids ("R1-LOAN-AGREEMENT") are labels for code, not facts: they must not allow a "1".
  const allowedNumbers = new Set(inputStrings({ ...input, ruleId: '', entryCount: undefined,
    evidence: input.evidence.map(({ label }) => ({ label })),
    entries: input.entries.map(entry => ({ ...entry, date: yearOnly(entry.date) })) }).flatMap(value => numbers(value)));
  const allowedDates = supplied.flatMap(dates);
  const identities = [input.ledger, ...input.entries.map(entry => entry.party)];
  const explicitNameText = withoutIdentities([
    input.tallyGroup, ...input.entries.map(entry => entry.narration),
    ...inputStrings(input.theme), ...inputStrings(input.evidence),
  ].join('\n'), identities);
  const inspectFacts = (text: string) => {
    const textDates = dates(text);
    for (const date of textDates) {
      const allowed = (date.key.startsWith('month:') && allowedDates.some(candidate => candidate.monthYear === date.monthYear))
        || allowedDates.some(candidate => candidate.key === date.key
        || (date.key.startsWith('---') && !candidate.key.startsWith('invalid:') && candidate.monthDay === date.monthDay));
      if (!allowed) { fail('INVENTED_DATE'); invented.add(`date:${date.key}`); }
    }
    // A month or weekday named on its own ("repaid by next March", "last Tuesday") must exist in the data.
    const MONTH_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const undated = withoutDates(text, textDates);
    for (const match of undated.matchAll(/\b(january|february|march|april|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi)) {
      const name = match[1].toLowerCase(), month = MONTH_FULL.indexOf(name) + 1;
      const inData = new RegExp(`\\b(?:${name}|${name.slice(0, 3)})\\b`, 'i').test(corpus)
        || (month > 0 && allowedDates.some(candidate => candidate.monthDay.startsWith(String(month).padStart(2, '0'))));
      if (!inData) { fail('INVENTED_DATE'); invented.add(`date:${name}`); }
    }
    for (const number of numbers(countedEntries(undated, input.entryCount))) {
      if (!allowedNumbers.has(number)) { fail('INVENTED_NUMBER'); invented.add(`number:${number}`); }
    }
    // A shorter seeded party cannot be inferred from a different, longer ledger.
    const remainingNames = withoutIdentities(text, identities);
    for (const name of new Set(knownNames.filter(name => name.trim().length > 0))) {
      if (hasName(remainingNames, name) && !identities.includes(name) && !hasName(explicitNameText, name)) {
        fail('SEEDED_NAME_NOT_IN_INPUT'); invented.add(`name:${name.toLowerCase()}`);
      }
    }
    const titleCase = /\b[A-Z][a-z][A-Za-z\d'’-]*(?:\s+(?:&\s+)?[A-Z][a-z][A-Za-z\d'’-]*)+\b/g;
    for (const match of text.matchAll(titleCase)) {
      // A possessive ("Rajesh Mehta's") names the same party as the supplied name.
      const name = match[0].replace(/^(?:Was|Were|Is|Are|Does|Did|Do|Can|Could|Has|Have|Will|Would|What|Which|When|Where|Why|How|Please)\s+/, '')
        .replace(/['’]s$/, '');
      if (!/\s/.test(name)) continue;
      // Only a trailing "s" on the last word may differ (Sundry Creditor / Sundry Creditors).
      const variants = [name, `${name}s`, ...(/s$/.test(name) ? [name.slice(0, -1)] : [])];
      if (!variants.some(variant => hasName(corpus, variant))) { fail('UNKNOWN_TITLE_CASE_NAME'); invented.add(`name:${name.toLowerCase()}`); }
    }
  };
  let reply: unknown;
  try { reply = JSON.parse(raw) as unknown; } catch { fail('INVALID_JSON'); return safeFailure(); }
  if (!object(reply)) { fail('REPLY_NOT_OBJECT'); return safeFailure(); }
  // Count facts in a readable question even when the surrounding JSON is rejected.
  if (typeof reply.question === 'string') inspectFacts(reply.question);
  if (Object.keys(reply).sort().join(',') !== 'evidenceIds,question,quotes' || duplicateJsonKeys(raw)) { fail('REPLY_KEYS'); return safeFailure(); }
  if (typeof reply.question !== 'string') fail('QUESTION_TYPE');
  if (!Array.isArray(reply.evidenceIds) || !reply.evidenceIds.every(id => typeof id === 'string')) fail('EVIDENCE_TYPE');
  if (!Array.isArray(reply.quotes)) fail('QUOTES_TYPE');
  if (reasons.has('QUESTION_TYPE') || reasons.has('EVIDENCE_TYPE') || reasons.has('QUOTES_TYPE')) return safeFailure();

  const question = reply.question as string;
  const evidenceIds = reply.evidenceIds as string[];
  const rawQuotes = reply.quotes as unknown[];
  const quotes: Quote[] = [];
  if (question.length === 0 || question.length > 300) fail('QUESTION_LENGTH');
  if (!question.endsWith('?')) fail('QUESTION_END');
  // A: wording checks judge only the AI's own words; facts are still checked on the full question.
  const own = ownWords(question, input);
  if (!singleSentence(own, input.ruleId === 'R1')) fail('QUESTION_SENTENCE_COUNT');
  if (advisesOrDecides(own)) fail('QUESTION_ADVICE_OR_OUTCOME');
  if (citesLaw(own)) fail('CITATION');
  if (evidenceIds.length < 1 || evidenceIds.length > 3) fail('EVIDENCE_COUNT');
  if (new Set(evidenceIds).size !== evidenceIds.length) fail('EVIDENCE_DUPLICATE');
  const allowedEvidence = new Set(input.evidence.map(evidence => evidence.id));
  if (evidenceIds.some(id => !allowedEvidence.has(id))) fail('EVIDENCE_NOT_ALLOWED');
  if (rawQuotes.length < 1 || rawQuotes.length > 5) fail('QUOTE_COUNT');
  // Code-supplied count and total must be quoted whole; an absent value matches nothing.
  const quoteMatches = (field: Quote['field'], text: string): boolean => {
    if (field === 'totalAmount' || field === 'entryCount') return input[field] !== undefined && input[field] === text;
    const values = field === 'ledger' ? [input.ledger] : field === 'tallyGroup' ? [input.tallyGroup]
      : input.entries.map(entry => entry[field as EntryField]);
    return values.some(value => value.includes(text));
  };
  const unsupportedQuotes: Quote[] = [];
  for (const quote of rawQuotes) {
    if (!object(quote) || Object.keys(quote).sort().join(',') !== 'field,text' || typeof quote.text !== 'string' || typeof quote.field !== 'string' || quote.text.length === 0) {
      fail('QUOTE_SHAPE'); continue;
    }
    if (!quoteFields.includes(quote.field as Quote['field'])) { fail('QUOTE_FIELD'); continue; }
    const checked = quote as Quote;
    if (!quoteMatches(checked.field, checked.text)) { fail('QUOTE_NOT_IN_FIELD'); unsupportedQuotes.push(checked); continue; }
    quotes.push(checked);
  }
  const quoteMisses = unsupportedQuotes.map(quote =>
    `${quote.field}>${quoteFields.filter(field => quoteMatches(field, quote.text)).join('+') || 'none'}`);
  for (const quote of unsupportedQuotes) inspectFacts(quote.text);
  for (const quote of unsupportedQuotes) {
    if ((quote.field === 'party' || quote.field === 'ledger') && !hasName(corpus, quote.text)) invented.add(`name:${quote.text.toLowerCase()}`);
  }
  // Malformed quote structures never retain raw strings in stored output.
  if (reasons.has('QUOTE_SHAPE') || reasons.has('QUOTE_FIELD')) return safeFailure();
  return { status: reasons.size ? 'rejected' : 'verified', question, evidenceIds, quotes, reasons: [...reasons], inventedCount: invented.size, quoteMisses };
}
