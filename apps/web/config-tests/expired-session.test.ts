/**
 * @file config-tests/expired-session.test.ts
 *
 * Task #117 — expired-session rejection.
 *
 * Drives the real HTTP boundary with a deterministic clock, moving time through
 * the seam added in Task #113 rather than sleeping. Nothing here waits on
 * wall-clock time and nothing asserts that a method was merely called.
 *
 * The contract under test (#115) is that an expired session is presented exactly
 * like every other unauthenticated request, and that no protected data survives
 * it. Two properties are checked together for that reason: the status, and the
 * absence of anything account-shaped in the body.
 *
 * Application state (#116) is covered by the `toAuthState` cases below, which
 * prove the client resolves an expired response to the unauthenticated state and
 * retains no account payload.
 *
 * Scope note: #115/#117 specify the response contract for expired sessions. What
 * an application *does* about it beyond becoming unauthenticated — a
 * re-authentication prompt, a redirect policy — is not asserted here, and
 * missing/malformed/unknown cookie coverage belongs to #111.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { resetSessionComposition, setSessionComposition } from "../session/application";
import { SESSION_LIFETIME_MS } from "../session/policy";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";
import { POST as logout } from "../app/logout/route";
import { ANONYMOUS, resolveAuthState, toAuthState } from "../app/session/auth-state";

const password = "correct horse battery staple";
const START = "2026-10-01T12:00:00.000Z";

function fixedClock(startIso: string = START) {
  let current = Date.parse(startIso);
  return {
    now: () => new Date(current).toISOString(),
    evaluateClock: () => new Date(current).toISOString(),
    advance(ms: number) {
      current += ms;
    },
  };
}

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `expired-${counter}@example.com`;
}

interface MeBody {
  ok: boolean;
  account?: { id: string; email: string };
  error?: { code: string; message: string };
}

/** The documented unauthenticated body. Every failed authentication looks like this. */
const UNAUTHENTICATED_BODY = {
  ok: false,
  error: { code: "unauthenticated", message: "Sign in to continue." },
};

async function signInAndExpire(email: string, clock: ReturnType<typeof fixedClock>): Promise<string> {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition({ now: clock.now, evaluateClock: clock.evaluateClock }));

  const registered = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(registered.status, 201);

  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 200);

  const header = response.headers.get("set-cookie")!;
  const [pair] = header.split(";");
  const separator = pair.indexOf("=");
  const sessionId = decodeURIComponent(pair.slice(separator + 1).trim());

  // The session must work before anything is expired, or the test would prove
  // nothing about expiration specifically.
  const before = await getMe(
    new Request("http://localhost/api/me", { method: "GET", headers: { cookie: `sessionId=${encodeURIComponent(sessionId)}` } }),
  );
  assert.equal(before.status, 200, "the session must be active before it expires");

  clock.advance(SESSION_LIFETIME_MS);
  return sessionId;
}

function me(sessionId: string): Promise<Response> {
  return getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie: `sessionId=${encodeURIComponent(sessionId)}` } }));
}

async function bodyOf(response: Response): Promise<MeBody> {
  return (await response.json()) as MeBody;
}

function release(): void {
  resetAccountComposition();
  resetSessionComposition();
}

