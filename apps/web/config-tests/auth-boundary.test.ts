/**
 * @file config-tests/auth-boundary.test.ts
 *
 * Task #111 — tests for authentication protection boundaries.
 *
 * These tests exercise the real `GET /api/me` handler at the HTTP boundary,
 * proving that protected resources enforce authentication and reject
 * unauthenticated requests. They operate at the server boundary, not at
 * the service layer, so they validate the full composition chain including
 * cookie parsing, session evaluation, and ownership checks.
 *
 * The tests use the shared process-wide compositions so that sessions
 * created by `POST /api/login` are visible to `GET /api/me`, which is the
 * behavior that Task #110 ensures.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { getSessionComposition, resetSessionComposition, setSessionComposition } from "../session/application";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";

const password = "correct horse battery staple";

/** Fresh, isolated compositions for one test. */
function useCleanCompositions(): void {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition());
}

function releaseCompositions(): void {
  resetAccountComposition();
  resetSessionComposition();
}

/** Register through the real endpoint so the account is in the shared store. */
async function register(email: string, chosen: string = password): Promise<void> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: chosen }),
    }),
  );
  assert.equal(response.status, 201, "registration should succeed for a unique identity");
}

interface MeBody {
  ok: boolean;
  account?: { id: string; email: string; createdAt: string; updatedAt: string };
  error?: { code: string; message: string };
}

async function bodyOf(response: Response): Promise<MeBody> {
  return (await response.json()) as MeBody;
}

async function postSignIn(email: string, attempt: string = password): Promise<Response> {
  return signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: attempt }),
    }),
  );
}

/**
 * Asserts that a response contains no private account data.
 * Used to verify unauthenticated responses don't leak private data.
 */
function assertNoPrivateData(body: { ok: boolean; account?: { id?: string; email?: string; createdAt?: string; updatedAt?: string } | undefined }): void {
  assert.equal(body.ok, false);
  assert.equal(body.account, undefined, "unauthenticated response must not contain account data");
}

describe("authentication protection boundaries (Task #111)", () => {
  it("rejects a request with no cookie", async () => {
    useCleanCompositions();
    try {
      const response = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: { "content-type": "application/json" },
        }),
      );
      assert.equal(response.status, 401);
      const body = await bodyOf(response);
      assertNoPrivateData(body);
      assert.equal(body.error?.code, "unauthenticated");
      assert.equal(body.error?.message, "Sign in to continue.");
    } finally {
      releaseCompositions();
    }
  });

  it("rejects a request with an invalid session cookie", async () => {
    useCleanCompositions();
    try {
      const response = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: {
            "content-type": "application/json",
            cookie: "sessionId=invalid-session-id",
          },
        }),
      );
      assert.equal(response.status, 401);
      const body = await bodyOf(response);
      assertNoPrivateData(body);
      assert.equal(body.error?.code, "unauthenticated");
    } finally {
      releaseCompositions();
    }
  });

  it("rejects a request with a malformed session cookie", async () => {
    // Malformed percent-encoding must not crash the handler (Task #110 fix)
    useCleanCompositions();
    try {
      const response = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: {
            "content-type": "application/json",
            cookie: "sessionId=%ZZ", // invalid percent-encoding
          },
        }),
      );
      assert.equal(response.status, 401);
      const body = await bodyOf(response);
      assertNoPrivateData(body);
      assert.equal(body.error?.code, "unauthenticated");
    } finally {
      releaseCompositions();
    }
  });

  it("rejects a request with an empty session cookie value", async () => {
    useCleanCompositions();
    try {
      const response = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: {
            "content-type": "application/json",
            cookie: "sessionId=",
          },
        }),
      );
      assert.equal(response.status, 401);
      const body = await bodyOf(response);
      assertNoPrivateData(body);
      assert.equal(body.error?.code, "unauthenticated");
    } finally {
      releaseCompositions();
    }
  });

  it("accepts a valid active session and returns the account", async () => {
    useCleanCompositions();
    try {
      const email = `authboundary-${Date.now()}@example.com`;
      await register(email);

      const signInResponse = await postSignIn(email);
      assert.equal(signInResponse.status, 200);

      const cookieHeader = signInResponse.headers.get("set-cookie");
      assert.notEqual(cookieHeader, null);

      const meResponse = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: {
            "content-type": "application/json",
            cookie: cookieHeader!,
          },
        }),
      );

      assert.equal(meResponse.status, 200);
      const body = await bodyOf(meResponse);
      assert.equal(body.ok, true);
      assert.equal(body.account?.email, email);
      assert.ok(body.account?.id);
      assert.ok(body.account?.createdAt);
      assert.ok(body.account?.updatedAt);
    } finally {
      releaseCompositions();
    }
  });

  it("returns the documented 401 error body for unauthenticated requests", async () => {
    useCleanCompositions();
    try {
      const response = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: { "content-type": "application/json" },
        }),
      );
      assert.equal(response.status, 401);
      const body = await bodyOf(response);
      assert.deepEqual(body, {
        ok: false,
        error: { code: "unauthenticated", message: "Sign in to continue." },
      });
    } finally {
      releaseCompositions();
    }
  });
});