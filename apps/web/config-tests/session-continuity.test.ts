/**
 * @file config-tests/session-continuity.test.ts
 *
 * Task #114 — session continuity, renewal, and expiration.
 *
 * Every test here drives the real HTTP boundary with a deterministic clock. Time
 * is injected through `createSessionComposition({ now, evaluateClock })` — the
 * seam added in Task #113 — so expiration is exercised by moving a variable
 * rather than by sleeping. Nothing in this file waits on wall-clock time, and no
 * test asserts that a method was merely called.
 *
 * The continuity property under test is the user story: a user who keeps working
 * is not signed out, and a user who stops is. Both halves are checked, because
 * sliding renewal that never expires would satisfy only the first half.
 *
 * Authentication boundary coverage (missing, malformed, and unknown cookies)
 * belongs to Task #111 and is not duplicated. Ownership is not touched here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { getSessionComposition, resetSessionComposition, setSessionComposition } from "../session/application";
import { SESSION_LIFETIME_MS } from "../session/policy";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";

const password = "correct horse battery staple";
const HOUR = 60 * 60 * 1000;
const START = "2026-10-01T12:00:00.000Z";

/**
 * A controllable clock shared by the composition and by the assertions.
 *
 * `now` issues and stamps sessions; `evaluateClock` decides whether a session is
 * still valid. Both must move together, because a test that advanced only one
 * would be measuring the seam rather than the policy.
 */
function fixedClock(startIso: string = START) {
  let current = Date.parse(startIso);
  return {
    now: () => new Date(current).toISOString(),
    evaluateClock: () => new Date(current).toISOString(),
    advance(ms: number) {
      current += ms;
    },
    get iso(): string {
      return new Date(current).toISOString();
    },
  };
}

interface Harness {
  clock: ReturnType<typeof fixedClock>;
  sessionId: string;
  email: string;
}

/** Registers, signs in, and returns the live cookie plus a controllable clock. */
async function signInWithClock(email: string, clock: ReturnType<typeof fixedClock>): Promise<Harness> {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition({ now: clock.now, evaluateClock: clock.evaluateClock }));

  const registered = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(registered.status, 201, "registration should succeed for a unique identity");

  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.notEqual(header, null, "sign-in must issue a session cookie");

  const [pair] = header!.split(";");
  const separator = pair.indexOf("=");
  const sessionId = decodeURIComponent(pair.slice(separator + 1).trim());
  return { clock, sessionId, email };
}

function cookieHeader(sessionId: string): string {
  return `sessionId=${encodeURIComponent(sessionId)}`;
}

function me(sessionId: string): Promise<Response> {
  return getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie: cookieHeader(sessionId) } }));
}

interface MeBody {
  ok: boolean;
  account?: { id: string; email: string };
  error?: { code: string; message: string };
}

async function bodyOf(response: Response): Promise<MeBody> {
  return (await response.json()) as MeBody;
}

/** The `Max-Age` declared by a `Set-Cookie` header, or null when absent. */
function maxAgeOf(response: Response): number | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  const match = /Max-Age=(\d+)/.exec(header);
  return match ? Number(match[1]) : null;
}

function release(): void {
  resetAccountComposition();
  resetSessionComposition();
}

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `continuity-${counter}@example.com`;
}