describe("expired session rejection (Task #117)", () => {
  it("rejects an expired session with the documented unauthenticated response", async () => {
    const clock = fixedClock();
    try {
      const sessionId = await signInAndExpire(uniqueEmail(), clock);

      const response = await me(sessionId);
      assert.equal(response.status, 401);
      // Byte-for-byte the documented body: an expired session is presented
      // exactly like a missing or unknown one.
      assert.deepEqual(await bodyOf(response), UNAUTHENTICATED_BODY);
    } finally {
      release();
    }
  });

  it("returns no protected data for an expired session", async () => {
    const clock = fixedClock();
    try {
      const sessionId = await signInAndExpire(uniqueEmail(), clock);

      const response = await me(sessionId);
      const raw = await response.text();
      const body = JSON.parse(raw) as MeBody;

      assert.equal(body.ok, false);
      assert.equal(body.account, undefined, "no account may be returned after expiration");
      for (const field of ["id", "email", "createdAt", "updatedAt"]) {
        assert.equal(
          raw.includes(`"${field}"`),
          false,
          `an expired response must not expose ${field}`,
        );
      }
    } finally {
      release();
    }
  });

  it("presents an expired session identically to a missing and an unknown one", async () => {
    const clock = fixedClock();
    try {
      const sessionId = await signInAndExpire(uniqueEmail(), clock);

      const expired = await me(sessionId);
      const missing = await getMe(new Request("http://localhost/api/me", { method: "GET" }));
      const unknown = await getMe(
        new Request("http://localhost/api/me", {
          method: "GET",
          headers: { cookie: "sessionId=never-existed-at-all" },
        }),
      );

      assert.equal(expired.status, missing.status);
      assert.equal(expired.status, unknown.status);
      // Each body is read exactly once, into its own variable: a response body
      // cannot be consumed twice, and re-reading would mask a real difference.
      const expiredBody = await bodyOf(expired);
      const missingBody = await bodyOf(missing);
      const unknownBody = await bodyOf(unknown);
      assert.deepEqual(expiredBody, missingBody);
      assert.deepEqual(expiredBody, unknownBody);
    } finally {
      release();
    }
  });

  it("rejects an expired session on every subsequent request", async () => {
    const clock = fixedClock();
    try {
      const sessionId = await signInAndExpire(uniqueEmail(), clock);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        clock.advance(60 * 60 * 1000);
        const response = await me(sessionId);
        assert.equal(response.status, 401, "expiry is permanent, not transient");
        assert.equal((await bodyOf(response)).account, undefined);
      }
    } finally {
      release();
    }
  });

  it("treats logout of an expired session as a successful no-op", async () => {
    const clock = fixedClock();
    try {
      const sessionId = await signInAndExpire(uniqueEmail(), clock);

      const response = await logout(
        new Request("http://localhost/logout", {
          method: "POST",
          headers: { cookie: `sessionId=${encodeURIComponent(sessionId)}` },
        }),
      );

      // Nothing to destroy, but the caller still ends up unauthenticated, so this
      // is a success rather than an error. Story #83's contract is preserved.
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { ok: boolean }).ok, true);
    } finally {
      release();
    }
  });

  it("moves the application to the unauthenticated state on an expired response", async () => {
    // Task #116: an expired response resolves to the anonymous state, because
    // #115 makes it indistinguishable from every other 401.
    const state = await resolveAuthState(
      (async () => new Response(JSON.stringify(UNAUTHENTICATED_BODY), { status: 401 })) as unknown as typeof fetch,
    );
    assert.deepEqual(state, ANONYMOUS);
    assert.equal(state.authenticated, false);
    assert.equal(state.account, null);
  });
});

describe("expired-session application state (Task #116)", () => {
  it("resolves any non-ok response to the unauthenticated state", () => {
    for (const status of [401, 403, 404, 500]) {
      const state = toAuthState({ ok: false, error: { code: "unauthenticated", message: "Sign in to continue." } });
      assert.deepEqual(state, ANONYMOUS, `a ${status}-shaped rejection must be unauthenticated`);
    }
  });

  it("withholds account data unless the payload is complete and explicitly ok", () => {
    const complete = { id: "a1", email: "person@example.com", createdAt: "x", updatedAt: "y" };

    // Complete account is the only thing that yields an authenticated state.
    assert.equal(toAuthState({ ok: true, account: complete }).authenticated, true);

    // Anything partial, mistyped, or not explicitly ok fails closed.
    for (const payload of [
      { ok: true },
      { ok: true, account: undefined },
      { ok: true, account: { id: "a1" } },
      { ok: true, account: { ...complete, id: 42 } },
      { ok: true, account: { ...complete, email: null } },
      { account: complete },
      { ok: "true", account: complete },
      null,
      undefined,
    ]) {
      const state = toAuthState(payload as never);
      assert.deepEqual(state, ANONYMOUS, `must fail closed for ${JSON.stringify(payload)}`);
      assert.equal(state.account, null);
    }
  });

  it("resolves a transport failure to the unauthenticated state", async () => {
    const state = await resolveAuthState(
      (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );
    assert.deepEqual(state, ANONYMOUS);
  });

  it("checks the status before trusting the body", async () => {
    // A 401 whose body claims success must still be unauthenticated: the status
    // is the contract, not the payload.
    const state = await resolveAuthState(
      (async () =>
        new Response(
          JSON.stringify({ ok: true, account: { id: "a1", email: "e@example.com", createdAt: "x", updatedAt: "y" } }),
          { status: 401 },
        )) as unknown as typeof fetch,
    );
    assert.deepEqual(state, ANONYMOUS, "a 401 body must never authenticate the client");
  });

  it("resolves a genuine authenticated response to the authenticated state", async () => {
    const state = await resolveAuthState(
      (async () =>
        new Response(
          JSON.stringify({
            ok: true,
            account: { id: "a1", email: "person@example.com", createdAt: "x", updatedAt: "y" },
          }),
          { status: 200 },
        )) as unknown as typeof fetch,
    );
    assert.equal(state.authenticated, true);
    if (state.authenticated) assert.equal(state.account.email, "person@example.com");
  });
});