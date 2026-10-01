/**
 * @file app/logout/logout-form-rules.ts
 *
 * Task #107 — the logout action's feedback rules, as pure functions with no
 * React and no DOM.
 *
 * These live here rather than inline in the component for the same reason
 * `app/login/sign-in-form-rules.ts` does: the repository has no component-test
 * setup, so anything that decides what the logout control does with a response
 * has to be reachable from the config-test suite. Keeping the logic here leaves
 * the component a thin renderer.
 *
 * Non-disclosure follows the same rule as sign-in. Only the server's own
 * `storage-failure` message is rendered; any other code, and any response that
 * is not the expected JSON, falls back to a local message, so an unexpected body
 * cannot put arbitrary text — or an internal detail — into the page. The session
 * identifier is never surfaced here either: it is carried by an `HttpOnly` cookie
 * that page script cannot read, so a successful logout has no identifier to show.
 */

export type LogoutFeedback = { ok: true } | { ok: false; message: string };

/** Shown when a logout attempt fails for a reason that cannot be shown safely. */
export const LOGOUT_GENERIC_ERROR = "We could not sign you out right now.";

/** Shown after logout completes. */
export const LOGOUT_SUCCESS_MESSAGE = "You are signed out.";

/** The shape the logout endpoint returns. */
export interface LogoutResponsePayload {
  ok?: boolean;
  destroyed?: boolean;
  error?: { code?: string; message?: string };
}

/** The only failure code whose server message is safe to render verbatim. */
const RENDERABLE_CODE = "storage-failure";

/**
 * Translate a logout response into safe on-screen feedback.
 *
 * On success the caller learns only that the attempt worked. `destroyed` is
 * deliberately not propagated: it distinguishes "a session was found and
 * terminated" from "there was nothing to terminate", which is server bookkeeping
 * and tells a user nothing useful about their own state. Both are the same
 * outcome from the caller's perspective — unauthenticated.
 */
export function toLogoutFeedback(payload: LogoutResponsePayload | null | undefined): LogoutFeedback {
  if (payload?.ok) return { ok: true };
  const code = payload?.error?.code;
  if (code !== RENDERABLE_CODE) return { ok: false, message: LOGOUT_GENERIC_ERROR };
  // A blank or non-string message would render as empty feedback, so `??` alone
  // is not enough here: an empty string is not nullish.
  const raw = payload?.error?.message;
  const message = typeof raw === "string" && raw.trim().length > 0 ? raw : LOGOUT_GENERIC_ERROR;
  return { ok: false, message };
}