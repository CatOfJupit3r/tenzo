import { format } from 'date-fns';
import { em } from 'enumwaii';

export type DateInput = Date | string | number;

// Date format patterns
export const DATE_FORMATS_ENUM = em(['SHORT', 'LONG', 'YEAR_MONTH', 'ISO', 'FULL']);
export const DATE_FORMATS = DATE_FORMATS_ENUM.enum;
const DATE_FORMAT_PATTERNS = DATE_FORMATS_ENUM.derive<string>()(
  [DATE_FORMATS.SHORT, 'P'],
  [DATE_FORMATS.LONG, 'MMMM d, yyyy'],
  [DATE_FORMATS.YEAR_MONTH, 'MMM yyyy'],
  [DATE_FORMATS.ISO, 'yyyy-MM-dd'],
  [DATE_FORMATS.FULL, 'EEEE, MMMM d, yyyy'],
);
export type DateFormat = (typeof DATE_FORMATS_ENUM)['~type'];

/**
 * Format a date with a custom pattern
 * @param input Date, string, or timestamp
 * @param pattern date-fns format pattern (default: 'P')
 * @returns Formatted date string
 */
export function formatDate(input: DateInput, pattern = DATE_FORMAT_PATTERNS.get(DATE_FORMATS.SHORT)) {
  const date = input instanceof Date ? input : new Date(input);
  return format(date, pattern);
}

/**
 * Format a date with a predefined format
 * @param input Date, string, or timestamp
 * @param dateFormat One of the predefined date formats
 * @returns Formatted date string
 */
export function formatDateWith(input: DateInput, dateFormat: DateFormat = DATE_FORMATS.SHORT) {
  return formatDate(input, DATE_FORMAT_PATTERNS.get(dateFormat));
}

/**
 * Format a date as a short date (e.g., "11/23/2025")
 */
export function formatDateShort(input: DateInput) {
  return formatDateWith(input, DATE_FORMATS.SHORT);
}

/**
 * Format a date as a long date (e.g., "November 23, 2025")
 */
export function formatDateLong(input: DateInput) {
  return formatDateWith(input, DATE_FORMATS.LONG);
}

/**
 * Format a date as year and month (e.g., "Nov 2025")
 */
export function formatDateYearMonth(input: DateInput) {
  return formatDateWith(input, DATE_FORMATS.YEAR_MONTH);
}

/**
 * Format a date as ISO format (e.g., "2025-11-23")
 */
export function formatDateISO(input: DateInput) {
  return formatDateWith(input, DATE_FORMATS.ISO);
}

/**
 * Format a date as full date with day of week (e.g., "Friday, November 23, 2025")
 */
export function formatDateFull(input: DateInput) {
  return formatDateWith(input, DATE_FORMATS.FULL);
}