describe("session continuity (Task #114)", () => {
  it("keeps a session valid across repeated authenticated requests", async () => {
    const clock = fixedClock();
    try {
      const { sessionId, email } = await signInWithClock(uniqueEmail(), clock);

      // Three separate authenticated requests, spaced across the lifetime, each
      // reusing the same session. Nothing is re-created between them, which is
      // what makes this continuity rather than three fresh sign-ins.
      for (let step = 1; step <= 3; step += 1) {
        clock.advance(HOUR);
        const response = await me(sessionId);
        assert.equal(response.status, 200, `request ${step} must stay authenticated`);
        assert.equal((await bodyOf(response)).account?.email, email);
      }
    } finally {
      release();
    }
  });

  it("slides the expiry forward on each authenticated request", async () => {
    const clock = fixedClock();
    try {
      const { sessionId } = await signInWithClock(uniqueEmail(), clock);

      const original = await getSessionComposition().evaluate(sessionId);
      assert.equal(original.status, "active");
      const originalExpiry = original.session!.expiresAt;

      const first = await me(sessionId);
      assert.equal(first.status, 200);
      // Sliding renewal always grants a full fresh window, so the cookie declares
      // the whole lifetime from now rather than the remainder of the old one.
      // The observable that renewal happened is the stored expiry moving forward.
      assert.equal(maxAgeOf(first), Math.floor(SESSION_LIFETIME_MS / 1000));

      // Advance to just before the ORIGINAL expiry. If renewal did nothing, this
      // request would be rejected.
      clock.advance(SESSION_LIFETIME_MS - 1000);
      const justBefore = await me(sessionId);
      assert.equal(justBefore.status, 200, "a session must remain valid right up to its renewed expiry");

      const renewed = await getSessionComposition().evaluate(sessionId);
      assert.equal(renewed.status, "active");
      assert.ok(
        Date.parse(renewed.session!.expiresAt) > Date.parse(originalExpiry),
        "renewal must move the stored expiry forward",
      );
      assert.equal(renewed.session!.updatedAt, clock.iso, "renewal stamps last use");

      // And past the original deadline the session is still valid, which is the
      // whole point of sliding renewal.
      clock.advance(2 * 1000);
      assert.equal((await me(sessionId)).status, 200, "the original deadline must no longer apply");
    } finally {
      release();
    }
  });

  it("expires an idle session and rejects it on the protected resource", async () => {
    const clock = fixedClock();
    try {
      const { sessionId } = await signInWithClock(uniqueEmail(), clock);

      assert.equal((await me(sessionId)).status, 200, "the session starts active");

      // No requests at all: renewal cannot happen, so the original expiry stands.
      clock.advance(SESSION_LIFETIME_MS);

      const after = await me(sessionId);
      assert.equal(after.status, 401, "an idle session must expire on schedule");
      const body = await bodyOf(after);
      assert.equal(body.ok, false);
      assert.equal(body.account, undefined, "an expired session must not return private data");
    } finally {
      release();
    }
  });

  it("does not resurrect an expired session on later requests", async () => {
    const clock = fixedClock();
    try {
      const { sessionId } = await signInWithClock(uniqueEmail(), clock);

      clock.advance(SESSION_LIFETIME_MS);
      assert.equal((await me(sessionId)).status, 401, "the session expires");

      // Replaying the same credential repeatedly must stay rejected. If renewal
      // could extend an expired session, this is where it would show.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        clock.advance(HOUR);
        const again = await me(sessionId);
        assert.equal(again.status, 401, "an expired session must never be restored");
        assert.equal((await bodyOf(again)).account, undefined);
      }
    } finally {
      release();
    }
  });

  it("keeps an active session alive past its original lifetime through renewal", async () => {
    const clock = fixedClock();
    try {
      const { sessionId } = await signInWithClock(uniqueEmail(), clock);

      // Work steadily for longer than one full lifetime. Each request renews, so
      // the session must survive even though the elapsed time exceeds the
      // original expiry — which is the "do not have to log in again" requirement.
      let elapsed = 0;
      for (let step = 0; step < 5; step += 1) {
        clock.advance(12 * HOUR);
        elapsed += 12 * HOUR;
        const response = await me(sessionId);
        assert.equal(response.status, 200, `an active user must not be signed out at +${elapsed / HOUR}h`);
      }
      assert.ok(elapsed > SESSION_LIFETIME_MS, "the test must span more than one lifetime");
    } finally {
      release();
    }
  });

  it("preserves the session identity across renewal", async () => {
    const clock = fixedClock();
    try {
      const { sessionId } = await signInWithClock(uniqueEmail(), clock);

      const renewed = await me(sessionId);
      assert.equal(renewed.status, 200);

      const header = renewed.headers.get("set-cookie")!;
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      const reissuedId = decodeURIComponent(pair.slice(separator + 1).trim());

      // Policy keeps the identifier stable, so the reissued cookie names the same
      // session. A rotating identifier would leave two live credentials per user.
      assert.equal(reissuedId, sessionId, "renewal must not rotate the session identifier");
    } finally {
      release();
    }
  });
});