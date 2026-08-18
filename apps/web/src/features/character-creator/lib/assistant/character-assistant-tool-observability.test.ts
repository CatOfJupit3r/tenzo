import { describe, expect, it } from 'vitest';

import { serializeError } from '@~/lib/logging/log-sanitizer';
import type { iLogger } from '@~/lib/logging/logging-contracts';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { CHARACTER_ASSISTANT_TOOL_OUTCOMES, logCharacterAssistantTool } from './character-assistant-tool-observability';

function createCapturingLogger() {
  const logs: Array<{
    level: 'info' | 'error';
    message: string;
    error?: ReturnType<typeof serializeError>;
    context?: Record<string, unknown>;
  }> = [];
  const logger: iLogger = {
    debug: () => undefined,
    info: (message, context) => logs.push({ level: 'info', message, context }),
    warn: () => undefined,
    error: (message, error, context) => logs.push({ level: 'error', message, error: serializeError(error), context }),
    fatal: () => undefined,
    child: () => logger,
  };
  return { logger, logs };
}

describe('character assistant tool observability', () => {
  it('logs structural proposal diagnostics without generated values', () => {
    const { logger, logs } = createCapturingLogger();

    logCharacterAssistantTool(
      {
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
      },
      logger,
    );

    expect(logs).toEqual([
      {
        level: 'info',
        message: 'Tool execution',
        context: expect.objectContaining({
          outcome: CHARACTER_ASSISTANT_TOOL_OUTCOMES['no-op'],
          inputKeys: ['changes', 'summary'],
          requestedFieldKeys: ['description'],
          itemCount: 1,
        }),
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('private generated description');
    expect(JSON.stringify(logs)).not.toContain('private summary');
  });
});
