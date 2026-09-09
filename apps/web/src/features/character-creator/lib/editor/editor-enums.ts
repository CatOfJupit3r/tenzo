import { em } from 'enumwaii';

export const EDITOR_CONTENT_TYPE_ENUM = em({
  JSON: 'json',
  MARKDOWN: 'markdown',
});
export const EDITOR_CONTENT_TYPES = EDITOR_CONTENT_TYPE_ENUM.enum;
export type EditorContentType = (typeof EDITOR_CONTENT_TYPE_ENUM)['~keys'];

export const REWRITE_SIDE_ENUM = em(['OLD', 'NEW']);
export const REWRITE_SIDES = REWRITE_SIDE_ENUM.enum;
export type RewriteSide = (typeof REWRITE_SIDE_ENUM)['~type'];

export const EDITOR_NODE_TYPE_ENUM = em({
  DOC: 'doc',
  PARAGRAPH: 'paragraph',
  TEXT: 'text',
  HARD_BREAK: 'hardBreak',
  MENTION: 'mention',
});
export const EDITOR_NODE_TYPES = EDITOR_NODE_TYPE_ENUM.enum;

export const EDITOR_MARK_TYPE_ENUM = em({
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKE: 'strike',
});
export const EDITOR_MARK_TYPES = EDITOR_MARK_TYPE_ENUM.enum;
