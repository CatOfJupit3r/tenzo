import { TEMPLATE_FIELD_KEYS, TEMPLATE_MODES } from '../lib/cards/field-templates';
import type { iFieldTemplateViewModel } from '../lib/cards/field-templates';

export const BUILT_IN_FIELD_TEMPLATE_ID_PREFIX = 'built-in:';

const BUILT_IN_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const BUILT_IN_FIELD_TEMPLATES: readonly iFieldTemplateViewModel[] = [
  {
    id: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}structured-description`,
    name: 'Structured Description',
    description: 'A sectioned description skeleton covering identity, appearance, background, and dynamics.',
    mode: TEMPLATE_MODES.strict,
    fieldKeys: [TEMPLATE_FIELD_KEYS.description],
    content: `# {{char}}
**Identity:** {{gen:identity:one line summing up who the character is}}
**Appearance:** {{gen:appearance:physical build, face, hair, clothing, distinguishing marks}}
**Background:** {{gen:background:formative history in 2-4 sentences}}
**Speech:** {{gen:speech:voice, vocabulary, verbal tics}}
**Relationship to {{user}}:** {{gen:relationship:how the character regards and treats the user}}`,
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    isBuiltIn: true,
  },
  {
    id: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}trait-list-personality`,
    name: 'Trait List Personality',
    description: 'A compact trait-plus-evidence list instead of prose narration.',
    mode: TEMPLATE_MODES.prompt,
    fieldKeys: [TEMPLATE_FIELD_KEYS.personality],
    content: `Personality(
  core traits: trait1, trait2, trait3, trait4;
  likes: like1, like2, like3;
  dislikes: dislike1, dislike2;
  quirks: quirk1, quirk2;
  fears: fear1;
)
Each trait should be a single word or short phrase. Keep the whole block under 80 tokens.`,
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    isBuiltIn: true,
  },
  {
    id: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}scene-opening-greeting`,
    name: 'Scene-Setting Greeting',
    description: 'A first message that opens on atmosphere, then action, then a hook line to {{user}}.',
    mode: TEMPLATE_MODES.prompt,
    fieldKeys: [TEMPLATE_FIELD_KEYS.first_mes, TEMPLATE_FIELD_KEYS.alternate_greeting],
    content: `Open with one short paragraph of *narrated atmosphere* grounding the scene.
Follow with one paragraph of *{{char}}'s action or reaction* as {{user}} arrives or is noticed.
End with a single line of spoken dialogue from {{char}} that invites {{user}} to respond.
Keep the whole greeting under three paragraphs.`,
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    isBuiltIn: true,
  },
  {
    id: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}keyed-scenario`,
    name: 'Keyed Scenario',
    description: 'A setting-and-situation outline organized around the details that shape the roleplay premise.',
    mode: TEMPLATE_MODES.prompt,
    fieldKeys: [TEMPLATE_FIELD_KEYS.scenario],
    content: `Setting: location and immediate surroundings.
Time: when this takes place and any relevant time pressure.
Circumstances: the situation that has brought {{char}} and {{user}} together.
Stakes: what matters to the characters in this situation.
Constraint: describe what has not happened yet; do not narrate the outcome or future events.`,
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    isBuiltIn: true,
  },
  {
    id: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}start-block-dialogue`,
    name: 'Start-Block Dialogue',
    description: 'A SillyTavern example-dialogue exchange with explicit START and speaker turns.',
    mode: TEMPLATE_MODES.strict,
    fieldKeys: [TEMPLATE_FIELD_KEYS.mes_example],
    content: `<START>
{{char}}: {{gen:char_turn:an in-character opening turn with action or dialogue}}
{{user}}: {{gen:user_turn:a natural user response for the exchange}}
{{char}}: {{gen:char_followup:an in-character response that demonstrates the character's voice}}`,
    createdAt: BUILT_IN_TIMESTAMP,
    updatedAt: BUILT_IN_TIMESTAMP,
    isBuiltIn: true,
  },
];

export const DEFAULT_FIELD_TEMPLATE_IDS = {
  [`field:${TEMPLATE_FIELD_KEYS.description}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}structured-description`,
  [`field:${TEMPLATE_FIELD_KEYS.personality}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}trait-list-personality`,
  [`field:${TEMPLATE_FIELD_KEYS.scenario}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}keyed-scenario`,
  [`field:${TEMPLATE_FIELD_KEYS.first_mes}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}scene-opening-greeting`,
  [`field:${TEMPLATE_FIELD_KEYS.mes_example}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}start-block-dialogue`,
  [`field:${TEMPLATE_FIELD_KEYS.alternate_greeting}`]: `${BUILT_IN_FIELD_TEMPLATE_ID_PREFIX}scene-opening-greeting`,
} satisfies Record<string, string>;
