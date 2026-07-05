import {
  DEFAULT_CHARACTER_CARD_WRITING_GUIDE,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  getFormatInstructions,
} from '../constants/default-prompts';
import type { CharacterCard, CharacterTextFieldKey, CustomField } from './card-schema';
import type { OutputFormat } from './generation-config';

export interface iGenerationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface iPromptExampleCharacter {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  alternate_greetings?: string[];
  custom_fields?: CustomField[];
}

export interface iFieldGenerationTarget {
  key: string;
  label: string;
  value: string;
  kind: 'field' | 'alternate-greeting' | 'custom-field';
}

const STANDARD_FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  personality: 'Personality',
  scenario: 'Scenario',
  first_mes: 'First Message',
  mes_example: 'Example Dialogue',
  creator_notes: 'Creator Notes',
  system_prompt: 'System Prompt',
  post_history_instructions: 'Post-History Instructions',
  creator: 'Creator',
  character_version: 'Version',
} satisfies Record<CharacterTextFieldKey, string>;

const CORE_CONTEXT_KEYS: CharacterTextFieldKey[] = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'creator',
  'character_version',
];

function formatBulletList(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n');
}

interface iCharacterSnapshot {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  alternate_greetings?: string[];
  custom_fields?: CustomField[];
}

function formatCharacterSnapshot(data: iCharacterSnapshot) {
  const lines: string[] = [];

  if (data.name?.trim()) {
    lines.push(`Name: ${data.name.trim()}`);
  }

  if (data.description?.trim()) {
    lines.push(`Description: ${data.description.trim()}`);
  }

  if (data.personality?.trim()) {
    lines.push(`Personality: ${data.personality.trim()}`);
  }

  if (data.scenario?.trim()) {
    lines.push(`Scenario: ${data.scenario.trim()}`);
  }

  if (data.first_mes?.trim()) {
    lines.push(`First Message: ${data.first_mes.trim()}`);
  }

  if (data.mes_example?.trim()) {
    lines.push(`Example Dialogue: ${data.mes_example.trim()}`);
  }

  if (Array.isArray(data.alternate_greetings) && data.alternate_greetings.length > 0) {
    lines.push(
      `Alternate Greetings: ${data.alternate_greetings
        .map((greeting, index) => `[${index + 1}] ${greeting}`)
        .join(' | ')}`,
    );
  }

  if (Array.isArray(data.custom_fields) && data.custom_fields.length > 0) {
    lines.push(
      `Custom Fields: ${data.custom_fields
        .filter((field) => field.label.trim() !== '' || field.value.trim() !== '')
        .map((field) => {
          const trimmedLabel = field.label.trim();
          const trimmedValue = field.value.trim();

          return `${trimmedLabel !== '' ? trimmedLabel : 'Untitled Field'} = ${trimmedValue !== '' ? trimmedValue : '(empty)'}`;
        })
        .join(' | ')}`,
    );
  }

  return lines;
}

function buildExistingFieldsSection(card: CharacterCard, target: iFieldGenerationTarget) {
  const { data } = card;
  const lines: string[] = [];

  CORE_CONTEXT_KEYS.forEach((key) => {
    const value = data[key]?.trim();
    if (!value) {
      return;
    }

    lines.push(`${STANDARD_FIELD_LABELS[key]}: ${value}`);
  });

  if (data.tags.length > 0) {
    lines.push(`Tags: ${data.tags.join(', ')}`);
  }

  if (data.alternate_greetings.length > 0) {
    data.alternate_greetings.forEach((greeting, index) => {
      if (!greeting.trim()) {
        return;
      }

      const isTargetGreeting = target.kind === 'alternate-greeting' && target.key === `alternate_greetings:${index}`;
      lines.push(`Alternate Greeting ${index + 1}${isTargetGreeting ? ' (target)' : ''}: ${greeting.trim()}`);
    });
  }

  if (data.extensions.custom_fields.length > 0) {
    data.extensions.custom_fields.forEach((field) => {
      if (!field.label.trim() && !field.value.trim()) {
        return;
      }

      const isTargetCustomField = target.kind === 'custom-field' && target.key === `custom:${field.id}`;
      lines.push(
        `Custom Field ${field.label.trim() !== '' ? field.label.trim() : 'Untitled'}${isTargetCustomField ? ' (target)' : ''}: ${field.value.trim() !== '' ? field.value.trim() : '(empty)'}`,
      );
    });
  }

  if (lines.length === 0) {
    return '';
  }

  return ['Current card context:', formatBulletList(lines)].join('\n');
}

function buildExamplesSection(exampleCharacters: iPromptExampleCharacter[]) {
  const nonEmptyExamples = exampleCharacters
    .map((exampleCharacter) => formatCharacterSnapshot(exampleCharacter))
    .filter((snapshot) => snapshot.length > 0);

  if (nonEmptyExamples.length === 0) {
    return '';
  }

  return [
    'Reference characters:',
    ...nonEmptyExamples.map((snapshotLines, index) =>
      [`Example ${index + 1}:`, formatBulletList(snapshotLines)].join('\n'),
    ),
  ].join('\n\n');
}

function resolveOverride(overrideValue: string, fallbackValue: string) {
  const trimmedOverride = overrideValue.trim();
  if (!trimmedOverride) {
    return fallbackValue;
  }

  if (trimmedOverride.includes('{{original}}')) {
    return trimmedOverride.replaceAll('{{original}}', fallbackValue);
  }

  return trimmedOverride;
}

export function getGenerationTargetKey(target: iFieldGenerationTarget) {
  return target.key;
}

export interface iBuildGenerationMessagesOptions {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  outputFormat: OutputFormat;
  userInstructions?: string;
  exampleCharacters?: iPromptExampleCharacter[];
}

export function buildGenerationMessages({
  card,
  target,
  outputFormat,
  userInstructions = '',
  exampleCharacters = [],
}: iBuildGenerationMessagesOptions): iGenerationMessage[] {
  const systemPrompt = resolveOverride(card.data.system_prompt, DEFAULT_CHARACTER_CARD_WRITING_GUIDE);
  const postHistoryInstructions = resolveOverride(
    card.data.post_history_instructions,
    DEFAULT_POST_HISTORY_INSTRUCTIONS,
  );

  const sections = [
    buildExistingFieldsSection(card, target),
    buildExamplesSection(exampleCharacters),
    [
      `Your task is to write the "${target.label}" field for a SillyTavern V2 character card.`,
      target.value.trim()
        ? `The current ${target.label} value is provided in the context above. Improve or continue it only when the request context implies that.`
        : `The current ${target.label} value is empty. Create it from scratch based on the available card context.`,
      'Keep the result consistent with the rest of the card.',
      userInstructions.trim() ? `Field-specific instructions: ${userInstructions.trim()}` : '',
      getFormatInstructions(outputFormat),
    ]
      .filter(Boolean)
      .join('\n'),
  ].filter(Boolean);

  const messages: iGenerationMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: sections.join('\n\n') },
  ];

  if (postHistoryInstructions) {
    messages.push({ role: 'system', content: postHistoryInstructions });
  }

  return messages;
}
