import { describe, expect, it } from 'vitest';

import {
  CHAT_INPUT_ATTACHMENT_KINDS,
  buildChatInputContentParts,
  createChatInputAttachments,
} from './chat-input-attachments';

describe('chat input attachments', () => {
  it('reads text files and includes their contents in the model message', async () => {
    const file = new File(['character notes'], 'notes.md', { type: 'text/markdown' });
    Object.defineProperty(file, 'text', { value: async () => 'character notes' });
    const [attachment] = (await createChatInputAttachments([file], [])).attachments;

    expect(attachment).toMatchObject({ kind: CHAT_INPUT_ATTACHMENT_KINDS.text, name: 'notes.md' });
    expect(buildChatInputContentParts('Use these notes', attachment ? [attachment] : [])).toEqual([
      { type: 'text', content: 'Use these notes' },
      {
        type: 'text',
        content: 'Attached file: notes.md\n<attachment-content>\ncharacter notes\n</attachment-content>',
        metadata: {
          attachment: { name: 'notes.md', mimeType: 'text/markdown', size: 15 },
        },
      },
    ]);
  });

  it('rejects unsupported binary files', async () => {
    const result = await createChatInputAttachments(
      [new File(['binary'], 'archive.zip', { type: 'application/zip' })],
      [],
    );

    expect(result.attachments).toEqual([]);
    expect(result.errors).toEqual(['archive.zip is not a supported image or text file.']);
  });
});
