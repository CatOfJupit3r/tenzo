import { em } from 'enumwaii';

export const STREAM_MESSAGE_ROLE_ENUM = em({
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
});
export const STREAM_MESSAGE_ROLES = STREAM_MESSAGE_ROLE_ENUM.enum;
export const MESSAGE_ROLE_ENUM = STREAM_MESSAGE_ROLE_ENUM.omit([STREAM_MESSAGE_ROLES.TOOL]);
export const MESSAGE_ROLES = MESSAGE_ROLE_ENUM.enum;
export const MESSAGE_ROLE_CASES = MESSAGE_ROLE_ENUM.cases;
export type MessageRole = (typeof MESSAGE_ROLE_ENUM)['~type'];

export const STREAM_TOOL_STATE_ENUM = em({
  OUTPUT_AVAILABLE: 'output-available',
});
export const STREAM_TOOL_STATES = STREAM_TOOL_STATE_ENUM.enum;

export const MESSAGE_PART_TYPE_ENUM = em({
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
  TOOL_CALL: 'tool-call',
  TOOL_RESULT: 'tool-result',
  THINKING: 'thinking',
  STRUCTURED_OUTPUT: 'structured-output',
  UI_RESOURCE: 'ui-resource',
});
export const MESSAGE_PART_TYPES_CASES = MESSAGE_PART_TYPE_ENUM.cases;

export const CONTENT_SOURCE_TYPE_ENUM = em({
  DATA: 'data',
  URL: 'url',
});
export const CONTENT_SOURCE_TYPES_CASES = CONTENT_SOURCE_TYPE_ENUM.cases;

export const TOOL_CALL_STATE_ENUM = em({
  AWAITING_INPUT: 'awaiting-input',
  INPUT_STREAMING: 'input-streaming',
  INPUT_COMPLETE: 'input-complete',
  APPROVAL_REQUESTED: 'approval-requested',
  APPROVAL_RESPONDED: 'approval-responded',
  COMPLETE: 'complete',
  ERROR: 'error',
});
export const TOOL_CALL_STATES = TOOL_CALL_STATE_ENUM.enum;

export const MESSAGE_PART_STATUS_ENUM = em({
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error',
});
export const MESSAGE_PART_STATUSES = MESSAGE_PART_STATUS_ENUM.enum;
