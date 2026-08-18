import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { CHARACTER_ASSISTANT_TOOL_OUTCOMES, logCharacterAssistantTool } from './character-assistant-tool-observability';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('character assistant tool observability', () => {
  it('logs structural proposal diagnostics without generated values', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logCharacterAssistantTool({
      mode: 'structured-output',
      model: 'test-model',
      outcome: CHARACTER_ASSISTANT_TOOL_OUTCOMES['no-op'],
      runId: 'run-1',
      toolCallId: 'tool-1',
      toolName: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      input: {
        changes: [{ fieldKey: 'description', value: 'private generated description' }],
        summary: 'private summary',
      },
    });

    expect(info).toHaveBeenCalledWith(
      '[Character Assistant] Tool execution',
      expect.objectContaining({
        outcome: CHARACTER_ASSISTANT_TOOL_OUTCOMES['no-op'],
        inputKeys: ['changes', 'summary'],
        requestedFieldKeys: ['description'],
        itemCount: 1,
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('private generated description');
    expect(JSON.stringify(info.mock.calls)).not.toContain('private summary');
  });
});
