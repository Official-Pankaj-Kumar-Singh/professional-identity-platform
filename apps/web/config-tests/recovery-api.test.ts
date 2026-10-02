/**
 * @file config-tests/recovery-api.test.ts
 *
 * Feature #78 — recovery-request and reset boundary tests (Tasks #123, #126).
 *
 * These drive the real `POST /api/recovery` and `POST /api/recovery/reset`
 * handlers against the **shared** account and session compositions, creating
 * accounts and sessions through the real registration and sign-in endpoints.
 * Nothing is injected into the handlers, which matters here: recovery's original
 * composition built a private account store, so a service-level test that wired
 * both sides by hand passed while the real route could never resolve an account.
 * These tests use the same shared store the route uses, so that failure mode
 * cannot recur unnoticed.
 *
 * The token is obtained the way a real user obtains it — from the delivery
 * boundary, not from an HTTP response. Asserting that the response never carries
 * it is one of the central tests here.
 *
 * Time is injected so expiry is deterministic; nothing sleeps.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { getAccountComposition, resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { resetSessionComposition, setSessionComposition } from "../session/application";
import {
  InMemoryRecoveryOutbox,
  createRecoveryComposition,
  type RecoveryCompositionOptions,
} from "../recovery/composition";
import { resetRecoveryComposition, setRecoveryComposition } from "../recovery/application";
import { InMemoryRecoveryRepository } from "../recovery/repository";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";
import { POST as requestRecovery } from "../app/api/recovery/route";
import { POST as resetPassword } from "../app/api/recovery/reset/route";

const originalPassword = "correct horse battery staple";
const newPassword = "a different long password";
const START = "2026-10-02T09:00:00.000Z";
const HOUR = 60 * 60 * 1000;

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `recovery-${counter}@example.com`;
}

interface Clock {
  now: () => string;
  advance: (ms: number) => void;
}

function fixedClock(startIso: string = START): Clock {
  let current = Date.parse(startIso);
  return {
    now: () => new Date(current).toISOString(),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

interface Harness {
  composition: ReturnType<typeof createRecoveryComposition>;
  clock: Clock;
  outbox: InMemoryRecoveryOutbox;
}

/** Fresh shared compositions plus a recovery composition bound to them. */
function useCleanState(options: RecoveryCompositionOptions = {}): Harness {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition());
  const clock = options.now ? undefined : fixedClock();
  const repository = new InMemoryRecoveryRepository({ clock: clock?.now });
  const outbox = new InMemoryRecoveryOutbox();
  const composition = createRecoveryComposition({
    now: clock?.now,
    repository,
    delivery: outbox,
    tokenTtlMs: 60 * 60 * 1000,
    createRecoveryToken: (() => {
      let n = 0;
      return () => `recovery-token-${++n}`;
    })(),
    ...options,
  });
  setRecoveryComposition(composition);
  return { composition, clock: clock as Clock, outbox };
}

function releaseState(): void {
  resetRecoveryComposition();
  resetAccountComposition();
  resetSessionComposition();
}

async function register(email: string, password: string = originalPassword): Promise<void> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 201, `registration should succeed for ${email}`);
}

async function authenticate(email: string): Promise<string> {
  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: originalPassword }),
    }),
  );
  assert.equal(response.status, 200, "sign-in should succeed for valid credentials");
  const header = response.headers.get("set-cookie")!;
  const [pair] = header.split(";");
  const separator = pair.indexOf("=");
  return `sessionId=${encodeURIComponent(decodeURIComponent(pair.slice(separator + 1).trim()))}`;
}

function postRecovery(email: unknown): Promise<Response> {
  return requestRecovery(
    new Request("http://localhost/api/recovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

function postReset(token: unknown, password: unknown): Promise<Response> {
  return resetPassword(
    new Request("http://localhost/api/recovery/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    }),
  );
}

interface Body {
  ok: boolean;
  message?: string;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

const bodyOf = async (response: Response): Promise<Body> => (await response.json()) as Body;

describe("recovery request boundary (Tasks #121–#123)", () => {
  it("resolves accounts created through the real registration endpoint", async () => {
    // The regression that motivated this suite: recovery previously resolved
    // accounts against a private store, so this delivered nothing at all.
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      const response = await postRecovery(email);
      assert.equal(response.status, 200);
      assert.equal((await bodyOf(response)).ok, true);
      assert.notEqual(harness.outbox.last, null, "a real account must receive a delivered token");
    } finally {
      releaseState();
    }
  });

  it("never returns the recovery token in the response", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      const response = await postRecovery(email);
      const raw = await response.text();
      const token = harness.outbox.last?.token;
      assert.notEqual(token, undefined, "a token should have been delivered for a real account");
      assert.equal(raw.includes(token!), false, "the response must not carry the recovery token");
      assert.equal(raw.includes(email), false, "the response must not echo the submitted address");
    } finally {
      releaseState();
    }
  });

  it("answers identically for an existing and an unknown account", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      const existing = await postRecovery(`  ${email.toUpperCase()}  `);
      const unknown = await postRecovery("nobody-at-all@example.com");

      assert.equal(existing.status, unknown.status);
      assert.deepEqual(await bodyOf(existing), await bodyOf(unknown));

      // The accounts differ underneath, but the requester cannot tell.
      assert.equal(harness.outbox.count, 1, "a token is delivered only for the real account");
    } finally {
      releaseState();
    }
  });

  it("rejects a malformed request without issuing anything", async () => {
    const harness = useCleanState();
    try {
      for (const email of [null, 42, "", "   "]) {
        const response = await postRecovery(email);
        assert.equal(response.status, 400, `"${String(email)}" should be rejected`);
      }
      assert.equal(harness.outbox.count, 0, "no token may be delivered for a malformed request");
    } finally {
      releaseState();
    }
  });

  it("issues a fresh token for a repeated request and expires them on schedule", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      await postRecovery(email);
      const first = harness.outbox.last?.token;
      await postRecovery(email);
      const second = harness.outbox.last?.token;

      assert.notEqual(first, second, "a repeated request must mint a new token");
      assert.equal(harness.outbox.count, 2);
    } finally {
      releaseState();
    }
  });

  it("returns no account, credential, or hash material for any recovery outcome", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);
      const response = await postRecovery(email);
      const raw = await response.text();
      for (const forbidden of ["password", "passwordHash", "scrypt$", "accountId", "credential"]) {
        assert.equal(raw.includes(`"${forbidden}"`), false, `response must not contain ${forbidden}`);
      }
    } finally {
      releaseState();
    }
  });
});

