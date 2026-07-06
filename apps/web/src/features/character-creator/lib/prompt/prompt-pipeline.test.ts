import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { OUTPUT_FORMATS } from '../generation-config';
import { buildExampleContextSummary, getExampleContextCharacterBudget } from './example-context-service';
import { GENERATION_MODES, GENERATION_TARGET_KINDS } from './generation-contracts';
import type { iFieldGenerationTarget, iPromptExampleCharacter } from './generation-contracts';
import { characterPromptPipeline } from './prompt-pipeline';
import { createSeededRandom } from './seeded-random';

function createDescriptionTarget(value = ''): iFieldGenerationTarget {
  return {
    key: 'field:description',
    label: 'Description',
    value,
    kind: GENERATION_TARGET_KINDS.field,
  };
}

const MANY_EXAMPLES: iPromptExampleCharacter[] = ['Astra', 'Brimble', 'Corvus', 'Dahlia', 'Ember'].map((name) => ({
  name,
  description: `${name} is a distinct reference character.`,
}));

describe('prompt-pipeline', () => {
  it('includes current card context, the general character idea, and field instructions', () => {
    const card = createEmptyCharacterCard();
    card.data.name = 'Fire Keeper';
    card.data.description = 'A quiet guardian of the kiln.';
    card.data.personality = 'Warm and unhurried.';
    card.data.alternate_greetings = ['The coals are kind tonight.'];
    card.data.extensions.custom_fields = [{ id: 'weapon', label: 'Weapon', value: 'Lantern spear' }];

    const { messages } = characterPromptPipeline.build({
      card,
      target: {
        key: 'field:first_mes',
        label: 'First Message',
        value: '',
        kind: GENERATION_TARGET_KINDS.field,
      },
      outputFormat: OUTPUT_FORMATS.xml,
      seed: 1,
      generalCharacterIdea: 'A quietly devout firekeeper with ceremonial language.',
      userInstructions: 'Open with a tactile sensory detail.',
    });

    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('Name: Fire Keeper');
    expect(messages[1]?.content).toContain('Custom Field Weapon: Lantern spear');
    expect(messages[1]?.content).toContain(
      'General character idea: A quietly devout firekeeper with ceremonial language.',
    );
    expect(messages[1]?.content).toContain('Field-specific instructions: Open with a tactile sensory detail.');
    expect(messages[1]?.content).toContain('Return the answer wrapped in a single <response> tag.');
  });

  it('omits the general character idea when the field switch is off', () => {
    const card = createEmptyCharacterCard();

    const { messages } = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget(),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 1,
      generalCharacterIdea: 'A knight who masks grief with ritual politeness.',
      shouldUseGeneralCharacterIdea: false,
    });

    expect(messages[1]?.content).not.toContain('General character idea:');
  });

  it('applies system prompt overrides through the original placeholder', () => {
    const card = createEmptyCharacterCard();
    card.data.system_prompt = 'Prefix instructions.\n{{original}}\nSuffix instructions.';
    card.data.post_history_instructions = 'Trailing reminder.';

    const { messages } = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget('Current text'),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 1,
    });

    expect(messages[0]?.content).toContain('Prefix instructions.');
    expect(messages[0]?.content).toContain('expert character card writing assistant');
    expect(messages[0]?.content).toContain('Suffix instructions.');
    expect(messages[2]?.content).toBe('Trailing reminder.');
  });

  it('adds a truncation warning when reference examples overflow the prompt budget', () => {
    const card = createEmptyCharacterCard();

    const { messages } = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget(),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 1,
      exampleCharacters: [
        {
          name: 'Dense Example',
          description: 'y'.repeat(7_500),
        },
      ],
    });

    expect(messages[1]?.content).toContain('Reference example content was truncated');
  });

  it('marks reference examples as non-copyable style references', () => {
    const card = createEmptyCharacterCard();

    const { messages } = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget(),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 1,
      exampleCharacters: MANY_EXAMPLES,
    });

    expect(messages[1]?.content).toContain('Reference characters (format, depth, and quality references only):');
    expect(messages[1]?.content).toContain('Do not reuse or closely paraphrase');
  });

  it('produces identical messages for the same seed', () => {
    const card = createEmptyCharacterCard();
    const input = {
      card,
      target: createDescriptionTarget(),
      outputFormat: OUTPUT_FORMATS.xml,
      seed: 42,
      exampleCharacters: MANY_EXAMPLES,
    };

    expect(characterPromptPipeline.build(input).messages).toEqual(characterPromptPipeline.build(input).messages);
  });

  it('varies example order and creative direction across seeds', () => {
    const card = createEmptyCharacterCard();
    const buildWithSeed = (seed: number) =>
      characterPromptPipeline.build({
        card,
        target: createDescriptionTarget(),
        outputFormat: OUTPUT_FORMATS.xml,
        seed,
        exampleCharacters: MANY_EXAMPLES,
      }).messages[1]?.content;

    const baseline = buildWithSeed(1);
    const hasDivergentSeed = [2, 3, 4, 5, 6, 7, 8].some((seed) => buildWithSeed(seed) !== baseline);

    expect(hasDivergentSeed).toBe(true);
  });

  it('adds a seeded variation directive for creative fields and skips it for continue mode', () => {
    const card = createEmptyCharacterCard();

    const generateResult = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget(),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 7,
    });

    expect(generateResult.messages[1]?.content).toContain('Variation seed: 7.');
    expect(generateResult.messages[1]?.content).toContain('Creative direction for this generation:');

    const continueResult = characterPromptPipeline.build({
      card,
      target: createDescriptionTarget('Existing text to continue.'),
      outputFormat: OUTPUT_FORMATS.none,
      seed: 7,
      mode: GENERATION_MODES.continue,
    });

    expect(continueResult.messages[1]?.content).not.toContain('Variation seed:');
  });

  it('skips the variation directive for meta fields', () => {
    const card = createEmptyCharacterCard();

    const { messages } = characterPromptPipeline.build({
      card,
      target: {
        key: 'field:creator',
        label: 'Creator',
        value: '',
        kind: GENERATION_TARGET_KINDS.field,
      },
      outputFormat: OUTPUT_FORMATS.none,
      seed: 7,
    });

    expect(messages[1]?.content).not.toContain('Variation seed:');
  });
});

