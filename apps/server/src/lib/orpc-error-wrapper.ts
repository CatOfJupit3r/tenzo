import { ORPCError } from '@orpc/server';

import { errorMessages } from '@startername/shared/enums/errors.enums';
import type { ErrorCodesType } from '@startername/shared/enums/errors.enums';

export function createErrorPayload(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return {
    code,
    message: errorMessages[code],
    ...additionalData,
  };
}

export function ORPCNotFoundError(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('NOT_FOUND', createErrorPayload(code, additionalData));
}

export function ORPCBadRequestError(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('BAD_REQUEST', createErrorPayload(code, additionalData));
}

export function ORPCForbiddenError(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('FORBIDDEN', createErrorPayload(code, additionalData));
}

export function ORPCUnprocessableContentError(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('UNPROCESSABLE_CONTENT', createErrorPayload(code, additionalData));
}

export function ORPCInternalServerError(code?: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('INTERNAL_SERVER_ERROR', code ? createErrorPayload(code, additionalData) : undefined);
}

export function ORPCUnauthorizedError(code: ErrorCodesType, additionalData?: Record<string, unknown>) {
  return new ORPCError('UNAUTHORIZED', createErrorPayload(code, additionalData));
}
