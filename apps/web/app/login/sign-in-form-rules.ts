/**
 * @file app/login/sign-in-form-rules.ts
 *
 * Task #105 — the sign-in form's own checks and feedback rules, as pure
 * functions with no React and no DOM.
 *
 * These rules live here rather than inline in the form component for the same
 * reason `app/register/registration-form-rules.ts` does: the repository has no
 * component-test setup, so anything that decides whether the form submits and
 * how a server failure becomes on-screen text has to be reachable from the
 * config-test suite. Keeping them here leaves the component a thin renderer.
 *
 * Two rules govern what the client is allowed to say, and they are the reason
 * this module does not simply pass server messages through:
 *
 * 1. The client never judges whether an account exists. Sign-in applies no
 *    email-shape rule and no password-length rule, deliberately. The
 *    registration policy's 12-character minimum is a rule about *creating* a
 *    password; reusing it here would block a legitimate sign-in for an account
 *    whose password predates the rule, and copying the email-shape pattern
 *    would add a third place for it to drift. The client checks only that
 *    something was typed, and the server is the sole authority on whether a
 *    credential is valid.
 *
 * 2. A rejected attempt is reported as one undifferentiated outcome. The
 *    feedback mapper never attaches an error to a field on an
 *    `invalid-credentials` rejection. Naming the email field as the problem
 *    would tell the user their address is unknown, which is exactly the
 *    account-existence disclosure the non-disclosing server message exists to
 *    prevent — reintroduced through the presentation layer.
 *
 * Only the server's own generic `invalid-credentials` message is rendered. Any
 * other code, and any response that is not the expected JSON at all, falls
 * back to a local message, so an unexpected body cannot put arbitrary text —
 * or an internal detail — into the page.
 */

export type SignInField = "email" | "password";

export type SignInFieldErrors = Partial<Record<SignInField, string>>;

export interface SignInFormValues {
  email: string;
  password: string;
}

/** Shown when a rejection carries no usable message of its own. */
export const SIGN_IN_GENERIC_ERROR = "We could not sign you in. Please try again.";

/** Shown after the session cookie has been accepted by the browser. */
export const SIGN_IN_SUCCESS_MESSAGE = "You are signed in.";

/**
 * Field-level checks applied before the form will submit.
 *
 * These are presence checks only, for the same reasons given in the file
 * comment. Returns an empty object when the form has something to send, which
 * is the single condition the submit handler uses to decide whether to submit
 * at all.
 */
export function validateSignInFields(values: SignInFormValues): SignInFieldErrors {
  const errors: SignInFieldErrors = {};
  if (!values.email.trim()) errors.email = "Enter your email address.";
  if (!values.password) errors.password = "Enter your password.";
  return errors;
}

export type SignInFeedback = { ok: true } | { ok: false; message: string };

/** The shape the sign-in endpoint returns. */
export interface SignInResponsePayload {
  ok?: boolean;
  session?: { id?: string; accountId?: string; email?: string; expiresAt?: string };
  error?: { code?: string; message?: string };
}

/** The only failure code whose server message is safe to render verbatim. */
const RENDERABLE_CODE = "invalid-credentials";

/**
 * Translate a sign-in response into safe on-screen feedback.
 *
 * On success the caller learns only that the attempt worked. The session
 * identifier is deliberately not handed to the form: it is carried by an
 * `HttpOnly` cookie, so returning it here would add a copy in page-reachable
 * memory that nothing needs.
 *
 * On failure the returned object carries a message and never a field, so the
 * two indistinguishable causes stay indistinguishable on screen.
 */
export function toSignInFeedback(payload: SignInResponsePayload | null | undefined): SignInFeedback {
  if (payload?.ok) return { ok: true };
  const code = payload?.error?.code;
  if (code !== RENDERABLE_CODE) return { ok: false, message: SIGN_IN_GENERIC_ERROR };
  // A blank or non-string message would render as empty feedback, so `??` alone
  // is not enough here: an empty string is not nullish.
  const raw = payload?.error?.message;
  const message = typeof raw === "string" && raw.trim().length > 0 ? raw : SIGN_IN_GENERIC_ERROR;
  return { ok: false, message };
}
