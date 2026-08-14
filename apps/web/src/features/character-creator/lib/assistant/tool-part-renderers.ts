import { CHARACTER_ASSISTANT_TOOL_NAMES } from '../character-assistant-contracts';
import type { CharacterAssistantToolName } from '../character-assistant-contracts';

export const ASSISTANT_TOOL_RENDERER_KINDS = {
  concept: 'concept',
  discovery: 'discovery',
  proposal: 'proposal',
} as const;

const TOOL_RENDERER_REGISTRY = {
  [CHARACTER_ASSISTANT_TOOL_NAMES.record_concept]: ASSISTANT_TOOL_RENDERER_KINDS.concept,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: ASSISTANT_TOOL_RENDERER_KINDS.proposal,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: ASSISTANT_TOOL_RENDERER_KINDS.proposal,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: ASSISTANT_TOOL_RENDERER_KINDS.proposal,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: ASSISTANT_TOOL_RENDERER_KINDS.proposal,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: ASSISTANT_TOOL_RENDERER_KINDS.proposal,
  [CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions]: ASSISTANT_TOOL_RENDERER_KINDS.discovery,
} satisfies Partial<
  Record<CharacterAssistantToolName, (typeof ASSISTANT_TOOL_RENDERER_KINDS)[keyof typeof ASSISTANT_TOOL_RENDERER_KINDS]>
>;

export function getAssistantToolRendererKind(toolName: string) {
  return TOOL_RENDERER_REGISTRY[toolName as keyof typeof TOOL_RENDERER_REGISTRY] ?? null;
}