describe('example-context-service', () => {
  it('includes partial reference content when an example field exceeds the character budget', () => {
    const summary = buildExampleContextSummary({
      exampleCharacters: [
        {
          description: 'x'.repeat(400),
        },
      ],
      maxCharacters: 250,
    });

    expect(summary.section).toContain('Reference characters');
    expect(summary.section).toContain('Example 1:');
    expect(summary.section).toContain('Description:');
    expect(summary.section).toContain('...');
    expect(summary.isTruncated).toBe(true);
    expect(summary.usedCharacters).toBeLessThan(summary.totalCharacters);
    expect(summary.usedCharacters).toBeGreaterThan(0);
  });

  it('scales the example budget with larger context windows', () => {
    const smallBudget = getExampleContextCharacterBudget(4_096, 600);
    const largeBudget = getExampleContextCharacterBudget(32_768, 600);

    expect(largeBudget).toBeGreaterThan(smallBudget);
    expect(smallBudget).toBeGreaterThanOrEqual(2_000);
  });

  it('shuffles example order deterministically from the seeded source', () => {
    const summaryForSeed = (seed: number) =>
      buildExampleContextSummary({
        exampleCharacters: MANY_EXAMPLES,
        random: createSeededRandom(seed),
      }).section;

    expect(summaryForSeed(3)).toBe(summaryForSeed(3));

    MANY_EXAMPLES.forEach((example) => {
      expect(summaryForSeed(3)).toContain(`Name: ${example.name}`);
    });
  });
});
