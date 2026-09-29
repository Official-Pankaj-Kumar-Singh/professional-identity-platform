/**
 * @file app/register/route.ts
 *
 * Server-side registration endpoint.
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
 */

import { NextResponse } from "next/server";
import { createAccountComposition } from "@/account/composition";
import type { AccountCreationResult } from "@/account/types";

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

  const composition = createAccountComposition();
  const result: AccountCreationResult = await composition.create({ email, password });

  if (result.ok) {
    return json({ ok: true, account: { id: result.account.id, email: result.account.email } }, 201);
  }
  return json({ ok: false, error: result.error }, 400);
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}