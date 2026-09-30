/**
 * @file app/api/login/route.ts
 *
 * Server-side sign-in endpoint, served at POST /api/login (Tasks #104–#105).
 *
 * Validates input, looks up the credential, verifies the password, and on
 * success creates an authenticated session. Failures collapse to a single
 * generic message so the response never reveals whether the email or the
 * password was wrong.
 *
 * Routing (Task #105): this handler lives under `app/api/` so it does not occupy
 * the same App Router segment as the sign-in UI page. A `route.ts` may not
 * coexist with a `page.tsx` in one segment — the production build rejects that
 * combination outright. `app/login/page.tsx` serves GET /login; this file serves
 * POST /api/login. This is the same split Task #154 introduced for
 * registration, where the handler moved to `app/api/register/route.ts` for the
 * same reason.
 *
 * Browser session establishment (Task #105): on success the session identifier
 * is set as an `HttpOnly` cookie, which is what actually makes the browser
 * authenticated on subsequent requests. Before this task the identifier was
 * only returned in the JSON body, so nothing the browser kept could be sent
 * back and no later request could observe the session. The body still carries
 * the same fields it always did; the cookie is additive.
 *
 * The cookie is named `sessionId` to match the name the protected-resource
 * reader already expects, so this route does not have to be changed again
 * when Task #110 wires that boundary up.
 *
 * The cookie's `Max-Age` is derived from the session's own `expiresAt` rather
 * than from a second, independent constant, so the browser and the server
 * cannot disagree about when the session ends. Whether that lifetime is the
 * right policy is Task #112's decision; this task only mirrors it.
 *
 * Failure responses never set the cookie, so a rejected attempt leaves the
 * browser exactly as unauthenticated as it was.
 *
 * Request isolation: both compositions are resolved per process rather than
 * built per request, for the same reason Task #100 did this for accounts. A
 * sign-in that built its own account store would not see accounts created by
 * `POST /api/register`, and a session written into a throwaway store would be
 * unreachable the moment this response was sent. Both stores are process-local
 * and in-memory — not durable production persistence.
 *
 * Scope note: logout cookie clearing is Task #106, and the protected-resource
 * boundary that consumes this cookie is Task #110. Neither is implemented here.
 */

import { NextResponse } from "next/server";
// Relative import (not the `@/*` alias) so the route is loadable by the plain
// Node test build, which compiles the real handler without Next's alias
// resolver. Same approach, and same reason, as `app/api/register/route.ts`.
// Depth is three levels because the handler lives under app/api/.
import { getAccountComposition } from "../../../account/application";
import { createSignInService } from "../../../auth/sign-in";
import { getSessionComposition } from "../../../session/application";
import type { CredentialInput, CredentialVerificationResult } from "../../../auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cookie carrying the session identifier. The name is part of the contract with
 * the protected-resource reader and must not be changed casually.
 */
export const SESSION_COOKIE_NAME = "sessionId";

/**
 * The single message every rejected attempt receives. A wrong password and an
 * unknown account must be indistinguishable, so neither the code nor the text
 * may vary with the cause of the failure.
 */
const INVALID_CREDENTIALS_MESSAGE = "The email or password is incorrect.";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure({ code: "invalid-credentials", message: INVALID_CREDENTIALS_MESSAGE }, 400);
  }

  const accounts = getAccountComposition();
  const signIn = createSignInService({ repository: accounts.persistence.credentials });
  const sessions = getSessionComposition();

  const result: CredentialVerificationResult = await signIn.verify(
    body as CredentialInput,
  );

  if (!result.ok) {
    return failure(result.error, 401);
  }

  const created = await sessions.create(result.identity.accountId);
  if (!created.ok) {
    return failure({ code: "storage-failure", message: "We could not sign you in right now." }, 500);
  }

  return json(
    {
      ok: true,
      session: {
        id: created.session.id,
        accountId: created.session.accountId,
        email: result.identity.email,
        expiresAt: created.session.expiresAt,
      },
    },
    200,
    { headers: { "Set-Cookie": sessionCookie(created.session.id, created.session.expiresAt) } },
  );
}

/**
 * Serialize the session identifier as a cookie.
 *
 * `HttpOnly` keeps the identifier out of reach of page scripts, so an injected
 * script cannot read it. `SameSite=Lax` stops other sites from driving an
 * authenticated request with the cookie attached, while still allowing a
 * top-level navigation back into the app after an external link.
 *
 * `Secure` is applied only when the app is actually served over HTTPS. Setting
 * it unconditionally would make the cookie silently unusable in local
 * development over plain HTTP, which looks like a sign-in that succeeds and
 * then forgets itself.
 */
function sessionCookie(sessionId: string, expiresAt: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds(expiresAt)}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

/** Remaining lifetime in whole seconds, never negative and never NaN. */
function maxAgeSeconds(expiresAt: string): number {
  const remaining = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.floor(remaining / 1000);
}

function failure(error: { code: string; message: string }, status: number): Response {
  return json({ ok: false, error }, status);
}

function json(data: unknown, status: number, init: { headers?: Record<string, string> } = {}): Response {
  return NextResponse.json(data, { status, headers: init.headers });
}
