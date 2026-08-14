import { describe, expect, it } from 'vitest';

import { CHARACTER_VISION_REQUEST_SCHEMA } from './character-vision-contracts';

const validRequest = {
  endpoint: 'http://localhost:1234',
  apiKey: 'key',
  model: 'vision-model',
  maxTokens: 300,
  temperature: 0.5,
  imageDataUrl: 'data:image/png;base64,aGVsbG8=',
};

describe('character vision contracts', () => {
  it('accepts supported image data URLs', () => {
    expect(CHARACTER_VISION_REQUEST_SCHEMA.safeParse(validRequest).success).toBe(true);
  });

  it('rejects non-image data URLs and oversized payloads', () => {
    expect(
      CHARACTER_VISION_REQUEST_SCHEMA.safeParse({ ...validRequest, imageDataUrl: 'data:text/plain;base64,aGVsbG8=' })
        .success,
    ).toBe(false);
    expect(
      CHARACTER_VISION_REQUEST_SCHEMA.safeParse({
        ...validRequest,
        imageDataUrl: `data:image/png;base64,${'a'.repeat(3_000_000)}`,
      }).success,
    ).toBe(false);
  });
});
