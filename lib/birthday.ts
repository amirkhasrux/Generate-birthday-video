/**
 * lib/birthday.ts
 * ----------------
 * Pure utility functions for birthday-related calculations and validation.
 * These functions have no side effects and do not touch the DOM or React state.
 */

/** Months indexed 0–11, used for formatting dates in a human-readable way. */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Calculates a person's current age from their date of birth.
 * Correctly handles the case where the birthday hasn't occurred yet this year.
 *
 * Example: DOB = 2000-08-23, today = 2026-09-13 → age = 26
 * Example: DOB = 2000-11-01, today = 2026-09-13 → age = 25 (birthday not yet this year)
 */
export function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  // Check if the birthday has already happened this calendar year.
  const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age;
}

/**
 * Formats a Date object as a human-readable birth date string.
 * Example: 2000-08-23 → "23 August 2000"
 */
export function formatDate(dob: Date): string {
  const day = dob.getDate();
  const month = MONTH_NAMES[dob.getMonth()];
  const year = dob.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Sanitizes a name so it can be safely used in a filename.
 * Strips characters that are illegal in filenames on Windows/macOS/Linux.
 * Replaces spaces with hyphens and lowercases the result.
 *
 * Example: "Munni Béla!" → "munni-bela"
 */
export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")                   // spaces → hyphens
    .replace(/[^a-z0-9\-]/g, "")            // remove anything not alphanumeric or hyphen
    .replace(/-+/g, "-")                    // collapse consecutive hyphens
    .replace(/^-|-$/g, "");                 // trim leading/trailing hyphens
}

/** Validation result type — either valid or an error message. */
export type ValidationResult = { valid: true } | { valid: false; message: string };

/**
 * Validates the name field.
 * Rules: required, not empty after trimming, max 60 characters.
 */
export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, message: "Please enter a name." };
  }
  if (trimmed.length > 60) {
    return { valid: false, message: "Name must be 60 characters or fewer." };
  }
  // Must contain at least one letter character
  if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) {
    return { valid: false, message: "Please enter a valid name with letters." };
  }
  return { valid: true };
}

/**
 * Helper to check if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum days in a given month (1-indexed: 1 = Jan, 12 = Dec).
 */
export function getDaysInMonth(month: number, year: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Extracts day, month, and year from either DD/MM/YYYY or YYYY-MM-DD.
 * Returns null if the format doesn't match either pattern.
 */
export function parseDateParts(dobString: string): { day: number; month: number; year: number } | null {
  const trimmed = dobString.trim();

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return {
      day: parseInt(dmyMatch[1], 10),
      month: parseInt(dmyMatch[2], 10),
      year: parseInt(dmyMatch[3], 10),
    };
  }

  // Check YYYY-MM-DD (fallback for ISO dates)
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return {
      day: parseInt(ymdMatch[3], 10),
      month: parseInt(ymdMatch[2], 10),
      year: parseInt(ymdMatch[1], 10),
    };
  }

  return null;
}

/**
 * Validates the date of birth string.
 * Primary format: DD/MM/YYYY (also accepts standard YYYY-MM-DD).
 * Rules:
 *   - Must match date pattern
 *   - Month must be 1–12
 *   - Day must be valid for the month (accounting for leap years in Feb)
 *   - Year must be >= 1900
 *   - Date must not be in the future
 */
export function validateDob(dobString: string): ValidationResult {
  if (!dobString || !dobString.trim()) {
    return { valid: false, message: "Please enter a date of birth." };
  }

  const parts = parseDateParts(dobString);
  if (!parts) {
    return { valid: false, message: "Please enter a valid date of birth." };
  }

  const { day, month, year } = parts;

  if (year < 1900) {
    return { valid: false, message: "Year must be 1900 or later." };
  }

  const currentYear = new Date().getFullYear();
  if (year > currentYear) {
    return { valid: false, message: "Birth year cannot be in the future." };
  }

  if (month < 1 || month > 12) {
    return { valid: false, message: "Month must be between 01 and 12." };
  }

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    if (month === 2 && !isLeapYear(year) && day === 29) {
      return { valid: false, message: `${year} is not a leap year (Feb has 28 days).` };
    }
    return {
      valid: false,
      message: `Invalid day for ${MONTH_NAMES[month - 1] || "month"}. Must be between 01 and ${maxDays}.`,
    };
  }

  // Check if date is in the future
  const dob = new Date(year, month - 1, day, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (dob > today) {
    return { valid: false, message: "Date of birth cannot be in the future." };
  }

  return { valid: true };
}

/**
 * Parses a DD/MM/YYYY (or YYYY-MM-DD) date string into a local-timezone Date object.
 */
export function parseDob(dobString: string): Date {
  const parts = parseDateParts(dobString);
  if (parts) {
    return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  }
  // Fallback
  return new Date(dobString + "T00:00:00");
}

