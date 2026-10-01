/**
 * @file app/session/auth-state.ts
 *
 * Expired-session application state (Task #116).
 *
 * Deciding "is this browser authenticated?" is one question with one answer, and
 * it must be asked of the server rather than of client state. The session cookie
 * is `HttpOnly`, so page script cannot read it and cannot know whether a session
 * exists; the only truthful source is the protected boundary itself. This module
 * centralises that question so every caller gets the same answer and the same
 * guarantees.
 *
 * Two guarantees matter, and both come from the expired-session contract (#115):
 *
 * 1. Every non-authenticated outcome — no cookie, malformed cookie, unknown
 *    session, terminated session, and **expired** session — resolves to the same
 *    `anonymous` state. An expired session therefore moves the user to the
 *    unauthenticated state automatically, with no special case to forget.
 * 2. Nothing account-shaped is retained. `toAuthState` maps the payload to a
 *    discriminated union and drops every field it does not recognise, so a
 *    response cannot smuggle private data into client state — including a future
 *    response that manages to return 200 with an account the caller is not
 *    entitled to, which the client has no basis to detect on its own.
 */

export type AuthState =
  | { authenticated: false; account: null }
  | { authenticated: true; account: { id: string; email: string; createdAt: string; updatedAt: string } };

/** The unauthenticated state. Every failed probe resolves to exactly this. */
export const ANONYMOUS: AuthState = { authenticated: false, account: null };

/** The shape the protected boundary returns. */
export interface ProtectedResourcePayload {
  ok?: boolean;
  account?: { id?: unknown; email?: unknown; createdAt?: unknown; updatedAt?: unknown };
  error?: { code?: unknown; message?: unknown };
}

/**
 * Maps a protected-resource response to application state.
 *
 * Only an explicit `ok: true` with a complete account yields an authenticated
 * state. Anything else — including a malformed payload, an unexpected `account`
 * shape, or an unexpected `ok` value — resolves to `ANONYMOUS`. Failing closed is
 * deliberate: a client that guessed "authenticated" from an ambiguous response
 * would render private UI for a session the server never granted.
 */
export function toAuthState(payload: ProtectedResourcePayload | null | undefined): AuthState {
  if (payload?.ok !== true) return ANONYMOUS;

  const account = payload.account;
  if (!account) return ANONYMOUS;

  const { id, email, createdAt, updatedAt } = account;
  if (
    typeof id !== "string" || typeof email !== "string" ||
    typeof createdAt !== "string" || typeof updatedAt !== "string"
  ) {
    return ANONYMOUS;
  }

  return { authenticated: true, account: { id, email, createdAt, updatedAt } };
}

/**
 * Resolves the current authentication state from the protected boundary.
 *
 * A transport failure resolves to `ANONYMOUS`: a network error is not evidence
 * of authentication, and treating it as such would offer the user controls that
 * cannot work.
 */
export async function resolveAuthState(
  fetchImpl: typeof fetch = fetch,
  endpoint: string = "/api/me",
): Promise<AuthState> {
  try {
    const response = await fetchImpl(endpoint, { cache: "no-store" });
    // The status is checked before the body so an expired session's 401 can
    // never be mistaken for authenticated, whatever the body happens to contain.
    if (!response.ok) return ANONYMOUS;
    const payload = await response.json().catch(() => null);
    return toAuthState(payload as ProtectedResourcePayload | null);
  } catch {
    return ANONYMOUS;
  }
}