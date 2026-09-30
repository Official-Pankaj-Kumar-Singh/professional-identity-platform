/**
 * @file app/register/registration-form-rules.ts
 *
 * Task #95 — the registration form's own checks and feedback rules, as pure
 * functions with no React and no DOM.
 *
 * These rules previously lived inline in the form component and the page's
 * submit handler. That made the task's behaviour real but unverifiable: the
 * repository has no component-test setup, so the rules that decide whether the
 * form submits at all, and how a server error becomes on-screen feedback, had
 * no test that could reach them. Moving them here keeps the component a thin
 * renderer and lets the config-test suite cover them.
 *
 * The checks delegate to the shared `validateRegistration` policy rather than
 * restating the email pattern and the length rule. The form had been carrying
 * its own copy of both, plus copies of all four messages; the copies were
 * byte-identical today but nothing kept them that way. One source means the
 * form cannot drift into accepting what the server would reject. This module
 * is client-safe: the policy it imports is a dependency-free module.
 *
 * Scope note: this is the *form-side* view. The server-side policy, its issue
 * thread, and validation boundary coverage belong to Task #97/#98/#99 and are
 * deliberately untouched here.
 */

import { validateRegistration, MIN_REGISTRATION_PASSWORD_LENGTH, type RegistrationField } from "../../account/registration-validation";

export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

export interface RegistrationFormValues {
  email: string;
  password: string;
}

/**
 * Shown when the form is used but nothing has been entered yet. Derived from the
 * shared policy so the hint cannot contradict the rule it describes.
 */
export const REGISTRATION_HINT = `Use at least ${MIN_REGISTRATION_PASSWORD_LENGTH} characters.`;

/** Generic copy for any failure whose cause must not be described to the user. */
export const REGISTRATION_GENERIC_ERROR = "We could not create your account. Please try again.";

/**
 * Field-level checks the form applies before it will submit.
 *
 * Returns an empty object when the values are acceptable, which is the single
 * condition the submit handler uses to decide whether to send anything.
 */
export function validateRegistrationFields(values: RegistrationFormValues): RegistrationFieldErrors {
  const result = validateRegistration(values);
  if (result.ok) return {};
  const errors: RegistrationFieldErrors = {};
  for (const issue of result.issues) {
    if (errors[issue.field] === undefined) errors[issue.field] = issue.message;
  }
  return errors;
}

export type RegistrationFeedback =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: RegistrationFieldErrors };

/** The shape the registration endpoint returns. */
export interface RegistrationResponsePayload {
  ok?: boolean;
  account?: { id?: string; email?: string };
  error?: { code?: string; message?: string; issues?: Array<{ field?: string; code?: string; message?: string }> };
}

const REGISTRATION_FIELDS = new Set(["email", "password"]);

function fieldErrorsFromIssues(
  issues: Array<{ field?: string; code?: string; message?: string }> | undefined,
): RegistrationFieldErrors | undefined {
  if (!Array.isArray(issues) || issues.length === 0) return undefined;
  const errors: RegistrationFieldErrors = {};
  for (const issue of issues) {
    if (typeof issue?.field !== "string" || !REGISTRATION_FIELDS.has(issue.field)) continue;
    if (typeof issue.message !== "string" || issue.message.length === 0) continue;
    if (errors[issue.field as RegistrationField] === undefined) {
      errors[issue.field as RegistrationField] = issue.message;
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

/**
 * Translate a server response into safe on-screen feedback.
 *
 * Task #98: the server names the field behind an `invalid-input` rejection, so
 * those issues are used directly. The form no longer has to guess by blaming
 * both fields at once, and the messages it shows are the same ones the server
 * produced — one set of expectations, not two.
 *
 * The messages come from the shared registration policy, which never embeds a
 * submitted value, so rendering them discloses which field was rejected and
 * nothing about what was typed.
 *
 * `already-exists` deliberately keeps the server's non-disclosing message and
 * stays unattached to any field: a duplicate must not be turned into advice
 * that reveals the identity.
 */
export function toRegistrationFeedback(payload: RegistrationResponsePayload): RegistrationFeedback {
  if (payload?.ok) return { ok: true };
  // An empty or non-string message would render as blank feedback, so it is
  // treated as "nothing usable" rather than passed through. `??` alone is not
  // enough here: an empty string is not nullish.
  const raw = payload?.error?.message;
  const message = typeof raw === "string" && raw.trim().length > 0 ? raw : REGISTRATION_GENERIC_ERROR;
  if (payload?.error?.code !== "invalid-input") return { ok: false, message };

  const attributed = fieldErrorsFromIssues(payload.error.issues);
  if (attributed) return { ok: false, message, fieldErrors: attributed };

  // Fallback for a server that rejects without naming a field: blame both rather
  // than guess one, so the user is never pointed at a field that was fine.
  return {
    ok: false,
    message,
    fieldErrors: {
      email: "Check your email address.",
      password: "Check your password.",
    },
  };
}

export type { RegistrationField };
