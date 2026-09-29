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
import { createAccountPersistence } from "@/account/persistence";
import { createSessionComposition } from "@/session/composition";
import { createAuthorizationService } from "@/authorization/service";
import type { Account } from "@/account/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request);
  if (!sessionId) return unauthorized();

  const sessions = createSessionComposition();
  const evaluation = await sessions.evaluate(sessionId);

  if (evaluation.status !== "active" || !evaluation.session) {
    return unauthorized();
  }

  const persistence = createAccountPersistence();
  const account: Account | null = persistence.getAccountById(evaluation.session.accountId);
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

function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = /(?:^|;\s*)sessionId=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
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