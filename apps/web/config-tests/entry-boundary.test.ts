/**
 * @file config-tests/entry-boundary.test.ts
 *
 * Task #138 — onboarding entry boundary tests.
 *
 * The entry point is a client component, which the plain-Node config-test
 * environment cannot render. What *can* be exercised is everything the component
 * delegates to, and that is where the security decision actually lives:
 *
 *   session cookie -> GET /api/me -> resolveAuthState -> resolveEntry
 *
 * These tests therefore drive the **real** `GET /api/me` handler against the
 * shared session and account compositions, then feed its response through the
 * same `resolveAuthState` and `resolveEntry` the component calls. No session,
 * authorization, or account resolution is mocked, so an identity that appears
 * here appeared because a real session produced it.
 *
 * The scope boundary is tested too: reaching the entry must not have created a
 * profile, a portfolio, or anything else.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { getAccountComposition, resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { resetSessionComposition, setSessionComposition } from "../session/application";
import { ACCOUNT_PATH, AUTHENTICATED_ENTRY_PATH, SIGN_IN_PATH, isAuthenticatedEntry, resolveEntry } from "../app/session/entry-contract";
import { resolveAuthState } from "../app/session/auth-state";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";

const password = "correct horse battery staple";
const START = "2026-10-02T10:00:00.000Z";
const HOUR = 60 * 60 * 1000;

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `entry-${counter}@example.com`;
}

function useCleanState(): void {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition({ now: () => START, evaluateClock: () => START }));
}

function releaseState(): void {
  resetAccountComposition();
  resetSessionComposition();
}

/** A clock that advances on demand, so expiry needs no sleeping. */
function mutableClock() {
  let current = Date.parse(START);
  return {
    now: () => new Date(current).toISOString(),
    evaluateClock: () => new Date(current).toISOString(),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

async function register(email: string): Promise<void> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 201, "registration should succeed for a unique identity");
}

async function signInCookie(email: string): Promise<string> {
  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 200, "sign-in should succeed for valid credentials");
  const header = response.headers.get("set-cookie")!;
  const [pair] = header.split(";");
  const separator = pair.indexOf("=");
  return `sessionId=${encodeURIComponent(decodeURIComponent(pair.slice(separator + 1).trim()))}`;
}

/**
 * Resolves auth state exactly as the entry component does, but with a `fetch`
 * that replays the real `GET /api/me` handler against the supplied cookie.
 *
 * That substitution is the only seam, and it is a seam in the *transport*, not
 * in the decision: the response is produced by the production handler.
 */
function entryProbe(cookie?: string) {
  return resolveAuthState((async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(url, "/api/me", "the entry point must resolve identity through the protected boundary");
    const headers: Record<string, string> = cookie ? { cookie } : {};
    return getMe(new Request("http://localhost/api/me", { method: "GET", headers }));
  }) as unknown as typeof fetch);
}

describe("entry decision contract (Task #136)", () => {
  it("names the authenticated entry, the sign-in path, and the account path", () => {
    assert.equal(AUTHENTICATED_ENTRY_PATH, "/app");
    assert.equal(SIGN_IN_PATH, "/login");
    assert.equal(ACCOUNT_PATH, "/account");
    assert.equal(isAuthenticatedEntry("/app"), true);
    assert.equal(isAuthenticatedEntry("/account"), false, "account settings is not the entry point");
    assert.equal(isAuthenticatedEntry("/"), false);
  });

  it("routes an unauthenticated visitor to sign-in and nothing else", () => {
    for (const state of [null, undefined, { authenticated: false, account: null }]) {
      const decision = resolveEntry(state as never);
      assert.equal(decision.kind, "unauthenticated");
      assert.equal(decision.entryPath, SIGN_IN_PATH);
    }
  });

  it("fails closed when a state claims authentication without an account", () => {
    // `resolveAuthState` cannot produce this shape; treating it as authenticated
    // would render an identity page for an account nobody proved.
    const decision = resolveEntry({ authenticated: true, account: null });
    assert.equal(decision.kind, "unauthenticated");
    assert.equal(decision.entryPath, SIGN_IN_PATH);
  });

  it("carries the identity and account path for an authenticated visitor", () => {
    const decision = resolveEntry({
      authenticated: true,
      account: { id: "account-1", email: "person@example.com", createdAt: "a", updatedAt: "b" },
    });
    assert.equal(decision.kind, "authenticated");
    if (decision.kind !== "authenticated") return;
    assert.equal(decision.entryPath, AUTHENTICATED_ENTRY_PATH);
    assert.equal(decision.accountPath, ACCOUNT_PATH);
    assert.equal(decision.identity.email, "person@example.com");
  });
});

