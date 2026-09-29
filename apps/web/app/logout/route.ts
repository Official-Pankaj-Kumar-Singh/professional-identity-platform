/**
 * @file app/logout/route.ts
 *
 * Server-side logout endpoint (Tasks #106–#108).
 *
 * Destroys the supplied session and transitions the authenticated state to
 * unauthenticated. The response is safe even when the session is already
 * gone or expired.
 */

import { NextResponse } from "next/server";
import { createSessionComposition } from "@/session/composition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: true, destroyed: false }, 200);
  }

  const sessionId = (body as { sessionId?: unknown })?.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return json({ ok: true, destroyed: false }, 200);
  }

  const sessions = createSessionComposition();
  const result = await sessions.logout(sessionId);
  if (!result.ok) {
    return json({ ok: false, error: { code: "storage-failure", message: "We could not sign you out right now." } }, 500);
  }
  return json({ ok: true, destroyed: result.destroyed }, 200);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}