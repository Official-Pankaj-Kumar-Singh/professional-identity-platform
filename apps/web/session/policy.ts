/**
 * @file session/policy.ts
 *
 * Authenticated session policy (Task #112).
 *
 * This module is the single place where the answers to "how long does a session
 * live, what makes it active, and what renews it" are stated. The policy was
 * previously implicit: a bare `24 * 60 * 60 * 1000` literal in
 * `session/composition.ts` and an unwritten assumption that a session never
 * changes after it is created. A policy that exists only as an unexplained
 * literal in a factory cannot be reviewed, tested, or reasoned about, so it is
 * named here and referenced from there.
 *
 * The values are unchanged from what the code already did. This task makes them
 * explicit and checkable; it does not silently alter how long a user stays
 * signed in.
 */

/** How long a session remains valid from the moment it is issued. */
export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Sliding renewal is on.
 *
 * Policy: a session stays valid for `SESSION_LIFETIME_MS` measured from its most
 * recent authenticated use rather than from issue time. The user story is "I do
 * not want to have to repeatedly log in while I use the application", which is a
 * statement about an *active* user, so a session that is being used must not age
 * out from under them.
 *
 * The two properties this is deliberately NOT:
 *
 * - It is not unbounded. Every authenticated use moves the deadline forward by at
 *   most the lifetime itself, so a session can never live longer than
 *   `expiresAt + SESSION_LIFETIME_MS` from any single evaluation.
 * - It is not free. Renewal happens only when a request already presents a valid
 *   session, so an idle session is never touched and therefore does expire. A
 *   poll that found an expired session cannot resurrect it.
 */
export const SESSION_RENEWAL: "sliding" | "fixed" = "sliding";

/** The renewal window used when a session is extended. */
export const SESSION_RENEWAL_MS = SESSION_LIFETIME_MS;

/**
 * The session identifier is stable for the life of the session.
 *
 * Renewal moves the expiry forward; it never reissues the identifier. A rotating
 * identifier would require the new value to reach the browser before the old one
 * stopped working, which introduces a window where two credentials are live for
 * one user. Keeping the identifier fixed means an established cookie keeps
 * working until it genuinely expires, which is what continuity requires.
 */
export const SESSION_IDENTITY: "stable" | "rotating" = "stable";

/** The complete policy, as one named object rather than scattered constants. */
export const SESSION_POLICY = {
  lifetimeMs: SESSION_LIFETIME_MS,
  renewalMs: SESSION_RENEWAL_MS,
  renewal: SESSION_RENEWAL,
  identity: SESSION_IDENTITY,
} as const;

/**
 * The instant after which a session is no longer active.
 *
 * Expiry is inclusive: a session whose `expiresAt` equals the evaluation instant
 * is already expired, so a session lives for exactly `lifetimeMs` and not one
 * instant longer. `session/repository.ts` applies the same comparison when it
 * classifies a session, and both must agree or the boundary would be ambiguous.
 */
export function expiresFrom(issuedAt: string, lifetimeMs: number = SESSION_LIFETIME_MS): string {
  return new Date(Date.parse(issuedAt) + lifetimeMs).toISOString();
}

/** True when `expiresAt` is at or before `now`. */
export function isExpiredAt(expiresAt: string, now: string): boolean {
  const current = Date.parse(now);
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(current) || !Number.isFinite(expiry)) return true;
  return current >= expiry;
}

/**
 * The expiry a renewed session receives, or `null` when policy says not to renew.
 *
 * Returning `null` rather than the unchanged expiry keeps the caller honest: an
 * unrenewed session is a decision, not an omission, and `SessionRepository`
 * leaves the stored record untouched when it receives `null`.
 */
export function renewedExpiry(now: string, lifetimeMs: number = SESSION_LIFETIME_MS): string | null {
  if (SESSION_RENEWAL === "fixed") return null;
  return expiresFrom(now, lifetimeMs);
}