import type { ContentPart } from '@tanstack/ai';

import { generateUuid } from '@~/utils/uuid';

export const CHAT_INPUT_ATTACHMENT_KINDS = {
  image: 'image',
  text: 'text',
} as const;

export type ChatInputAttachmentKind = (typeof CHAT_INPUT_ATTACHMENT_KINDS)[keyof typeof CHAT_INPUT_ATTACHMENT_KINDS];

export interface iChatInputAttachment {
  id: string;
  kind: ChatInputAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  content: string;
}

export const CHAT_INPUT_ATTACHMENT_LIMITS = {
  count: 4,
  imageBytes: 5 * 1024 * 1024,
  textBytes: 1024 * 1024,
  totalBytes: 10 * 1024 * 1024,
} as const;

export const CHAT_INPUT_ATTACHMENT_ACCEPT = [
  'image/*',
  'text/*',
  '.json',
  '.md',
  '.csv',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
].join(',');

const TEXT_FILE_EXTENSIONS = new Set(['csv', 'json', 'md', 'toml', 'xml', 'yaml', 'yml']);

function getFileExtension(fileName: string) {
  return fileName.split('.').at(-1)?.toLocaleLowerCase() ?? '';
}

function getAttachmentKind(file: File): ChatInputAttachmentKind | null {
  if (file.type.startsWith('image/')) return CHAT_INPUT_ATTACHMENT_KINDS.image;
  if (file.type.startsWith('text/') || TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name))) {
    return CHAT_INPUT_ATTACHMENT_KINDS.text;
  }
  return null;
}

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

export async function createChatInputAttachments(files: File[], existingAttachments: iChatInputAttachment[]) {
  const availableCount = Math.max(0, CHAT_INPUT_ATTACHMENT_LIMITS.count - existingAttachments.length);
  const selectedFiles = files.slice(0, availableCount);
  const existingBytes = existingAttachments.reduce((total, attachment) => total + attachment.size, 0);
  let selectedBytes = existingBytes;
  const attachments: iChatInputAttachment[] = [];
  const errors: string[] = [];

  if (files.length > availableCount) {
    errors.push(`You can attach up to ${CHAT_INPUT_ATTACHMENT_LIMITS.count} files.`);
  }

  for (const file of selectedFiles) {
    const kind = getAttachmentKind(file);
    if (!kind) {
      errors.push(`${file.name} is not a supported image or text file.`);
      continue;
    }
    const sizeLimit =
      kind === CHAT_INPUT_ATTACHMENT_KINDS.image
        ? CHAT_INPUT_ATTACHMENT_LIMITS.imageBytes
        : CHAT_INPUT_ATTACHMENT_LIMITS.textBytes;
    if (file.size > sizeLimit) {
      errors.push(`${file.name} is too large.`);
      continue;
    }
    if (selectedBytes + file.size > CHAT_INPUT_ATTACHMENT_LIMITS.totalBytes) {
      errors.push('Attachments cannot exceed 10 MB in total.');
      continue;
    }

    let content: string;
    try {
      content = kind === CHAT_INPUT_ATTACHMENT_KINDS.image ? await readFileAsBase64(file) : await file.text();
    } catch {
      errors.push(`${file.name} could not be read.`);
      continue;
    }
    attachments.push({
      id: generateUuid(),
      kind,
      name: file.name,
      mimeType: file.type || (kind === CHAT_INPUT_ATTACHMENT_KINDS.text ? 'text/plain' : 'image/*'),
      size: file.size,
      content,
    });
    selectedBytes += file.size;
  }

  return { attachments, errors };
}

export function buildChatInputContentParts(message: string, attachments: iChatInputAttachment[]): ContentPart[] {
  const parts: ContentPart[] = [{ type: 'text', content: message }];

  attachments.forEach((attachment) => {
    const attachmentMetadata = {
      attachment: {
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
      },
    };
    if (attachment.kind === CHAT_INPUT_ATTACHMENT_KINDS.image) {
      parts.push({
        type: 'text',
        content: `Attached image: ${attachment.name}`,
      });
      parts.push({
        type: 'image',
        source: { type: 'data', value: attachment.content, mimeType: attachment.mimeType },
        metadata: attachmentMetadata,
      });
      return;
    }

    parts.push({
      type: 'text',
      content: [
        `Attached file: ${attachment.name}`,
        '<attachment-content>',
        attachment.content,
        '</attachment-content>',
      ].join('\n'),
      metadata: attachmentMetadata,
    });
  });

  return parts;
}

export function readChatAttachmentMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || !('attachment' in metadata)) return null;
  const { attachment } = metadata as { attachment?: unknown };
  if (!attachment || typeof attachment !== 'object') return null;
  const candidate = attachment as { name?: unknown; mimeType?: unknown; size?: unknown };
  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.mimeType !== 'string' ||
    typeof candidate.size !== 'number'
  ) {
    return null;
  }
  return candidate as { name: string; mimeType: string; size: number };
}
