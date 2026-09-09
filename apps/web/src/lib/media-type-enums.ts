import { em } from 'enumwaii';

export const MEDIA_TYPE_ENUM = em({
  JSON: 'application/json',
  OCTET_STREAM: 'application/octet-stream',
  ZIP: 'application/zip',
  GZIP: 'application/gzip',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  GIF: 'image/gif',
  SVG: 'image/svg+xml',
  PLAIN_TEXT: 'text/plain',
});
export const MEDIA_TYPES = MEDIA_TYPE_ENUM.enum;
