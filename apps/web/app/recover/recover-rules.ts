/**
 * @file app/recover/recover-rules.ts
 *
 * Recovery-request feedback rules (Task #122), as pure functions with no React
 * and no DOM. This lives apart from the component for the same reason
 * `app/login/sign-in-form-rules.ts` does: the repository has no component-test
 * setup, so anything deciding what the form renders must be reachable from the
 * config-test suite.
 *
 * Non-disclosure is the governing rule here. Whatever the server said, the form
 * shows the same confirmation, because a user who learns from the wording that an
 * address is unregistered has been told something the endpoint deliberately hid.
 */

export type RecoverFeedback = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Shown for every accepted submission, whether or not the account exists. */
export const RECOVERY_REQUEST_SENT_MESSAGE = "If that account exists, a recovery link has been sent.";

/** Shown when a request fails for a reason that cannot be shown safely. */
export const RECOVERY_GENERIC_ERROR = "We could not process your request right now.";

export interface RecoveryResponsePayload {
  ok?: boolean;
  message?: unknown;
  error?: { code?: unknown; message?: unknown; fields?: Record<string, unknown> };
}

/** Field-level problems the server reported, kept only for the fields we render. */
export function toFieldErrors(payload: RecoveryResponsePayload | null | undefined): Readonly<Record<string, string>> {
  const raw = payload?.error?.fields;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Map a recovery-request response to feedback.
 *
 * Only `invalid-input` is treated as actionable, because it is the one code that
 * describes something the user can correct. Everything else — including
 * `storage-failure` — yields the neutral local message, so a server problem
 * cannot be turned into a signal about a particular address.
 */
export function toRecoverFeedback(payload: RecoveryResponsePayload | null | undefined): RecoverFeedback {
  if (payload?.ok === true) return { ok: true };

  if (payload?.error?.code === "invalid-input") {
    const message = payload.error.message;
    return { ok: false, message: typeof message === "string" && message.trim().length > 0 ? message : RECOVERY_REQUEST_SENT_MESSAGE };
  }

  return { ok: false, message: RECOVERY_GENERIC_ERROR };
}