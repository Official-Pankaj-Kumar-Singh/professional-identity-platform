/**
 * @file app/logout/route.ts
 *
 * Server-side logout endpoint, served at POST /logout (Tasks #106–#107).
 *
 * Explicit session termination. This is not merely "forget the cookie on the
 * client": the session is destroyed in the shared server-side session store, so
 * the session identifier stops authenticating even if a caller retained it.
 * That distinction is the whole point of the task — a logout that only cleared
 * a cookie would leave a valid credential sitting in any browser, proxy log, or
 * attacker copy.
 *
 * The session is identified by the same cookie the protected-resource boundary
 * (`app/api/me/route.ts`) reads. It used to be read from a JSON request body
 * instead, which could not have worked: the cookie is `HttpOnly`, so page
 * script cannot read the session identifier to place it in a body, and the
 * browser therefore had no way to present its own session at all. The identifier
 * now comes from the `Cookie` header, which the browser attaches automatically.
 *
 * Request isolation (Task #106): the handler resolves the process-wide session
 * composition rather than building its own. A logout that constructed a private
 * composition would destroy its identifier against a brand-new empty repository,
 * report success, and leave the real session alive — the exact failure this
 * change removes. Same reasoning, and same pattern, as the account composition
 * under Task #100 and the session composition under Task #105.
 *
 * Cookie clearing (Task #107): every response clears the cookie, including a
 * request that carried no session. Clearing uses the same name, `Path`, `HttpOnly`,
 * `SameSite`, and conditional `Secure` attributes that sign-in sets, because the
 * browser only replaces a cookie whose name, path, and domain all match. An
 * expiry in the past plus `Max-Age=0` instructs removal. The name is imported
 * from the sign-in endpoint rather than re-declared, so the two can never drift
 * into two different cookies.
 *
 * Idempotence: logging out when already logged out is a success, not an error.
 * The caller ends up unauthenticated either way, so `destroyed: false` is the
 * honest report of an already-terminated session and the response stays `200`.
 * Reporting an error here would tell a client that its own session state is
 * wrong, and would make a double-submitted logout look like a failure.
 *
 * LIMITATION — process-local, not durable session storage: sessions live in this
 * Node process, so they are lost on restart and are not shared between processes,
 * serverless invocations, or deployment instances. Termination here is real
 * within the process that owns the session; durable revocation across instances
 * belongs to Task #113.
 */

import { NextResponse } from "next/server";
// Relative imports so the plain Node config-test build can load this handler
// without Next's alias resolver. Same approach, and same reason, as
// `app/api/register/route.ts`, `app/api/login/route.ts`, and `app/api/me/route.ts`.
import { getSessionComposition } from "../../session/application";
// Imported, not re-declared: the sign-in endpoint owns the cookie contract.
import { SESSION_COOKIE_NAME } from "../api/login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A date the browser is required to treat as already past. */
const EPOCH = "Thu, 01 Jan 1970 00:00:00 GMT";

export async function POST(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);

  // No cookie, or one that cannot be decoded: nothing to terminate server-side,
  // but the cookie is still cleared so the browser drops any unusable value.
  if (!sessionId) {
    return cleared({ ok: true, destroyed: false });
  }

  const sessions = getSessionComposition();
  const result = await sessions.logout(sessionId);

  if (!result.ok) {
    // The cookie is cleared even on a storage failure. Leaving a credential in
    // the browser after the server refused to destroy it would be the worst
    // outcome available, so the client is returned to unauthenticated regardless.
    return NextResponse.json(
      { ok: false, error: { code: "storage-failure", message: "We could not sign you out right now." } },
      { status: 500, headers: { "Set-Cookie": clearedSessionCookie() } },
    );
  }

  return cleared({ ok: true, destroyed: result.destroyed });
}

/**
 * Reads the session identifier from the `Cookie` header.
 *
 * Tolerates a malformed value rather than throwing. `decodeURIComponent` raises
 * `URIError` on invalid percent-encoding, and a caller who controls the cookie
 * must not be able to turn logout into a server error. An undecodable cookie is
 * treated as no session: nothing server-side is terminated and the cookie is
 * still cleared.
 *
 * The matching expression and its tolerance are deliberately identical to the
 * reader in `app/api/me/route.ts`, because both routes must accept and reject
 * exactly the same cookies — a session the protected resource honours but logout
 * cannot terminate would be a session that could never be ended.
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
 * Instructs the browser to delete the session cookie.
 *
 * The attributes mirror those set by `POST /api/login`. Only the name, path, and
 * domain decide which cookie is being replaced, so those must match exactly;
 * the remaining attributes are mirrored for consistency. `Max-Age=0` with an
 * expiry in the past removes the cookie even where an empty value alone would
 * merely overwrite it with an empty one.
 */
function clearedSessionCookie(): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    `Expires=${EPOCH}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

function cleared(data: unknown): Response {
  return NextResponse.json(data, { status: 200, headers: { "Set-Cookie": clearedSessionCookie() } });
}