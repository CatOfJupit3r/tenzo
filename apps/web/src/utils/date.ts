import { format } from 'date-fns';

export type DateInput = Date | string | number;

// Date format patterns
export const DATE_FORMATS = {
  // Short date format (e.g., "11/23/2025")
  SHORT: 'P',
  // Long date format (e.g., "November 23, 2025")
  LONG: 'MMMM d, yyyy',
  // Medium date format with year and month (e.g., "Nov 2025")
  YEAR_MONTH: 'MMM yyyy',
  // ISO date format (e.g., "2025-11-23")
  ISO: 'yyyy-MM-dd',
  // Full date with day of week (e.g., "Friday, November 23, 2025")
  FULL: 'EEEE, MMMM d, yyyy',
} as const;

export type DateFormat = keyof typeof DATE_FORMATS;

/**
 * Format a date with a custom pattern
 * @param input Date, string, or timestamp
 * @param pattern date-fns format pattern (default: 'P')
 * @returns Formatted date string
 */
export function formatDate(input: DateInput, pattern = 'P') {
  const date = input instanceof Date ? input : new Date(input);
  return format(date, pattern);
}

/**
 * Format a date with a predefined format
 * @param input Date, string, or timestamp
 * @param dateFormat One of the predefined date formats
 * @returns Formatted date string
 */
export function formatDateWith(input: DateInput, dateFormat: DateFormat = 'SHORT') {
  return formatDate(input, DATE_FORMATS[dateFormat]);
}

/**
 * Format a date as a short date (e.g., "11/23/2025")
 */
export function formatDateShort(input: DateInput) {
  return formatDateWith(input, 'SHORT');
}

/**
 * Format a date as a long date (e.g., "November 23, 2025")
 */
export function formatDateLong(input: DateInput) {
  return formatDateWith(input, 'LONG');
}

/**
 * Format a date as year and month (e.g., "Nov 2025")
 */
export function formatDateYearMonth(input: DateInput) {
  return formatDateWith(input, 'YEAR_MONTH');
}

/**
 * Format a date as ISO format (e.g., "2025-11-23")
 */
export function formatDateISO(input: DateInput) {
  return formatDateWith(input, 'ISO');
}

/**
 * Format a date as full date with day of week (e.g., "Friday, November 23, 2025")
 */
export function formatDateFull(input: DateInput) {
  return formatDateWith(input, 'FULL');
}
