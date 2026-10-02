/**
 * @file app/account/account-rules.ts
 *
 * Account-management view rules (Tasks #127–#135), as pure functions with no
 * React and no DOM.
 *
 * These live here rather than inline in the component for the same reason
 * `app/login/sign-in-form-rules.ts` does: the repository has no component-test
 * setup, so anything deciding what the form renders and how a response becomes
 * on-screen feedback has to be reachable from the config-test suite.
 *
 * Non-disclosure follows sign-in and logout. Only messages the server is
 * documented to produce are rendered; anything else falls back to a local
 * string, so an unexpected body cannot put arbitrary text into the page.
 */

/** Shown when a request fails for a reason that cannot be shown safely. */
export const ACCOUNT_GENERIC_ERROR = "We could not complete that request right now.";

/** Shown when the account has been deleted. */
export const ACCOUNT_DELETED_MESSAGE = "Your account has been deleted.";

/** Shown after a permitted field is saved. */
export const ACCOUNT_UPDATED_MESSAGE = "Your account details have been updated.";

/** The shape the account resource returns. */
export interface AccountPayload {
  ok?: boolean;
  account?: { id?: unknown; email?: unknown; createdAt?: unknown; updatedAt?: unknown };
  error?: { code?: unknown; message?: unknown; fields?: Record<string, unknown> };
  deleted?: boolean;
}

/** Error codes the account resource may return. */
export type AccountErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "invalid-input"
  | "duplicate-identity"
  | "confirmation-required"
  | "storage-failure";

export type AccountFeedback =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly fields: Readonly<Record<string, string>> };

const GENERIC_FIELDS: Readonly<Record<string, string>> = {};

/**
 * Validate a change locally before it is sent.
 *
 * Mirrors the server's rules rather than replacing them: the server remains the
 * authority, so a value that passes here can still be refused. Checking locally
 * only avoids a pointless round trip for an obviously empty field.
 */
export function validateEmailChange(value: string): Readonly<Record<string, string>> {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { email: "Enter a value." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { email: "Enter a valid email address." };
  return GENERIC_FIELDS;
}

/**
 * Translate an account response into safe feedback.
 *
 * Field-level validation detail is surfaced because it is produced by the
 * documented validation path; every other code yields the shared message. A
 * `forbidden` or `not-found` is reported plainly — those are ordinary outcomes
 * of asking for an account the caller may not see, not internal detail.
 */
export function toAccountFeedback(payload: AccountPayload | null | undefined): AccountFeedback {
  if (payload?.ok === true) return { ok: true };

  const code = payload?.error?.code as AccountErrorCode | undefined;
  const rawMessage = payload?.error?.message;
  const rawFields = payload?.error?.fields;

  const fields: Record<string, string> = {};
  if (rawFields && typeof rawFields === "object" && code === "invalid-input") {
    for (const [key, value] of Object.entries(rawFields)) {
      if (typeof value === "string") fields[key] = value;
    }
  }

  let message = ACCOUNT_GENERIC_ERROR;
  switch (code) {
    case "invalid-input":
    case "duplicate-identity":
    case "confirmation-required":
      message = typeof rawMessage === "string" && rawMessage.trim().length > 0 ? rawMessage : ACCOUNT_GENERIC_ERROR;
      break;
    case "unauthenticated":
      message = "Sign in to continue.";
      break;
    case "forbidden":
      message = "You do not have access to that account.";
      break;
    case "not-found":
      message = "That account could not be found.";
      break;
    default:
      message = ACCOUNT_GENERIC_ERROR;
  }

  return { ok: false, message, fields };
}

/**
 * The confirmation phrase a user must supply before deletion (Task #133/#134).
 *
 * Requiring an exact phrase rather than a yes/no confirmation is the standard
 * safeguard against an accidental destructive click. The server independently
 * requires a confirmation flag; this phrase is the client-side half.
 */
export const DELETE_CONFIRMATION_PHRASE = "DELETE";

export function isConfirmedDeletion(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_CONFIRMATION_PHRASE;
}