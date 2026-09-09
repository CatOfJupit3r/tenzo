import { describe, expect, it } from 'vitest';

import { EDITOR_MARK_TYPES, EDITOR_NODE_TYPES } from '@~/features/character-creator/lib/editor/editor-enums';

import { serializeChatInput } from './chat-input-serialization';

describe('chat input serialization', () => {
  it('renders mentions and collects template ids in document order', () => {
    expect(
      serializeChatInput({
        type: EDITOR_NODE_TYPES.DOC,
        content: [
          {
            type: EDITOR_NODE_TYPES.PARAGRAPH,
            content: [
              { type: EDITOR_NODE_TYPES.TEXT, text: 'Use ' },
              { type: EDITOR_NODE_TYPES.MENTION, attrs: { id: 'description', label: 'description-template' } },
              { type: EDITOR_NODE_TYPES.TEXT, text: ' and ' },
              { type: EDITOR_NODE_TYPES.MENTION, attrs: { id: 'voice', label: 'voice-template' } },
              { type: EDITOR_NODE_TYPES.MENTION, attrs: { id: 'description', label: 'description-template' } },
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
        type: EDITOR_NODE_TYPES.DOC,
        content: [
          {
            type: EDITOR_NODE_TYPES.PARAGRAPH,
            content: Array.from({ length: 5 }, (_, index) => ({
              type: EDITOR_NODE_TYPES.MENTION,
              attrs: { id: `template-${index}`, label: `template-${index}` },
            })),
          },
        ],
      }).templateIds,
    ).toEqual(['template-0', 'template-1', 'template-2', 'template-3']);
  });

  it('serializes supported text styles as markdown for the assistant', () => {
    expect(
      serializeChatInput({
        type: EDITOR_NODE_TYPES.DOC,
        content: [
          {
            type: EDITOR_NODE_TYPES.PARAGRAPH,
            content: [
              { type: EDITOR_NODE_TYPES.TEXT, text: EDITOR_MARK_TYPES.BOLD, marks: [{ type: EDITOR_MARK_TYPES.BOLD }] },
              { type: EDITOR_NODE_TYPES.TEXT, text: ' italic', marks: [{ type: EDITOR_MARK_TYPES.ITALIC }] },
              { type: EDITOR_NODE_TYPES.TEXT, text: ' gone', marks: [{ type: EDITOR_MARK_TYPES.STRIKE }] },
            ],
          },
        ],
      }).text,
    ).toBe('**bold*** italic*~~ gone~~');
  });
});
