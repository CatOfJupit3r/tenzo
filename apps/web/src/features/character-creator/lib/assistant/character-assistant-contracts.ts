import { em } from 'enumwaii';
import { z } from 'zod';

import { CHARACTER_CARD_SCHEMA } from '../cards/card-schema';
import { MAX_EXAMPLE_CHARACTER_COUNT } from '../cards/example-characters';
import { STORED_FIELD_TEMPLATE_SCHEMA } from '../cards/field-templates';
import {
  CHARACTER_ASSISTANT_FIELD_EDITING_SCHEMA,
  DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
} from '../generation/generation-config';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '../generation/generation-stream-contracts';
import { FIELD_WRITING_STRATEGIES, FIELD_WRITING_STRATEGY_SCHEMA } from '../orchestration/field-writing-strategy';
import { PROMPT_EXAMPLE_CHARACTER_SCHEMA } from '../prompt/generation-contracts';
import { CHARACTER_EDIT_FIELD_KEY_SCHEMA } from '../proposals/character-edit-proposal';
import { AGENT_GENERATION_BUDGET_SCHEMA, AGENT_GENERATION_BUDGETS } from '../provider/agent-generation-budget';
import { MODEL_CAPABILITY_SCHEMA } from '../provider/model-capabilities';
import { PROVIDER_KIND_SCHEMA, PROVIDER_KINDS } from '../provider/provider-health';

export const CHARACTER_ASSISTANT_FOCUS_KIND_ENUM = em({
  CARD: 'card',
  FIELD: 'field',
  FIELDS: 'fields',
});
export const CHARACTER_ASSISTANT_FOCUS_KIND_MEMBERS = CHARACTER_ASSISTANT_FOCUS_KIND_ENUM.enum;
export const CHARACTER_ASSISTANT_FOCUS_KIND_SCHEMA = z.enum(CHARACTER_ASSISTANT_FOCUS_KIND_MEMBERS);
export const CHARACTER_ASSISTANT_FOCUS_KINDS_CASES = CHARACTER_ASSISTANT_FOCUS_KIND_ENUM.cases;

export const CHARACTER_ASSISTANT_FOCUS_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.CARD),
  }),
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.FIELD),
    fieldKey: CHARACTER_EDIT_FIELD_KEY_SCHEMA,
  }),
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS_CASES.FIELDS),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA).min(1),
  }),
]);

export const CHARACTER_ASSISTANT_ATTACHMENT_KINDS_ENUM = em({
  IMAGE_ANALYSIS: 'image-analysis',
});
export const CHARACTER_ASSISTANT_ATTACHMENT_KINDS = CHARACTER_ASSISTANT_ATTACHMENT_KINDS_ENUM.enum;

export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA = z.string().trim().min(1);

export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA = z.object({
  id: z.string().trim().min(1),
  kind: CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA,
  title: z.string().trim().min(1),
  content: z.string().trim().min(1).max(12_000),
  warnings: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1).nullable(),
});

export const CHARACTER_ASSISTANT_TOOL_NAME_ENUM = em({
  READ_CHARACTER: 'read_character',
  RECORD_CONCEPT: 'record_concept',
  PROPOSE_CHARACTER_FIELDS: 'propose_character_fields',
  PROPOSE_TAGS: 'propose_tags',
  PROPOSE_ALTERNATE_GREETINGS: 'propose_alternate_greetings',
  PROPOSE_CUSTOM_FIELDS: 'propose_custom_fields',
  PROPOSE_CHARACTER_BOOK: 'propose_character_book',
  SUGGEST_CHARACTER_DIRECTIONS: 'suggest_character_directions',
});
export const CHARACTER_ASSISTANT_TOOL_NAMES = CHARACTER_ASSISTANT_TOOL_NAME_ENUM.enum;
export const CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA = z.enum(CHARACTER_ASSISTANT_TOOL_NAMES);

export const CHARACTER_CONCEPT_SCHEMA = z.object({
  premise: z.string().trim().default(''),
  archetype: z.string().default(''),
  keyTraits: z.array(z.string()).default([]),
  flaws: z.array(z.string()).default([]),
  nameCandidates: z.array(z.string()).default([]),
  suggestedTags: z.array(z.string()).default([]),
});

export const MAX_CHAT_TEMPLATE_REF_COUNT = 4;

export const CHAT_TEMPLATE_REF_SCHEMA = STORED_FIELD_TEMPLATE_SCHEMA.pick({
  id: true,
  name: true,
  mode: true,
  fieldKeys: true,
  content: true,
});

export type iCharacterConcept = z.infer<typeof CHARACTER_CONCEPT_SCHEMA>;
export type iChatTemplateRef = z.infer<typeof CHAT_TEMPLATE_REF_SCHEMA>;

