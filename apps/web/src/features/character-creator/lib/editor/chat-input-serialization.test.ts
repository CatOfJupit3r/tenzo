import { describe, expect, it } from 'vitest';

import { serializeChatInput } from './chat-input-serialization';

describe('chat input serialization', () => {
  it('renders mentions and collects template ids in document order', () => {
    expect(
      serializeChatInput({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Use ' },
              { type: 'mention', attrs: { id: 'description', label: 'description-template' } },
              { type: 'text', text: ' and ' },
              { type: 'mention', attrs: { id: 'voice', label: 'voice-template' } },
              { type: 'mention', attrs: { id: 'description', label: 'description-template' } },
            ],
          },
        ],
      }),
    ).toEqual({
      text: 'Use /description-template and /voice-template/description-template',
      templateIds: ['description', 'voice'],
    });
  });

  it('caps references at four unique templates', () => {
    expect(
      serializeChatInput({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: Array.from({ length: 5 }, (_, index) => ({
              type: 'mention',
              attrs: { id: `template-${index}`, label: `template-${index}` },
            })),
          },
        ],
      }).templateIds,
    ).toEqual(['template-0', 'template-1', 'template-2', 'template-3']);
  });
});
