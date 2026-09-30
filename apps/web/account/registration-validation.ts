/**
 * @file account/registration-validation.ts
 *
 * Task #97 — the shared registration field rules.
 *
 * This module is the single specification of what a valid registration is. The
 * account service enforces it, and the registration form mirrors it (Task #95)
 * by importing it, so the two cannot disagree about what the server accepts.
 *
 * The contract:
 *
 * - `email` is required and must have a basic address shape: a non-empty local
 *   part, an `@`, and a dotted domain, with no whitespace inside. Surrounding
 *   whitespace is trimmed first, so `"  a@b.co  "` is valid.
 * - `password` is required and must be at least
 *   {@link MIN_REGISTRATION_PASSWORD_LENGTH} characters.
 * - Each failure is an issue naming its `field` and a stable `code`, so a
 *   caller can attribute an error without parsing a message.
 * - Issues are emitted in field order, email first, so presentation is stable.
 * - No issue message ever contains the submitted value. That is what lets the
 *   form reuse these messages verbatim without leaking what was typed.
 *
 * This is a baseline, not a full password policy: there is no breached-password
 * check, no complexity rule beyond the length, and no maximum. Tightening that
 * belongs to its own task.
 */

export type RegistrationField = "email" | "password";

/**
 * The one statement of the password minimum, shared by the policy, the form's
 * `minLength` attribute, and the on-screen hint. It was previously written out
 * in all three places, so a change to the policy could have left the other two
 * disagreeing with it.
 */
export const MIN_REGISTRATION_PASSWORD_LENGTH = 12;

/** Stable, machine-readable failure codes. Messages may change; these do not. */
export type RegistrationValidationCode = "required" | "invalid-email" | "weak-password";

export interface RegistrationValidationIssue {
  field: RegistrationField;
  code: RegistrationValidationCode;
  message: string;
}

export interface RegistrationValidationResult {
  ok: boolean;
  issues: RegistrationValidationIssue[];
}

/** A local part, an `@`, and a dotted domain, with no internal whitespace. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared server-side registration policy; clients may mirror these rules. */
export function validateRegistration(input: unknown): RegistrationValidationResult {
  const issues: RegistrationValidationIssue[] = [];
  const value = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  if (!email) issues.push({ field: "email", code: "required", message: "Enter your email address." });
  else if (!EMAIL_SHAPE.test(email)) issues.push({ field: "email", code: "invalid-email", message: "Enter a valid email address." });
  if (!password) issues.push({ field: "password", code: "required", message: "Enter a password." });
  else if (password.length < MIN_REGISTRATION_PASSWORD_LENGTH) issues.push({ field: "password", code: "weak-password", message: "Use at least 12 characters." });
  return { ok: issues.length === 0, issues };
}