export const CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_ENUM = em({
  CHARACTER_CONCEPT: 'character-concept',
  RELATIONSHIP_DYNAMIC: 'relationship-dynamic',
  SCENARIO: 'scenario',
  TONE: 'tone',
});
export const CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES =
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_ENUM.enum;
export const CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA = z.enum(
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES,
);

export const CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA = z.object({
  id: z.string().trim().min(1),
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  sourceCardId: z.string().trim().min(1).nullable(),
  isUserAuthored: z.boolean(),
});

export const CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_ORIGINAL_PREMISE_MAX_LENGTH = 600;
export const CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_TITLE_MAX_LENGTH = 80;
export const CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_DESCRIPTION_MAX_LENGTH = 320;

export const CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA = z.object({
  id: z.string().trim().min(1).max(120),
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  title: z.string().trim().min(1).max(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1).max(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_DESCRIPTION_MAX_LENGTH),
  sourceCardId: z.string().trim().min(1).max(120).nullable(),
  isUserAuthored: z.boolean(),
});

export const CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_SCHEMA = z.object({
  originalPremise: z.string().trim().max(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_ORIGINAL_PREMISE_MAX_LENGTH),
  handoffSummary: z
    .object({
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.CHARACTER_CONCEPT]: z
        .array(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA)
        .max(3),
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.RELATIONSHIP_DYNAMIC]: z
        .array(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA)
        .max(3),
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.SCENARIO]: z
        .array(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA)
        .max(3),
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.TONE]: z
        .array(CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA)
        .max(3),
    })
    .default({
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.CHARACTER_CONCEPT]: [],
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.RELATIONSHIP_DYNAMIC]: [],
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.SCENARIO]: [],
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.TONE]: [],
    }),
});

const CHARACTER_ASSISTANT_GENERATION_SETTINGS_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
});

export const CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA = CHARACTER_ASSISTANT_GENERATION_SETTINGS_SCHEMA.extend({
  characterId: z.string().trim().min(1),
  card: CHARACTER_CARD_SCHEMA,
  focus: CHARACTER_ASSISTANT_FOCUS_SCHEMA,
  messages: z.array(z.unknown()).min(1),
  globalCharacterInstruction: z.string().optional(),
  generalCharacterIdea: z.string().optional(),
  contextAttachments: z.array(CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA).max(8).optional().default([]),
  discoveryContext: CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_SCHEMA.optional(),
  templates: z.array(CHAT_TEMPLATE_REF_SCHEMA).max(MAX_CHAT_TEMPLATE_REF_COUNT).optional().default([]),
  exampleCharacters: z.array(PROMPT_EXAMPLE_CHARACTER_SCHEMA).max(MAX_EXAMPLE_CHARACTER_COUNT).optional().default([]),
  maxExampleContextCharacters: z.number().int().positive().optional(),
  providerKind: PROVIDER_KIND_SCHEMA.optional().default(PROVIDER_KINDS.UNKNOWN),
  agentGenerationBudget: AGENT_GENERATION_BUDGET_SCHEMA.optional().default(AGENT_GENERATION_BUDGETS.BALANCED),
  fieldWritingStrategy: FIELD_WRITING_STRATEGY_SCHEMA.optional().default(FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS),
  localCapabilities: z.array(MODEL_CAPABILITY_SCHEMA).optional().default([]),
  fieldShouldAllowAssistantEditing: CHARACTER_ASSISTANT_FIELD_EDITING_SCHEMA.optional().default(
    DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
  ),
});

export type CharacterAssistantFocus = z.infer<typeof CHARACTER_ASSISTANT_FOCUS_SCHEMA>;
export type CharacterAssistantToolName = z.infer<typeof CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA>;
export type iCharacterAssistantContextAttachment = z.infer<typeof CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA>;
export type iCharacterAssistantGenerationSettings = Pick<
  iCharacterAssistantStreamRequest,
  | 'endpoint'
  | 'model'
  | 'openRouterProvider'
  | 'maxTokens'
  | 'temperature'
  | 'topP'
  | 'frequencyPenalty'
  | 'presencePenalty'
  | 'topK'
  | 'minP'
>;
export type iCharacterAssistantConcept = z.infer<typeof CHARACTER_CONCEPT_SCHEMA>;
export type iCharacterAssistantStreamRequest = z.infer<typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA>;
export type iCharacterAssistantDiscoveryDirectionCategory = z.infer<
  typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA
>;
export type iCharacterAssistantDiscoveryDirectionCard = z.infer<
  typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA
>;
export type iCharacterAssistantDiscoveryContextCard = z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_CARD_SCHEMA>;
export type iCharacterAssistantDiscoveryContext = z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_CONTEXT_SCHEMA>;
