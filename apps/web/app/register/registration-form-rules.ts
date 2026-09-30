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
  error?: { code?: string; message?: string };
}

/**
 * Translate a server response into safe on-screen feedback.
 *
 * A rejection is surfaced with the server's own message, except for
 * `invalid-input`, which is the one code the server reports for malformed input
 * it cannot attribute to a single field. That case is attached to both fields
 * so the user knows where to look without the server having to enumerate which
 * field was wrong.
 *
 * `already-exists` deliberately keeps the server's non-disclosing message. The
 * form must not turn a duplicate into advice that reveals the identity, so no
 * special case is added for it here.
 */
export function toRegistrationFeedback(payload: RegistrationResponsePayload): RegistrationFeedback {
  if (payload?.ok) return { ok: true };
  // An empty or non-string message would render as blank feedback, so it is
  // treated as "nothing usable" rather than passed through. `??` alone is not
  // enough here: an empty string is not nullish.
  const raw = payload?.error?.message;
  const message = typeof raw === "string" && raw.trim().length > 0 ? raw : REGISTRATION_GENERIC_ERROR;
  if (payload?.error?.code !== "invalid-input") return { ok: false, message };
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
