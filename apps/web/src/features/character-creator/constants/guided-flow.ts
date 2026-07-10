import { z } from 'zod';

import type { CharacterEditFieldKey } from '../lib/character-edit-proposal';
import { CHARACTER_EDIT_FIELD_KEYS } from '../lib/character-edit-proposal';
import type { TemplateFieldKey } from '../lib/field-templates';
import { TEMPLATE_FIELD_KEYS } from '../lib/field-templates';

export const GUIDED_STEP_ID_SCHEMA = z.enum([
  'concept',
  'appearance',
  'personality',
  'scenario',
  'voice',
  'metadata',
  'review',
]);
export const GUIDED_STEP_IDS = GUIDED_STEP_ID_SCHEMA.enum;
export type GuidedStepId = z.infer<typeof GUIDED_STEP_ID_SCHEMA>;

export interface iGuidedStepDefinition {
  id: GuidedStepId;
  title: string;
  userPrompt: string;
  agentInstructions: string;
  allowedFieldKeys: readonly CharacterEditFieldKey[];
  isImageStepAllowed: boolean;
  isSkippable: boolean;
  suggestedTemplateFieldKeys: readonly TemplateFieldKey[];
}

export const GUIDED_STEP_SEQUENCE: readonly GuidedStepId[] = [
  GUIDED_STEP_IDS.concept,
  GUIDED_STEP_IDS.appearance,
  GUIDED_STEP_IDS.personality,
  GUIDED_STEP_IDS.scenario,
  GUIDED_STEP_IDS.voice,
  GUIDED_STEP_IDS.metadata,
  GUIDED_STEP_IDS.review,
];

export const GUIDED_STEP_DEFINITIONS = {
  [GUIDED_STEP_IDS.concept]: {
    id: GUIDED_STEP_IDS.concept,
    title: 'Concept',
    userPrompt: 'Who is this character, in one or two sentences?',
    agentInstructions:
      'Capture the character premise, archetype, traits, flaws, name candidates, and useful tags. Record a concept and propose only a name or tags when the answer supports them.',
    allowedFieldKeys: [CHARACTER_EDIT_FIELD_KEYS.name, CHARACTER_EDIT_FIELD_KEYS.tags],
    isImageStepAllowed: false,
    isSkippable: false,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.description, TEMPLATE_FIELD_KEYS.personality],
  },
  [GUIDED_STEP_IDS.appearance]: {
    id: GUIDED_STEP_IDS.appearance,
    title: 'Appearance',
    userPrompt: 'What should this character look like? You can describe them or attach a reference image.',
    agentInstructions:
      'Shape a vivid, usable physical description from the user answer and any image-analysis evidence. Keep uncertainty visible and avoid inventing details that are not supported.',
    allowedFieldKeys: [CHARACTER_EDIT_FIELD_KEYS.description],
    isImageStepAllowed: true,
    isSkippable: false,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.description],
  },
  [GUIDED_STEP_IDS.personality]: {
    id: GUIDED_STEP_IDS.personality,
    title: 'Personality',
    userPrompt: 'How does this character think, feel, and behave?',
    agentInstructions:
      "Turn the user's answer into coherent personality traits, motivations, habits, and contradictions. Keep the appearance description intact unless a small consistency adjustment is necessary.",
    allowedFieldKeys: [CHARACTER_EDIT_FIELD_KEYS.personality, CHARACTER_EDIT_FIELD_KEYS.description],
    isImageStepAllowed: false,
    isSkippable: false,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.personality, TEMPLATE_FIELD_KEYS.description],
  },
  [GUIDED_STEP_IDS.scenario]: {
    id: GUIDED_STEP_IDS.scenario,
    title: 'Scenario',
    userPrompt: 'Where does the story begin, and what situation brings the character into focus?',
    agentInstructions:
      'Define the immediate setting, relationship, stakes, and roleplay premise. Keep the scenario actionable for a first interaction.',
    allowedFieldKeys: [CHARACTER_EDIT_FIELD_KEYS.scenario],
    isImageStepAllowed: false,
    isSkippable: false,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.scenario],
  },
  [GUIDED_STEP_IDS.voice]: {
    id: GUIDED_STEP_IDS.voice,
    title: 'Voice & Dialogue',
    userPrompt: 'How should this character speak? Give a tone, mannerism, or sample line.',
    agentInstructions:
      'Establish a distinct speaking style, then write a first message and example dialogue that demonstrate it. Preserve roleplay macros such as {{char}} and {{user}}.',
    allowedFieldKeys: [
      CHARACTER_EDIT_FIELD_KEYS.first_mes,
      CHARACTER_EDIT_FIELD_KEYS.mes_example,
      CHARACTER_EDIT_FIELD_KEYS.alternate_greetings,
    ],
    isImageStepAllowed: false,
    isSkippable: false,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.first_mes, TEMPLATE_FIELD_KEYS.mes_example],
  },
  [GUIDED_STEP_IDS.metadata]: {
    id: GUIDED_STEP_IDS.metadata,
    title: 'Metadata & Extras',
    userPrompt: 'Would you like to add tags, creator notes, custom fields, or a small lorebook?',
    agentInstructions:
      'Add only the metadata and optional supporting structures the user asks for. This step may be skipped without blocking the review.',
    allowedFieldKeys: [
      CHARACTER_EDIT_FIELD_KEYS.tags,
      CHARACTER_EDIT_FIELD_KEYS.creator_notes,
      CHARACTER_EDIT_FIELD_KEYS.custom_fields,
      CHARACTER_EDIT_FIELD_KEYS.character_book,
    ],
    isImageStepAllowed: false,
    isSkippable: true,
    suggestedTemplateFieldKeys: [TEMPLATE_FIELD_KEYS.creator_notes, TEMPLATE_FIELD_KEYS.custom_field],
  },
  [GUIDED_STEP_IDS.review]: {
    id: GUIDED_STEP_IDS.review,
    title: 'Review',
    userPrompt: 'Do a final coherence pass across the character card.',
    agentInstructions:
      "Check the complete card for contradictions, missing essentials, and an unclear roleplay hook. Propose only focused fixes that improve coherence and preserve the user's intent.",
    allowedFieldKeys: Object.values(CHARACTER_EDIT_FIELD_KEYS),
    isImageStepAllowed: false,
    isSkippable: false,
    suggestedTemplateFieldKeys: [],
  },
} satisfies Record<GuidedStepId, iGuidedStepDefinition>;

export function getNextGuidedStepId(stepId: GuidedStepId): GuidedStepId | null {
  const stepIndex = GUIDED_STEP_SEQUENCE.indexOf(stepId);
  return stepIndex >= 0 ? (GUIDED_STEP_SEQUENCE[stepIndex + 1] ?? null) : null;
}
