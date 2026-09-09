import { em } from 'enumwaii';

export const GENERATION_ABORT_CODE_ENUM = em({
  ABORTED: 'aborted',
});
export const GENERATION_ABORT_CODES_CASES = GENERATION_ABORT_CODE_ENUM.cases;

export const ABORT_ERROR_NAME_ENUM = em({
  ABORT_ERROR: 'AbortError',
  REQUEST_ABORTED_ERROR: 'RequestAbortedError',
});
export const ABORT_ERROR_NAMES = ABORT_ERROR_NAME_ENUM.enum;
