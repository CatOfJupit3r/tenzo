import { describe, expect, it } from 'vitest';

import type { iDeterministicQualityEvaluationInput } from './deterministic-quality-metrics';
import { evaluateDeterministicQuality, QUALITY_RULES } from './deterministic-quality-metrics';

function getRules(input: iDeterministicQualityEvaluationInput) {
  return evaluateDeterministicQuality(input).findings.map((finding) => finding.rule);
}

describe('evaluateDeterministicQuality', () => {
  it('distinguishes whitespace-only fields from non-empty fields below a configured minimum', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: '   \n\t',
        personality: 'Quiet',
      },
      constraints: {
        personality: { minimumWordCount: 3 },
      },
    });

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: QUALITY_RULES.empty_field, fieldKeys: ['description'] }),
      expect.objectContaining({ rule: QUALITY_RULES.short_field, fieldKeys: ['personality'] }),
    ]);
  });

  it('accepts required macros with case and internal whitespace variants', () => {
    const result = evaluateDeterministicQuality({
      fields: { system_prompt: 'Speak as {{ char }} to {{USER}}.' },
      constraints: { system_prompt: { requiredMacros: ['{{CHAR}}', '{{ user }}'] } },
    });

    expect(
      getRules({
        fields: { system_prompt: 'Speak as {{ char }}.' },
        constraints: { system_prompt: { requiredMacros: ['{{CHAR}}', '{{ user }}'] } },
      }),
    ).toEqual([QUALITY_RULES.required_macro_missing]);
    expect(result.findings).toEqual([]);
  });

  it('preserves strict template fragments and ordinary macros while resolving generation slots', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        first_mes: 'Opening line for {{ char }}. A warm greeting follows.',
      },
      constraints: {
        first_mes: {
          strictTemplate: 'Opening line for {{char}}. {{gen:greeting}} A warm greeting follows.',
        },
      },
    });

    expect(result.findings).toEqual([]);
  });

  it('flags missing strict-template structure and unresolved generation slots', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        first_mes: 'Opening line. {{gen:greeting}}',
        scenario: 'Only the ending remains.',
      },
      constraints: {
        first_mes: { strictTemplate: 'Opening line. {{gen:greeting}} A warm greeting follows.' },
        scenario: { strictTemplate: 'A beginning. {{gen:scene}} An ending.' },
      },
    });

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: QUALITY_RULES.strict_template_preservation, fieldKeys: ['scenario'] }),
      expect.objectContaining({ rule: QUALITY_RULES.strict_template_preservation, fieldKeys: ['first_mes'] }),
    ]);
  });

  it('reports one stable field pair for an exact sentence reused across fields', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: 'Aster keeps a silver compass near her heart. She avoids crowds.',
        personality: 'She avoids crowds! Her patience is deliberate.',
        scenario: 'Aster carries a brass key beneath her coat.',
      },
      options: { sentenceMinimumWordCount: 3 },
    });

    expect(result.findings).toEqual([
      expect.objectContaining({ rule: QUALITY_RULES.duplicate_sentence, fieldKeys: ['description', 'personality'] }),
    ]);
  });

  it('does not treat paraphrases as deterministic exact duplicates', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: 'The captain protects the harbor at night.',
        personality: 'After dark, the commander guards the waterfront.',
      },
      options: { sentenceMinimumWordCount: 4 },
    });

    expect(result.findings.some((finding) => finding.rule === QUALITY_RULES.duplicate_sentence)).toBe(false);
  });

  it('flags n-gram overlap at the threshold and leaves below-threshold pairs alone', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: 'The quiet captain watches the harbor lights each evening.',
        personality: 'The quiet captain watches the harbor stars each evening.',
        scenario: 'A baker prepares warm bread before sunrise.',
      },
      options: { ngramSize: 3, ngramOverlapThreshold: 0.5 },
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        rule: QUALITY_RULES.ngram_overlap,
        fieldKeys: ['description', 'personality'],
        score: expect.any(Number),
      }),
    ]);
  });

  it('does not compare fields that cannot form one normalized n-gram and excludes syntax tokens', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: '{{char}} {{user}}',
        personality: 'One two',
        scenario: 'Dawn arrives quietly.',
      },
      options: { ngramSize: 3, ngramOverlapThreshold: 0 },
    });

    expect(result.findings).toEqual([]);
  });

  it('keeps findings content-free and in stable rule and field order', () => {
    const result = evaluateDeterministicQuality({
      fields: {
        description: 'Secret phrase.',
        personality: 'Secret phrase.',
        scenario: '   ',
      },
      constraints: {
        description: { minimumWordCount: 4, requiredMacros: ['{{char}}'] },
      },
      options: { sentenceMinimumWordCount: 2, ngramSize: 99, ngramOverlapThreshold: 1 },
    });

    expect(result.findings.map((finding) => finding.rule)).toEqual([
      QUALITY_RULES.empty_field,
      QUALITY_RULES.short_field,
      QUALITY_RULES.required_macro_missing,
      QUALITY_RULES.duplicate_sentence,
    ]);
    expect(JSON.stringify(result)).not.toContain('Secret phrase');
    expect(JSON.stringify(result)).not.toContain('{{char}}');
  });
});
