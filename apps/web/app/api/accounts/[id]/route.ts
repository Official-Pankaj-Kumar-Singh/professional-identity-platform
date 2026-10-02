/**
 * @file app/api/accounts/[id]/route.ts
 *
 * Account resource endpoint (Feature #79 — Tasks #127–#135).
 *
 * Serves `GET`, `PATCH`, and `DELETE` for a single account addressed by URL.
 * This is the resource boundary the Account Management stories require: #128
 * requires that another account's details are not exposed, #131 that another
 * account cannot be modified, and #134 that only the account holder can delete.
 * Each of those presupposes a request that *names* an account; without one,
 * "another account" is not expressible.
 *
 * Security flow — the order here is the security property:
 *
 *   cookie -> session.accountId -> actor -> service -> authorization.require
 *
 * The `[id]` segment selects which account is being asked about. It never
 * becomes the actor. The actor is read from the session and nowhere else, so
 * substituting another account's identifier yields `403` rather than access.
 *
 * `params` is a Promise in this Next.js version, so it is awaited before use.
 *
 * Responses use the existing conventions: `{ ok: true, account }` on success and
 * `{ ok: false, error: { code, message } }` on failure, with field-level detail
 * only for validation errors.
 */

import { NextResponse } from "next/server";
// Relative imports so the plain Node config-test build can load this handler
// without Next's alias resolver. Same approach, and same reason, as
// `app/api/me/route.ts`.
import { getAccountManagementService } from "../../../../account-management/application";
import { validateAccountPatch } from "../../../../account-management/update-validation";
import { getSessionComposition } from "../../../../session/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccountParams = { params: Promise<{ id: string }> };

/**
 * Resolve the authenticated actor from the session cookie (Tasks #110/#113).
 *
 * Returns `null` for any request that is not currently authenticated, which the
 * service turns into `401`. A malformed cookie is treated as unauthenticated
 * rather than raising, so a caller controlling the cookie cannot turn an
 * authorization check into a server error.
 */
async function resolveActor(request: Request): Promise<string | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = /(?:^|;\s*)sessionId=([^;]+)/.exec(cookie);
  if (!match) return null;

  let sessionId: string;
  try {
    sessionId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  const evaluation = await getSessionComposition().evaluate(sessionId);
  if (evaluation.status !== "active" || !evaluation.session) return null;
  return evaluation.session.accountId;
}

export async function GET(request: Request, { params }: AccountParams): Promise<Response> {
  const { id } = await params;
  const actor = await resolveActor(request);
  const result = await getAccountManagementService().read(actor, id);
  return respond(result);
}

export async function PATCH(request: Request, { params }: AccountParams): Promise<Response> {
  const { id } = await params;
  const actor = await resolveActor(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: "Provide the account details to update." } }, 400);
  }

  const validation = validateAccountPatch(body);
  if (!validation.ok) {
    if ("forbidden" in validation) {
      return json(
        {
          ok: false,
          error: {
            code: "invalid-input",
            message: "That field cannot be changed.",
            fields: Object.fromEntries(validation.forbidden.map((key: string) => [key, "This field cannot be changed."])),
          },
        },
        400,
      );
    }
    return json({ ok: false, error: { code: "invalid-input", message: "Check the account details.", fields: validation.fields } }, 400);
  }

  const result = await getAccountManagementService().update(actor, id, validation.patch);
  return respond(result);
}

export async function DELETE(request: Request, { params }: AccountParams): Promise<Response> {
  const { id } = await params;
  const actor = await resolveActor(request);

  // Confirmation is read from the request body, defaulting to absent. The
  // service decides what an absent confirmation means, so the rule lives in one
  // place rather than in the route.
  let confirmed = false;
  try {
    const body = (await request.json()) as { confirm?: unknown } | null;
    confirmed = body?.confirm === true;
  } catch {
    confirmed = false;
  }

  const result = await getAccountManagementService().remove(actor, id, confirmed);
  return respond(result);
}

/** Maps a service outcome onto the HTTP surface. */
function respond(result: { ok: true; value: unknown } | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }): Response {
  if (result.ok) {
    if ("deleted" in (result.value as object)) return json({ ok: true, deleted: true }, 200);
    return json({ ok: true, account: result.value }, 200);
  }
  return json({ ok: false, error: result.error }, statusFor(result.error.code));
}

function statusFor(code: string): number {
  switch (code) {
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not-found":
      return 404;
    default:
      return 400;
  }
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}