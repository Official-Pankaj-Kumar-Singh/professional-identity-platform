/**
 * @file app/recover/reset-rules.ts
 *
 * Password-reset feedback rules (Task #126), as pure functions with no React and
 * no DOM. Separated from the component for the same reason as the other rule
 * modules in this application: the repository has no component-test setup.
 *
 * Unlike the recovery-request rules, these messages CAN be specific about the
 * problem. A caller who reaches this form already holds a recovery token, so
 * telling them their link expired or their password is too weak discloses nothing
 * they did not already know.
 */

export type ResetFeedback = { readonly ok: true } | { readonly ok: false; readonly message: string };

export const RESET_SUCCESS_MESSAGE = "Your password has been changed. Sign in with your new password.";

export const RESET_GENERIC_ERROR = "We could not update your password right now.";

/** Shown when the link cannot be used. Kept neutral between the failure kinds. */
export const RESET_LINK_INVALID_MESSAGE = "This recovery link is not valid.";

export interface ResetResponsePayload {
  ok?: boolean;
  message?: unknown;
  error?: { code?: unknown; message?: unknown; fields?: Record<string, unknown> };
}

export function toFieldErrors(payload: ResetResponsePayload | null | undefined): Readonly<Record<string, string>> {
  const raw = payload?.error?.fields;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Map a reset response to feedback.
 *
 * The three link failure codes (invalid, expired, already used) all render the
 * same neutral message. They are distinguished internally so the caller can react
 * differently if it wants to, but the user is not told which — distinguishing
 * "expired" from "already used" tells an attacker holding a stale token that the
 * token was genuine, which is a small but free information gain.
 */
export function toResetFeedback(payload: ResetResponsePayload | null | undefined): ResetFeedback {
  if (payload?.ok === true) return { ok: true };

  const code = payload?.error?.code;
  const message = payload?.error?.message;

  switch (code) {
    case "invalid-token":
    case "expired-token":
    case "used-token":
      return { ok: false, message: RESET_LINK_INVALID_MESSAGE };
    case "invalid-password":
    case "invalid-input":
      return {
        ok: false,
        message: typeof message === "string" && message.trim().length > 0 ? message : RESET_GENERIC_ERROR,
      };
    default:
      return { ok: false, message: RESET_GENERIC_ERROR };
  }
}