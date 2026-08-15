import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCharacterAssistantMessagePersistence } from './message-persistence';

const mocks = vi.hoisted(() => ({
  ensure: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../collections/character-assistant-sessions.collection', () => ({
  ensureCharacterAssistantSession: mocks.ensure,
  removeCharacterAssistantSession: mocks.remove,
  updateCharacterAssistantSession: mocks.update,
}));

describe('character assistant message persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensure.mockResolvedValue({
      id: 'character-1',
      messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', content: 'Hello' }] }],
    });
    mocks.update.mockImplementation(async (_id, recipe) => {
      const draft = { messages: [] };
      recipe(draft);
      return draft;
    });
  });

  it('round-trips UI messages through the session collection adapter', async () => {
    const adapter = createCharacterAssistantMessagePersistence('session-1', 'character-1');
    await expect(adapter.getItem('character-1')).resolves.toEqual({
      messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', content: 'Hello' }] }],
    });
    const messages = [
      { id: 'assistant-1', role: 'assistant' as const, parts: [{ type: 'text' as const, content: 'Hi' }] },
    ];
    await adapter.setItem('character-1', { messages });
    expect(mocks.ensure).toHaveBeenCalledWith('session-1', 'character-1');
    expect(mocks.update).toHaveBeenCalledOnce();
    const recipe = mocks.update.mock.calls[0]?.[1];
    const draft = { messages: [] as typeof messages };
    recipe(draft);
    expect(draft.messages).toEqual(messages);
  });
});
