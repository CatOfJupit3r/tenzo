import { z } from 'zod';

import type { CharacterTextFieldKey } from '../cards/card-schema';
import { CHARACTER_TEXT_FIELD_KEYS } from '../cards/card-schema';
import { TEMPLATE_SLOT_PATTERN } from '../cards/field-templates';

export const QUALITY_RULE_SCHEMA = z.enum([
  'empty_field',
  'short_field',
  'required_macro_missing',
  'strict_template_preservation',
  'duplicate_sentence',
  'ngram_overlap',
]);
export const QUALITY_RULES = QUALITY_RULE_SCHEMA.enum;
export type QualityRule = z.infer<typeof QUALITY_RULE_SCHEMA>;

export const QUALITY_SEVERITY_SCHEMA = z.enum(['error', 'warning']);
export const QUALITY_SEVERITIES = QUALITY_SEVERITY_SCHEMA.enum;
export type QualitySeverity = z.infer<typeof QUALITY_SEVERITY_SCHEMA>;

export const QUALITY_EVIDENCE_CLASS_SCHEMA = z.enum(['length', 'macro', 'template', 'exact_sentence', 'ngram_overlap']);
export const QUALITY_EVIDENCE_CLASSES = QUALITY_EVIDENCE_CLASS_SCHEMA.enum;
export type QualityEvidenceClass = z.infer<typeof QUALITY_EVIDENCE_CLASS_SCHEMA>;

export const DEFAULT_DETERMINISTIC_QUALITY_OPTIONS = {
  sentenceMinimumWordCount: 4,
  ngramSize: 3,
  ngramOverlapThreshold: 0.5,
} as const;

export interface iDeterministicQualityFieldConstraints {
  minimumWordCount?: number;
  requiredMacros?: readonly string[];
  strictTemplate?: string;
}

export interface iDeterministicQualityEvaluationOptions {
  sentenceMinimumWordCount?: number;
  ngramSize?: number;
  ngramOverlapThreshold?: number;
}

export interface iDeterministicQualityEvaluationInput {
  fields: Partial<Record<CharacterTextFieldKey, string>>;
  constraints?: Partial<Record<CharacterTextFieldKey, iDeterministicQualityFieldConstraints>>;
  options?: iDeterministicQualityEvaluationOptions;
}

export type QualityFindingFieldKeys =
  | readonly [CharacterTextFieldKey]
  | readonly [CharacterTextFieldKey, CharacterTextFieldKey];

export interface iDeterministicQualityFinding {
  rule: QualityRule;
  severity: QualitySeverity;
  evidenceClass: QualityEvidenceClass;
  fieldKeys: QualityFindingFieldKeys;
  message: string;
  repairInstruction: string;
  score?: number;
}

export interface iDeterministicQualityEvaluationResult {
  findings: iDeterministicQualityFinding[];
}

const QUALITY_RULE_ORDER = {
  [QUALITY_RULES.empty_field]: 0,
  [QUALITY_RULES.short_field]: 1,
  [QUALITY_RULES.required_macro_missing]: 2,
  [QUALITY_RULES.strict_template_preservation]: 3,
  [QUALITY_RULES.duplicate_sentence]: 4,
  [QUALITY_RULES.ngram_overlap]: 5,
} satisfies Record<QualityRule, number>;

const FIELD_KEY_ORDER = new Map(CHARACTER_TEXT_FIELD_KEYS.map((fieldKey, index) => [fieldKey, index] as const));

const MACRO_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const WORD_TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
const SENTENCE_BOUNDARY_PATTERN = /[.!?]+|\r?\n+/g;