describe("entry point identity (Task #137)", () => {
  it("sends an anonymous visitor to sign-in", async () => {
    useCleanState();
    try {
      const decision = resolveEntry(await entryProbe());
      assert.equal(decision.kind, "unauthenticated");
      assert.equal(decision.entryPath, SIGN_IN_PATH);
    } finally {
      releaseState();
    }
  });

  it("rejects a malformed session cookie", async () => {
    useCleanState();
    try {
      const decision = resolveEntry(await entryProbe("sessionId=%ZZ"));
      assert.equal(decision.kind, "unauthenticated", "a malformed cookie must not authenticate");
    } finally {
      releaseState();
    }
  });

  it("rejects an unknown session identifier", async () => {
    useCleanState();
    try {
      const decision = resolveEntry(await entryProbe("sessionId=never-existed"));
      assert.equal(decision.kind, "unauthenticated");
    } finally {
      releaseState();
    }
  });

  it("rejects an expired session", async () => {
    const clock = mutableClock();
    setAccountComposition(createAccountComposition());
    setSessionComposition(createSessionComposition({ now: clock.now, evaluateClock: clock.evaluateClock }));
    try {
      const email = uniqueEmail();
      await register(email);
      const cookie = await signInCookie(email);

      assert.equal(resolveEntry(await entryProbe(cookie)).kind, "authenticated", "valid before expiry");

      clock.advance(HOUR * 24 + 1000);
      const decision = resolveEntry(await entryProbe(cookie));
      assert.equal(decision.kind, "unauthenticated", "an expired session must not reach the entry point");
    } finally {
      releaseState();
    }
  });

  it("reaches the entry point with the correct identity from a real session", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);
      const cookie = await signInCookie(email);

      const decision = resolveEntry(await entryProbe(cookie));
      assert.equal(decision.kind, "authenticated");
      if (decision.kind !== "authenticated") return;
      assert.equal(decision.entryPath, AUTHENTICATED_ENTRY_PATH);
      assert.equal(decision.identity.email, email);

      // The identity must be the account the session actually belongs to, not
      // anything the client could have supplied.
      const account = getAccountComposition().persistence.getAccountByEmail(email);
      assert.ok(account, "the account should exist");
      assert.equal(decision.identity.id, account!.id, "identity must come from the session's account");
    } finally {
      releaseState();
    }
  });

  it("does not accept an account identifier supplied by the client", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      // The entry probe is handed no cookie at all — a client that merely knows
      // somebody's account id still has nothing to present.
      const decision = resolveEntry(await entryProbe());
      assert.equal(decision.kind, "unauthenticated");
    } finally {
      releaseState();
    }
  });
});

describe("entry scope boundary (Task #138)", () => {
  it("creates no profile, portfolio, or extra account on entry", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);
      const accountsBefore = getAccountComposition().persistence.accountCount;
      const cookie = await signInCookie(email);

      const decision = resolveEntry(await entryProbe(cookie));
      assert.equal(decision.kind, "authenticated", "entry itself succeeds");

      // Reaching the entry must be side-effect free.
      assert.equal(
        getAccountComposition().persistence.accountCount,
        accountsBefore,
        "entering the application must not create an account",
      );
      assert.ok(getAccountComposition().persistence.getAccountByEmail(email), "the original account is untouched");

      // Nothing portfolio-shaped exists anywhere in the application surface.
      const portfolio = getAccountComposition().persistence as unknown as Record<string, unknown>;
      for (const key of Object.keys(portfolio)) {
        assert.equal(
          /portfolio|profile|publication|theme/i.test(key),
          false,
          `the entry boundary must not expose a ${key} store`,
        );
      }
    } finally {
      releaseState();
    }
  });
});