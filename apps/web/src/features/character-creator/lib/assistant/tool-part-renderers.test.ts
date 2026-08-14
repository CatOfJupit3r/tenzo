import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { ASSISTANT_TOOL_RENDERER_KINDS, getAssistantToolRendererKind } from './tool-part-renderers';

describe('assistant tool renderer registry', () => {
  it('dispatches proposal, concept, and discovery tools', () => {
    expect(getAssistantToolRendererKind(CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags)).toBe(
      ASSISTANT_TOOL_RENDERER_KINDS.proposal,
    );
    expect(getAssistantToolRendererKind(CHARACTER_ASSISTANT_TOOL_NAMES.record_concept)).toBe(
      ASSISTANT_TOOL_RENDERER_KINDS.concept,
    );
    expect(getAssistantToolRendererKind(CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions)).toBe(
      ASSISTANT_TOOL_RENDERER_KINDS.discovery,
    );
    expect(getAssistantToolRendererKind('unknown')).toBeNull();
  });
});