const QUALITY_FINDING_COPY = {
  [QUALITY_RULES.empty_field]: {
    severity: QUALITY_SEVERITIES.error,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.length,
    message: 'Field is empty.',
    repairInstruction: 'Add meaningful field content.',
  },
  [QUALITY_RULES.short_field]: {
    severity: QUALITY_SEVERITIES.warning,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.length,
    message: 'Field is shorter than its configured minimum.',
    repairInstruction: 'Expand the field with specific, relevant detail.',
  },
  [QUALITY_RULES.required_macro_missing]: {
    severity: QUALITY_SEVERITIES.error,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.macro,
    message: 'A required macro is missing.',
    repairInstruction: 'Restore every required macro without changing the surrounding content.',
  },
  [QUALITY_RULES.strict_template_preservation]: {
    severity: QUALITY_SEVERITIES.error,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.template,
    message: 'Strict template structure is not preserved.',
    repairInstruction: 'Restore the template fragments in order and resolve every generation slot.',
  },
  [QUALITY_RULES.duplicate_sentence]: {
    severity: QUALITY_SEVERITIES.warning,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.exact_sentence,
    message: 'The same sentence is reused across fields.',
    repairInstruction: 'Keep the sentence in its most appropriate field and write distinct content elsewhere.',
  },
  [QUALITY_RULES.ngram_overlap]: {
    severity: QUALITY_SEVERITIES.warning,
    evidenceClass: QUALITY_EVIDENCE_CLASSES.ngram_overlap,
    message: 'Fields have substantial normalized n-gram overlap.',
    repairInstruction: "Reduce repeated phrasing while preserving each field's distinct purpose.",
  },
} satisfies Record<
  QualityRule,
  {
    severity: QualitySeverity;
    evidenceClass: QualityEvidenceClass;
    message: string;
    repairInstruction: string;
  }
>;

interface iSentenceRecord {
  fieldKey: CharacterTextFieldKey;
  normalizedSentence: string;
}

