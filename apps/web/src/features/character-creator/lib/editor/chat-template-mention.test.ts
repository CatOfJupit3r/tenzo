import { describe, expect, it } from 'vitest';

import { parseChatTemplateMentionReference } from './chat-template-mention';

describe('parseChatTemplateMentionReference', () => {
  it('returns the metadata required for a template click', () => {
    expect(parseChatTemplateMentionReference({ id: 'voice-template', label: 'Voice template' })).toEqual({
      id: 'voice-template',
      label: 'Voice template',
    });
  });

  it('rejects incomplete mention metadata', () => {
    expect(parseChatTemplateMentionReference({ id: 'voice-template' })).toBeNull();
    expect(parseChatTemplateMentionReference({ id: 42, label: 'Voice template' })).toBeNull();
  });
});
