/**
 * @file app/api/recovery/route.ts
 *
 * Recovery-request endpoint (Task #122).
 *
 * Accepts the identifier the rest of the application already uses — the account
 * email — and answers identically whether or not it is registered. The recovery
 * token is **never** returned here; it goes to the delivery boundary instead.
 *
 * Returning it would be worse than a leak of account data: it would turn
 * "submit an email address" into "reset the password of anyone whose address you
 * can guess", which is the entire attack this feature's privacy rule exists to
 * prevent.
 */

import { NextResponse } from "next/server";
// Relative imports so the plain Node config-test build can load the handler,
// matching `app/api/register/route.ts`, `app/api/login/route.ts`,
// `app/api/accounts/[id]/route.ts`, and `app/logout/route.ts`.
import { getRecoveryComposition } from "../../../recovery/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One response shape for every outcome that is not a storage or input failure. */
const GENERIC_MESSAGE = "If that account exists, a recovery link has been sent.";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: GENERIC_MESSAGE, fields: { email: "Enter your email address." } } }, 400);
  }

  const email = (body as { email?: unknown } | null)?.email;
  if (typeof email !== "string") {
    return json({ ok: false, error: { code: "invalid-input", message: GENERIC_MESSAGE, fields: { email: "Enter your email address." } } }, 400);
  }

  const composition = getRecoveryComposition();
  // The composition's `requestRecovery` is used rather than the bare service,
  // because delivery is its responsibility: it hands the token to the delivery
  // boundary. Calling the service directly would issue a token that never
  // reaches the user.
  const result = await composition.requestRecovery(email);

  if (!result.ok) {
    return json({ ok: false, error: { code: "invalid-input", message: GENERIC_MESSAGE, fields: { email: "Enter your email address." } } }, 400);
  }

  // `result.token` is intentionally dropped here. It has already been handed to
  // the delivery boundary. Existing and non-existing accounts produce this exact
  // response, so the endpoint reveals nothing about which addresses are registered.
  return json({ ok: true, message: GENERIC_MESSAGE }, 200);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}