interface iTokenizedField {
  fieldKey: CharacterTextFieldKey;
  tokens: string[];
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function normalizeThreshold(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

function normalizeMacroName(value: string): string {
  const match = /^\{\{([\s\S]+)\}\}$/.exec(value.trim());
  const name = match?.[1] ?? value;
  return name.replace(/\s+/g, '').toLowerCase();
}

function extractMacroNames(value: string): Set<string> {
  return new Set([...value.matchAll(MACRO_PATTERN)].map((match) => normalizeMacroName(match[0] ?? '')));
}

function removeTemplateSyntax(value: string): string {
  return value.replace(MACRO_PATTERN, ' ');
}

function tokenize(value: string): string[] {
  return [...removeTemplateSyntax(value).toLowerCase().matchAll(WORD_TOKEN_PATTERN)].map((match) => match[0]);
}

function getFieldKeys(fields: Partial<Record<CharacterTextFieldKey, string>>): CharacterTextFieldKey[] {
  return CHARACTER_TEXT_FIELD_KEYS.filter((fieldKey) => fields[fieldKey] !== undefined);
}

function getFieldKeyIndex(fieldKey: CharacterTextFieldKey): number {
  return FIELD_KEY_ORDER.get(fieldKey) ?? Number.MAX_SAFE_INTEGER;
}

function compareFieldKeys(left: CharacterTextFieldKey, right: CharacterTextFieldKey): number {
  return getFieldKeyIndex(left) - getFieldKeyIndex(right);
}

function normalizeComparableStaticContent(value: string): string {
  return value
    .replace(MACRO_PATTERN, (_, rawName: string) => `{{${normalizeMacroName(rawName)}}}`)
    .replace(/\s+/g, ' ')
    .trim();
}

function getTemplateStaticFragments(template: string): string[] {
  const fragments: string[] = [];
  let cursor = 0;

  for (const match of template.matchAll(TEMPLATE_SLOT_PATTERN)) {
    fragments.push(template.slice(cursor, match.index));
    cursor = (match.index ?? 0) + match[0].length;
  }

  fragments.push(template.slice(cursor));
  return fragments.map(normalizeComparableStaticContent).filter((fragment) => fragment.length > 0);
}

function hasStaticFragmentsInOrder(template: string, output: string): boolean {
  const normalizedOutput = normalizeComparableStaticContent(output);
  let searchFrom = 0;

  for (const fragment of getTemplateStaticFragments(template)) {
    const fragmentIndex = normalizedOutput.indexOf(fragment, searchFrom);

    if (fragmentIndex < 0) {
      return false;
    }

    searchFrom = fragmentIndex + fragment.length;
  }

  return true;
}

function getSentenceRecords(
  fieldKey: CharacterTextFieldKey,
  value: string,
  minimumWordCount: number,
): iSentenceRecord[] {
  const normalizedValue = removeTemplateSyntax(value);
  const records: iSentenceRecord[] = [];
  let sentenceStart = 0;

  for (const boundary of normalizedValue.matchAll(SENTENCE_BOUNDARY_PATTERN)) {
    const sentence = normalizedValue.slice(sentenceStart, boundary.index).trim();
    const tokens = tokenize(sentence);

    if (tokens.length >= minimumWordCount) {
      records.push({ fieldKey, normalizedSentence: tokens.join(' ') });
    }

    sentenceStart = (boundary.index ?? 0) + boundary[0].length;
  }

  const trailingSentence = normalizedValue.slice(sentenceStart).trim();
  const trailingTokens = tokenize(trailingSentence);

  if (trailingTokens.length >= minimumWordCount) {
    records.push({ fieldKey, normalizedSentence: trailingTokens.join(' ') });
  }

  return records;
}

function createFinding(
  rule: QualityRule,
  fieldKeys: QualityFindingFieldKeys,
  score?: number,
): iDeterministicQualityFinding {
  const copy = QUALITY_FINDING_COPY[rule];
  return {
    rule,
    severity: copy.severity,
    evidenceClass: copy.evidenceClass,
    fieldKeys,
    message: copy.message,
    repairInstruction: copy.repairInstruction,
    ...(score === undefined ? {} : { score }),
  };
}

function getNgrams(tokens: string[], ngramSize: number): Set<string> {
  const ngrams = new Set<string>();

  for (let index = 0; index <= tokens.length - ngramSize; index += 1) {
    ngrams.add(tokens.slice(index, index + ngramSize).join(' '));
  }

  return ngrams;
}

/**
 * Evaluates content-free deterministic quality rules for proposed character fields.
 * N-gram overlap is the symmetric Sorensen-Dice score over unique normalized n-grams:
 * `2 * intersection / (leftCount + rightCount)`. A pair is reported when the score
 * is at least `options.ngramOverlapThreshold` and both fields contain one n-gram.
 */
export function evaluateDeterministicQuality(
  input: iDeterministicQualityEvaluationInput,
): iDeterministicQualityEvaluationResult {
  const findings: iDeterministicQualityFinding[] = [];
  const fieldKeys = getFieldKeys(input.fields);
  const sentenceMinimumWordCount = normalizePositiveInteger(
    input.options?.sentenceMinimumWordCount,
    DEFAULT_DETERMINISTIC_QUALITY_OPTIONS.sentenceMinimumWordCount,
  );
  const ngramSize = normalizePositiveInteger(input.options?.ngramSize, DEFAULT_DETERMINISTIC_QUALITY_OPTIONS.ngramSize);
  const ngramOverlapThreshold = normalizeThreshold(
    input.options?.ngramOverlapThreshold,
    DEFAULT_DETERMINISTIC_QUALITY_OPTIONS.ngramOverlapThreshold,
  );

  for (const fieldKey of fieldKeys) {
    const value = input.fields[fieldKey] ?? '';
    const normalizedValue = value.trim();
    const constraints = input.constraints?.[fieldKey];

    if (!normalizedValue) {
      findings.push(createFinding(QUALITY_RULES.empty_field, [fieldKey]));
      continue;
    }

    const minimumWordCount = constraints?.minimumWordCount;
    const wordCount = tokenize(value).length;

    if (minimumWordCount !== undefined && Number.isFinite(minimumWordCount) && minimumWordCount > 0) {
      if (wordCount < minimumWordCount) {
        findings.push(createFinding(QUALITY_RULES.short_field, [fieldKey]));
      }
    }

    if (constraints?.requiredMacros && constraints.requiredMacros.length > 0) {
      const outputMacros = extractMacroNames(value);
      const hasMissingMacro = constraints.requiredMacros.some(
        (requiredMacro) => !outputMacros.has(normalizeMacroName(requiredMacro)),
      );

      if (hasMissingMacro) {
        findings.push(createFinding(QUALITY_RULES.required_macro_missing, [fieldKey]));
      }
    }

    if (constraints?.strictTemplate !== undefined && !hasStaticFragmentsInOrder(constraints.strictTemplate, value)) {
      findings.push(createFinding(QUALITY_RULES.strict_template_preservation, [fieldKey]));
    } else if (constraints?.strictTemplate !== undefined && TEMPLATE_SLOT_PATTERN.test(value)) {
      TEMPLATE_SLOT_PATTERN.lastIndex = 0;
      findings.push(createFinding(QUALITY_RULES.strict_template_preservation, [fieldKey]));
    }
    TEMPLATE_SLOT_PATTERN.lastIndex = 0;
  }

  const sentenceRecordsByValue = new Map<string, iSentenceRecord[]>();

  for (const fieldKey of fieldKeys) {
    const value = input.fields[fieldKey] ?? '';

    for (const record of getSentenceRecords(fieldKey, value, sentenceMinimumWordCount)) {
      const records = sentenceRecordsByValue.get(record.normalizedSentence) ?? [];

      if (!records.some((existingRecord) => existingRecord.fieldKey === fieldKey)) {
        records.push(record);
        sentenceRecordsByValue.set(record.normalizedSentence, records);
      }
    }
  }

  for (const records of sentenceRecordsByValue.values()) {
    if (records.length >= 2) {
      const sortedRecords = [...records].sort((left, right) => compareFieldKeys(left.fieldKey, right.fieldKey));
      findings.push(
        createFinding(QUALITY_RULES.duplicate_sentence, [sortedRecords[0].fieldKey, sortedRecords[1].fieldKey]),
      );
    }
  }

  const tokenizedFields: iTokenizedField[] = fieldKeys
    .map((fieldKey) => ({ fieldKey, tokens: tokenize(input.fields[fieldKey] ?? '') }))
    .filter(({ tokens }) => tokens.length >= ngramSize);

  for (let leftIndex = 0; leftIndex < tokenizedFields.length; leftIndex += 1) {
    const leftField = tokenizedFields[leftIndex];
    const leftNgrams = getNgrams(leftField.tokens, ngramSize);

    for (let rightIndex = leftIndex + 1; rightIndex < tokenizedFields.length; rightIndex += 1) {
      const rightField = tokenizedFields[rightIndex];
      const rightNgrams = getNgrams(rightField.tokens, ngramSize);
      const intersectionCount = [...leftNgrams].filter((ngram) => rightNgrams.has(ngram)).length;
      const score = (2 * intersectionCount) / (leftNgrams.size + rightNgrams.size);

      if (score >= ngramOverlapThreshold) {
        findings.push(
          createFinding(
            QUALITY_RULES.ngram_overlap,
            [leftField.fieldKey, rightField.fieldKey],
            Number(score.toFixed(6)),
          ),
        );
      }
    }
  }

  findings.sort((left, right) => {
    const ruleOrderDifference = QUALITY_RULE_ORDER[left.rule] - QUALITY_RULE_ORDER[right.rule];

    if (ruleOrderDifference !== 0) {
      return ruleOrderDifference;
    }

    const fieldOrderDifference = compareFieldKeys(left.fieldKeys[0], right.fieldKeys[0]);
    return fieldOrderDifference !== 0
      ? fieldOrderDifference
      : compareFieldKeys(left.fieldKeys[1] ?? left.fieldKeys[0], right.fieldKeys[1] ?? right.fieldKeys[0]);
  });

  return { findings };
}