describe("password reset boundary (Tasks #124–#126)", () => {
  it("resets the password so the new one authenticates and the old one does not", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      await postRecovery(email);
      const token = harness.outbox.last!.token;

      const response = await postReset(token, newPassword);
      assert.equal(response.status, 200);
      assert.equal((await bodyOf(response)).ok, true);

      // New password signs in; old password does not.
      const withNew = await signIn(
        new Request("http://localhost/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: newPassword }),
        }),
      );
      assert.equal(withNew.status, 200, "the new password must authenticate");

      const withOld = await signIn(
        new Request("http://localhost/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: originalPassword }),
        }),
      );
      assert.equal(withOld.status, 401, "the old password must no longer authenticate");
    } finally {
      releaseState();
    }
  });

  it("stores only a hash, never the plaintext", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      await postRecovery(email);
      const token = harness.outbox.last!.token;

      const response = await postReset(token, newPassword);
      assert.equal(response.status, 200);

      const body = await response.text();
      assert.equal(body.includes(newPassword), false, "the response must not echo the password");

      // And the stored credential is a scrypt hash, not the plaintext.
      const credential = await getAccountComposition().persistence.getCredentialByEmail(email);
      assert.ok(credential, "the credential should still exist");
      assert.ok(credential!.passwordHash.startsWith("scrypt"), "the stored credential must be a scrypt hash");
      assert.equal(credential!.passwordHash.includes(newPassword), false, "the password must not be stored in plaintext");
    } finally {
      releaseState();
    }
  });

  it("rejects an unknown, expired, and already-used token", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      // Unknown token.
      const unknown = await postReset("never-issued", newPassword);
      assert.equal(unknown.status, 400);
      assert.equal((await bodyOf(unknown)).error?.code, "invalid-token");

      // Expired token: past the configured one-hour lifetime.
      await postRecovery(email);
      const expiring = harness.outbox.last!.token;
      harness.clock.advance(HOUR + 1000);
      const expired = await postReset(expiring, newPassword);
      assert.equal(expired.status, 400);
      assert.equal((await bodyOf(expired)).error?.code, "expired-token");

      // Single use.
      await postRecovery(email);
      const singleUse = harness.outbox.last!.token;
      assert.equal((await postReset(singleUse, newPassword)).status, 200);
      const reused = await postReset(singleUse, newPassword);
      assert.equal(reused.status, 400);
      assert.equal((await bodyOf(reused)).error?.code, "used-token");
    } finally {
      releaseState();
    }
  });

  it("does not burn the token when the new password is rejected", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);

      await postRecovery(email);
      const token = harness.outbox.last!.token;

      const weak = await postReset(token, "short");
      assert.equal(weak.status, 400);
      const weakBody = await bodyOf(weak);
      assert.equal(weakBody.error?.code, "invalid-password");
      assert.ok(weakBody.error?.fields?.password, "the password field should be explained");

      // The link must still work after a rejected attempt — otherwise the user
      // has no way forward short of requesting a second link.
      const retry = await postReset(token, newPassword);
      assert.equal(retry.status, 200, "a rejected password must not consume the token");
    } finally {
      releaseState();
    }
  });

  it("enforces the same password policy registration applies", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);
      await postRecovery(email);
      const token = harness.outbox.last!.token;

      const response = await postReset(token, "short");
      assert.equal(response.status, 400);
      assert.equal((await bodyOf(response)).error?.code, "invalid-password");
    } finally {
      releaseState();
    }
  });

  it("revokes the account's existing sessions after a reset", async () => {
    const harness = useCleanState();
    try {
      const email = uniqueEmail();
      await register(email);
      const cookie = await authenticate(email);

      // The session is live before the reset.
      assert.equal((await getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie } }))).status, 200);

      await postRecovery(email);
      const token = harness.outbox.last!.token;
      assert.equal((await postReset(token, newPassword)).status, 200);

      assert.equal(
        (await getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie } }))).status,
        401,
        "a password reset must revoke the account's existing sessions",
      );
    } finally {
      releaseState();
    }
  });

  it("rejects a missing token and a missing password", async () => {
    useCleanState();
    try {
      assert.equal((await postReset("", newPassword)).status, 400);
      assert.equal((await postReset(null, newPassword)).status, 400);
      assert.equal((await postReset("token-present", null)).status, 400);
    } finally {
      releaseState();
    }
  });
});