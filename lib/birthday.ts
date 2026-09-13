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
 * Validates the date of birth string (from <input type="date">, format YYYY-MM-DD).
 * Rules: required, must be a real date, must not be in the future, must be after 1900.
 */
export function validateDob(dobString: string): ValidationResult {
  if (!dobString) {
    return { valid: false, message: "Please enter a date of birth." };
  }

  const dob = new Date(dobString + "T00:00:00"); // force local time, not UTC

  if (isNaN(dob.getTime())) {
    return { valid: false, message: "Please enter a valid date of birth." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dob > today) {
    return { valid: false, message: "Date of birth cannot be in the future." };
  }

  if (dob.getFullYear() < 1900) {
    return { valid: false, message: "Please enter a date of birth after 1900." };
  }

  return { valid: true };
}

/**
 * Parses a YYYY-MM-DD date string into a local-timezone Date object.
 * Using "T00:00:00" prevents off-by-one day errors caused by UTC conversion.
 */
export function parseDob(dobString: string): Date {
  return new Date(dobString + "T00:00:00");
}
