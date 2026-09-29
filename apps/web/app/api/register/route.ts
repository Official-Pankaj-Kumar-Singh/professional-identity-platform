/**
 * @file app/api/register/route.ts
 *
 * Server-side registration endpoint, served at POST /api/register.
 *
 * This route is the production registration boundary. It validates input,
 * normalizes the email identity, hashes the password, and persists the
 * account through the production composition layer. It never trusts the
 * client: validation runs again here even though the form mirrors the
 * same rules.
 *
 * Fail-closed behavior: any unexpected error produces a generic failure
 * response that does not disclose whether the account already exists or
 * which storage path failed.
 *
 * Request isolation (Task #100): the route resolves the process-wide account
 * composition instead of building its own, so every request sees the same
 * account set and a repeated normalized identity is rejected. That store is
 * process-local and in-memory — not durable production persistence.
 *
 * Routing (Task #154): this handler lives under `app/api/` so it does not
 * occupy the same App Router segment as the registration UI page. A `route.ts`
 * may not coexist with a `page.tsx` in one segment. `app/register/page.tsx`
 * serves GET /register; this file serves POST /api/register.
 */

import { NextResponse } from "next/server";
// Relative import (not the `@/*` alias) so the route is loadable by the plain
// Node test build, which compiles the real handler without Next's alias resolver.
// Depth is three levels because the handler moved under app/api/ (Task #154).
import { getAccountComposition } from "../../../account/application";
import type { AccountCreationResult } from "../../../account/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-input", message: "Provide an email address and password." } }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: { code: "invalid-input", message: "Provide an email address and password." } }, 400);
  }

  const { email, password } = body as { email?: unknown; password?: unknown };
  if (!isString(email) || !isString(password)) {
    return json({ ok: false, error: { code: "invalid-input", message: "Provide an email address and password." } }, 400);
  }

  const composition = getAccountComposition();
  const result: AccountCreationResult = await composition.create({ email, password });

  if (result.ok) {
    return json({ ok: true, account: { id: result.account.id, email: result.account.email } }, 201);
  }
  return json({ ok: false, error: result.error }, 400);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}