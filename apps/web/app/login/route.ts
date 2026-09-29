/**
 * @file app/login/route.ts
 *
 * Server-side sign-in endpoint (Tasks #104–#105).
 *
 * Validates input, looks up the credential, verifies the password, and on
 * success creates an authenticated session. Failures collapse to a single
 * generic message so the response never reveals whether the email or the
 * password was wrong.
 */

import { NextResponse } from "next/server";
import { createAccountPersistence } from "@/account/persistence";
import { createSignInService } from "@/auth/sign-in";
import { createSessionComposition } from "@/session/composition";
import type { CredentialInput, CredentialVerificationResult } from "@/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: { code: "invalid-credentials", message: "The email or password is incorrect." } }, 400);
  }

  const persistence = createAccountPersistence();
  const signIn = createSignInService({ repository: persistence.credentials });
  const sessions = createSessionComposition();

  const result: CredentialVerificationResult = await signIn.verify(
    body as CredentialInput,
  );

  if (!result.ok) {
    return json({ ok: false, error: result.error }, 401);
  }

  const created = await sessions.create(result.identity.accountId);
  if (!created.ok) {
    return json({ ok: false, error: { code: "storage-failure", message: "We could not sign you in right now." } }, 500);
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
  );
}

function json(data: unknown, status: number): Response {
  return NextResponse.json(data, { status });
}