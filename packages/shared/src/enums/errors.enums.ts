const userErrors = {
  USER_NOT_FOUND: 'User not found',
  USER_PROFILE_NOT_FOUND: 'User profile not found',
  USER_BADGE_NOT_ALLOWED: 'You do not have the required achievement to use this badge',
  BADGE_NOT_FOUND: 'Badge not found',
  INVALID_PUBLIC_CODE: 'Invalid public code',
  PUBLIC_CODE_GENERATION_FAILED: 'Failed to generate unique public code',
} as const;

const allErrors = {
  ...userErrors,
} as const;

export const errorCodes = Object.fromEntries(Object.keys(allErrors).map((key) => [key, key])) as {
  [K in keyof typeof allErrors]: K;
};

export type ErrorCodesType = keyof typeof allErrors;

export const errorMessages: Record<ErrorCodesType, string> = allErrors;
