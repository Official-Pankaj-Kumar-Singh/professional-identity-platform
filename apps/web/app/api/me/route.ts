/**
 * @file app/api/me/route.ts
 *
 * Protected resource endpoint (Tasks #109–#111).
 *
 * Returns the authenticated account only when the supplied session is
 * active and belongs to the same account being read. Unauthenticated and
 * cross-account requests are rejected with a generic 401/403 response.
 */

import { NextResponse } from "next/server";
// Relative import (not the `@/*` alias) so the route is loadable by the plain
// Node test build, which compiles the real handler without Next's alias
// resolver. Same approach, and same reason, as `app/api/register/route.ts`.
// Depth is three levels because the handler lives under app/api/.
import { getAccountComposition } from "../../../account/application";
import { getSessionComposition } from "../../../session/application";
import { createAuthorizationService } from "../../../authorization/service";
import type { Account } from "../../../account/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return unauthorized();

  const sessions = getSessionComposition();
  const evaluation = await sessions.evaluate(sessionId);

  if (evaluation.status !== "active" || !evaluation.session) {
    return unauthorized();
  }

  const composition = getAccountComposition();
  const account: Account | null = composition.persistence.getAccountById(evaluation.session.accountId);
  if (!account) return unauthorized();

  const authorization = createAuthorizationService();
  const decision = authorization.require(evaluation.session.accountId, {
    accountId: account.id,
    resourceType: "account",
    resourceId: account.id,
  });

  if (!decision.allowed) {
    return decision.code === "forbidden" ? forbidden() : unauthorized();
  }

  return json({
    ok: true,
    account: { id: account.id, email: account.email, createdAt: account.createdAt, updatedAt: account.updatedAt },
  }, 200);
}

/**
 * Reads the session identifier from the `Cookie` header.
 *
 * Returns `null` when the header is absent, the cookie is missing,
 * or the cookie value cannot be decoded. Malformed percent-encoding
 * in the cookie value is treated as an absent session rather than
 * surfacing a server error — this prevents a caller who controls the
 * cookie from turning an authentication check into a 500.
 */
function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = /(?:^|;\s*)sessionId=([^;]+)/.exec(cookie);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // Malformed percent-encoding — treat as absent session
    return null;
  }
}

function unauthorized(): Response {
  return json({ ok: false, error: { code: "unauthenticated", message: "Sign in to continue." } }, 401);
}

function forbidden(): Response {
  return json({ ok: false, error: { code: "forbidden", message: "Access denied." } }, 403);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}