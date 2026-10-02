/**
 * @file app/api/recovery/reset/route.ts
 *
 * Password-reset endpoint (Task #125).
 *
 * Exchanges a recovery token plus a new password for a changed credential.
 *
 * The token is treated as a secret: it is accepted in the body (never in the
 * URL, where it would land in history and referrers) and no response echoes it.
 *
 * Error codes are distinct enough to drive the form — a dead link reads
 * differently from a weak password — but none of them disclose whether the
 * account exists, because a caller must already hold a token to get this far.
 */

import { NextResponse } from "next/server";
// Relative imports so the plain Node config-test build can load the handler.
import { getRecoveryComposition } from "../../../../recovery/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: "Check the details and try again.", fields: { form: "Check the details and try again." } } }, 400);
  }

  const { token, password } = (body as { token?: unknown; password?: unknown } | null) ?? {};

  if (typeof token !== "string" || token.trim().length === 0) {
    return json({ ok: false, error: { code: "invalid-input", message: "Enter your recovery link.", fields: { token: "Enter your recovery link." } } }, 400);
  }
  if (typeof password !== "string") {
    return json({ ok: false, error: { code: "invalid-input", message: "Enter your new password.", fields: { password: "Enter your new password." } } }, 400);
  }

  const result = await getRecoveryComposition().service.resetPassword(token.trim(), password);
  if (!result.ok) {
    return json({ ok: false, error: { code: result.error.code, message: result.error.message, fields: result.error.fields } }, 400);
  }

  // No token, no account id, and no session is returned. The sessions the
  // account held were revoked as part of the reset, so the caller must sign in
  // again with the new password.
  return json({ ok: true, message: "Your password has been changed. Sign in with your new password." }, 200);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}