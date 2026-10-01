/**
 * @file app/api/me/route.ts
 *
 * Protected resource endpoint (Tasks #109–#111, #113, #115).
 *
 * Returns the authenticated account only when the supplied session is
 * active and belongs to the same account being read. Unauthenticated and
 * cross-account requests are rejected with a generic 401/403 response.
 *
 * Session continuity (Task #113): a request that presents an active session
 * slides that session's expiry forward and reissues the cookie with the new
 * `Max-Age`. That is what lets a user work for longer than one lifetime without
 * being signed out mid-use, which is the story's requirement. It is not
 * unbounded: renewal happens only on a request that already presented a valid
 * session, so an idle session is never extended and therefore still expires.
 *
 * Ordering is deliberate. The session is evaluated first and the request is
 * rejected if it is not active; only a session that passed that check is
 * refreshed. Refreshing first would let the expiry decision be made by the
 * renewal itself, which is exactly the mistake that would resurrect a dead
 * session.
 *
 * Expired-session contract (Task #115): an expired session produces the same
 * `401 unauthenticated` response as a missing, malformed, unknown, or terminated
 * one. The responses are deliberately indistinguishable, so a client cannot use
 * the response to learn whether a session identifier was once real. The client
 * contract is therefore the same in every unauthenticated case: sign in again.
 * The server still distinguishes them internally — `evaluate` reports `expired`
 * separately from `revoked` — so logging and any future re-authentication prompt
 * can tell them apart without disclosing anything to the caller.
 *
 * Cookie handling (Task #113): the reissued cookie mirrors the attributes set by
 * `POST /api/login`, because a browser only replaces a cookie whose name, path,
 * and domain all match. The cookie name is imported from the sign-in endpoint
 * rather than re-declared, so the two cannot drift into two different cookies —
 * the same coupling `app/logout/route.ts` uses.
 */

import { NextResponse } from "next/server";
// Relative imports so the plain Node config-test build can load this handler
// without Next's alias resolver. Same approach, and same reason, as
// `app/api/register/route.ts`, `app/api/login/route.ts`, and `app/logout/route.ts`.
import { getAccountComposition } from "../../../account/application";
import { getSessionComposition } from "../../../session/application";
import { createAuthorizationService } from "../../../authorization/service";
import type { Account } from "../../../account/types";
import type { Session } from "../../../session/types";
// Imported, not re-declared: the sign-in endpoint owns the cookie contract.
import { SESSION_COOKIE_NAME } from "../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return unauthenticated();

  const sessions = getSessionComposition();

  // Authoritative expiry check. Everything below assumes the session is active.
  const evaluation = await sessions.evaluate(sessionId);
  if (evaluation.status !== "active" || !evaluation.session) {
    return unauthenticated();
  }

  // Slide the session forward. A null result means it expired between the
  // evaluation above and here, which is treated as unauthenticated rather than
  // as a successful renewal.
  const refreshed = await sessions.refresh(sessionId);
  if (!refreshed.ok || !refreshed.session) {
    return unauthenticated();
  }
  const session: Session = refreshed.session;

  const composition = getAccountComposition();
  const account: Account | null = composition.persistence.getAccountById(session.accountId);
  if (!account) return unauthenticated();

  const authorization = createAuthorizationService();
  const decision = authorization.require(session.accountId, {
    accountId: account.id,
    resourceType: "account",
    resourceId: account.id,
  });

  if (!decision.allowed) {
    return decision.code === "forbidden" ? forbidden() : unauthenticated();
  }

  return json(
    {
      ok: true,
      account: { id: account.id, email: account.email, createdAt: account.createdAt, updatedAt: account.updatedAt },
    },
    200,
    // The remaining lifetime is measured with the session store's own clock. Using
    // a separate `Date.now()` here would agree with the store only by coincidence,
    // and the browser would then hold a different expiry from the server.
    { headers: { "Set-Cookie": renewedSessionCookie(session.id, session.expiresAt, sessions.now()) } },
  );
}

/**
 * Reads the session identifier from the `Cookie` header.
 *
 * Tolerates a malformed value rather than throwing: `decodeURIComponent` raises
 * `URIError` on invalid percent-encoding, and a caller who controls the cookie
 * must not be able to turn an authentication check into a server error. An
 * undecodable cookie is unauthenticated.
 *
 * The expression and its tolerance are deliberately identical to the readers in
 * `app/api/login/route.ts` and `app/logout/route.ts`: all three routes must
 * accept and reject exactly the same cookies.
 */
function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = /(?:^|;\s*)sessionId=([^;]+)/.exec(cookie);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Reissues the session cookie with an updated `Max-Age` (Task #113).
 *
 * Without this the browser would keep the original lifetime while the server
 * held a later expiry, so the two would silently disagree and the session would
 * appear to end early. `Max-Age` is derived from the renewed session's own
 * `expiresAt` for the same reason it is at sign-in: one source of truth.
 */
function renewedSessionCookie(sessionId: string, expiresAt: string, now: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds(expiresAt, now)}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

/** Remaining lifetime in whole seconds, never negative and never NaN. */
function maxAgeSeconds(expiresAt: string, now: string): number {
  const remaining = Date.parse(expiresAt) - Date.parse(now);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.floor(remaining / 1000);
}

/** The single unauthenticated response (Task #115). Expired included. */
function unauthenticated(): Response {
  return json({ ok: false, error: { code: "unauthenticated", message: "Sign in to continue." } }, 401);
}

function forbidden(): Response {
  return json({ ok: false, error: { code: "forbidden", message: "Access denied." } }, 403);
}

function json(data: unknown, status: number, init: { headers?: Record<string, string> } = {}): Response {
  return NextResponse.json(data, { status, headers: init.headers });
}