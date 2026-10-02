/**
 * @file app/session/entry-contract.ts
 *
 * Authenticated application entry contract (Task #136).
 *
 * This states the boundary between an authenticated visitor and an
 * unauthenticated one, and nothing more. It deliberately holds no session,
 * repository, or fetch logic: the decision is a pure function of an already-
 * resolved `AuthState`, which keeps it testable without a component harness and
 * keeps the security question separate from the transport.
 *
 * ## What was found in the repository (Task #137)
 *
 * There was **no authenticated application entry point** before this feature.
 * `/` is the public marketing page, `/account` is authenticated but is account
 * *settings* — a sub-feature reached *from* the entry point rather than being
 * it — and `app/login/page.tsx` stated the gap explicitly: *"navigate anywhere:
 * the authenticated application entry point does not exist yet"*. So this adds
 * the entry point rather than redirecting to something else, and `/account` is
 * linked from it rather than promoted into the role.
 *
 * ## The contract
 *
 * **Unauthenticated visitor.** No cookie, a malformed cookie, an unknown
 * session, and an expired session are all the same thing at this boundary, and
 * all resolve to the sign-in path. The reason is that `GET /api/me` already
 * answers every one of them with the same `401`, so the entry point inherits
 * that uniformity from the authentication boundary rather than re-deciding it.
 * Telling an anonymous visitor *why* they are anonymous would leak whether the
 * session they presented was ever real.
 *
 * **Authenticated visitor.** `resolveAuthState` yields the account identity that
 * `/api/me` returned, and the entry point renders it. That identity comes from
 * the server through the session boundary — never from a query parameter, a
 * client-held value, or anything the visitor supplied.
 *
 * **Not part of this feature.** Professional profile, portfolio, and all other
 * portfolio content are created by EPIC-02. This contract is the transition
 * *into* the authenticated application and nothing beyond it.
 */

/** The authenticated application entry point. */
export const AUTHENTICATED_ENTRY_PATH = "/app";

/** Where an unauthenticated visitor is sent to authenticate. */
export const SIGN_IN_PATH = "/login";

/** The identity the authenticated entry point renders. */
export interface EntryIdentity {
  readonly id: string;
  readonly email: string;
}

export type EntryDecision =
  | { readonly kind: "authenticated"; readonly entryPath: string; readonly identity: EntryIdentity; readonly accountPath: string }
  | { readonly kind: "unauthenticated"; readonly entryPath: string };

/** Structural view of `AuthState`, kept local so this module stays standalone. */
export interface EntryAuthState {
  readonly authenticated: boolean;
  readonly account: { id: string; email: string; createdAt: string; updatedAt: string } | null;
}

/** Where an authenticated visitor manages their account, once they have entered. */
export const ACCOUNT_PATH = "/account";

/**
 * Decide where a visitor belongs, given their already-resolved auth state.
 *
 * Takes `AuthState` rather than fetching, so the rule is separated from the
 * transport and can be exercised directly. An authenticated state with no
 * account is treated as unauthenticated: it is not a shape `resolveAuthState`
 * can produce, and failing closed is the only safe reading of it.
 */
export function resolveEntry(state: EntryAuthState | null | undefined): EntryDecision {
  if (!state || !state.authenticated || !state.account) {
    return { kind: "unauthenticated", entryPath: SIGN_IN_PATH };
  }
  return {
    kind: "authenticated",
    entryPath: AUTHENTICATED_ENTRY_PATH,
    identity: { id: state.account.id, email: state.account.email },
    accountPath: ACCOUNT_PATH,
  };
}

/** True when `path` is the authenticated entry point. */
export function isAuthenticatedEntry(path: string): boolean {
  return path === AUTHENTICATED_ENTRY_PATH;
}