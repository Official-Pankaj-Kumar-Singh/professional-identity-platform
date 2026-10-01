/**
 * @file config-tests/logout.test.ts
 *
 * Task #108 — logout and session invalidation tests.
 *
 * These exercise the real `POST /logout` handler at the HTTP boundary and prove
 * the property the story actually needs: that the session identifier a browser
 * held before logout stops authenticating against the real protected resource
 * `GET /api/me` afterwards.
 *
 * The full lifecycle is driven through production boundaries and nothing is
 * injected into the handlers:
 *
 *   register -> sign in -> GET /api/me (200) -> POST /logout -> GET /api/me (401)
 *
 * The crucial assertion is the last one, and it deliberately replays the *old*
 * session identifier rather than the cleared cookie. If logout only cleared the
 * cookie, that request would still succeed — the test would fail, which is what
 * makes it a real proof of server-side invalidation instead of a restatement of
 * what the route returned.
 *
 * Authentication boundary coverage belongs to Task #111 and is not duplicated
 * here. Ownership, 403 behaviour, session expiry, refresh, and persistence
 * belong to Tasks #118–#120 and #112–#117 respectively; this suite claims none
 * of them. Only `active` sessions and explicit termination are in scope.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { resetSessionComposition, setSessionComposition } from "../session/application";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn, SESSION_COOKIE_NAME } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";
import { POST as logout } from "../app/logout/route";
import {
  LOGOUT_GENERIC_ERROR,
  LOGOUT_SUCCESS_MESSAGE,
  toLogoutFeedback,
} from "../app/logout/logout-form-rules";

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

let emailPart = 0;
function uniqueEmail(): string {
  emailPart += 1;
  return `logout-${emailPart}@example.com`;
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

interface CookiePair {
  /** The full `Set-Cookie` value, as a browser would receive it. */
  readonly header: string;
  /** The identifier alone, decoded. */
  readonly value: string;
}

/** Registers and signs in through the real endpoints, returning the live cookie. */
async function authenticate(email: string): Promise<CookiePair> {
  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 200, "sign-in should succeed for valid credentials");

  const header = response.headers.get("set-cookie");
  assert.notEqual(header, null, "a successful sign-in must issue a session cookie");
  const [pair] = header!.split(";");
  const separator = pair.indexOf("=");
  assert.notEqual(separator, -1, "cookie header should contain a name=value pair");
  return { header: header!, value: decodeURIComponent(pair.slice(separator + 1).trim()) };
}

function getMeWithCookie(cookie: string): Promise<Response> {
  return getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie } }));
}

interface LogoutBody {
  ok: boolean;
  destroyed?: boolean;
  error?: { code: string; message: string };
}

interface MeBody {
  ok: boolean;
  account?: { id: string; email: string };
  error?: { code: string; message: string };
}

async function logoutWithCookie(cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = cookie;
  return logout(new Request("http://localhost/logout", { method: "POST", headers }));
}

/**
 * Asserts the `Set-Cookie` header really instructs cookie *deletion*, rather than
 * merely being present. Presence alone would pass for a header that re-issues the
 * cookie unchanged, which is the failure mode this test exists to catch.
 */
function assertCookieCleared(header: string | null): void {
  assert.notEqual(header, null, "logout must send a Set-Cookie header");
  assert.match(header!, new RegExp(`^${SESSION_COOKIE_NAME}=;`), "cleared cookie must carry an empty value");
  assert.match(header!, /Max-Age=0\b/, "cleared cookie must expire immediately via Max-Age=0");
  assert.match(header!, /Expires=Thu, 01 Jan 1970/, "cleared cookie must carry a past expiry date");
  // The attributes that decide which cookie the browser replaces must still match
  // the ones set at sign-in, or the original cookie would survive untouched.
  assert.match(header!, /Path=\//, "cleared cookie must keep the sign-in path or it matches nothing");
  assert.match(header!, /HttpOnly/, "cleared cookie must keep HttpOnly");
  assert.match(header!, /SameSite=Lax/, "cleared cookie must keep the sign-in SameSite policy");
}

describe("logout session termination (Task #108)", () => {
  it("authenticates before logout and rejects the same identifier afterwards", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const cookie = await authenticate(email);

      // BEFORE: the session is live and the protected resource answers 200.
      const before = await getMeWithCookie(cookie.header);
      assert.equal(before.status, 200);
      const beforeBody = (await before.json()) as MeBody;
      assert.equal(beforeBody.ok, true);
      assert.equal(beforeBody.account?.email, email, "the pre-logout session must be the account's own");

      // LOGOUT: the session is terminated and the cookie is cleared.
      const loggedOut = await logoutWithCookie(cookie.header);
      assert.equal(loggedOut.status, 200);
      const logoutBody = (await loggedOut.json()) as LogoutBody;
      assert.equal(logoutBody.ok, true);
      assert.equal(logoutBody.destroyed, true, "a live session must actually be destroyed");
      assertCookieCleared(loggedOut.headers.get("set-cookie"));

      // AFTER: the *old* identifier, replayed. This is the proof of server-side
      // invalidation — clearing a cookie cannot make this request fail.
      const after = await getMeWithCookie(cookie.header);
      assert.equal(after.status, 401, "a terminated session must no longer authenticate");
      const afterBody = (await after.json()) as MeBody;
      assert.equal(afterBody.ok, false);
      assert.equal(afterBody.error?.code, "unauthenticated");
      assert.equal(afterBody.account, undefined, "no private account data may be returned after logout");
    } finally {
      releaseCompositions();
    }
  });

  it("terminates only the session that was logged out", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const first = await authenticate(email);
      const second = await authenticate(email);

      assert.notEqual(first.value, second.value, "each sign-in must mint a distinct session");

      await logoutWithCookie(first.header);

      assert.equal((await getMeWithCookie(first.header)).status, 401, "the logged-out session must be rejected");
      assert.equal((await getMeWithCookie(second.header)).status, 200, "an unrelated session must survive logout");
    } finally {
      releaseCompositions();
    }
  });

  it("is idempotent when no session is presented", async () => {
    useCleanCompositions();
    try {
      const response = await logoutWithCookie();

      assert.equal(response.status, 200, "logging out when already signed out is a success, not an error");
      const body = (await response.json()) as LogoutBody;
      assert.equal(body.ok, true);
      assert.equal(body.destroyed, false, "there was no session to destroy");
      assertCookieCleared(response.headers.get("set-cookie"));
    } finally {
      releaseCompositions();
    }
  });

  it("treats repeated logout of the same session as a success", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);
      const cookie = await authenticate(email);

      const first = await logoutWithCookie(cookie.header);
      assert.equal(((await first.json()) as LogoutBody).destroyed, true);

      const second = await logoutWithCookie(cookie.header);
      assert.equal(second.status, 200);
      assert.equal(((await second.json()) as LogoutBody).destroyed, false, "the session was already terminated");

      assert.equal((await getMeWithCookie(cookie.header)).status, 401);
    } finally {
      releaseCompositions();
    }
  });

  it("clears the cookie and succeeds for an undecodable cookie instead of erroring", async () => {
    useCleanCompositions();
    try {
      const response = await logoutWithCookie("sessionId=%ZZ");

      assert.equal(response.status, 200, "a malformed cookie must not produce a server error");
      assert.equal(((await response.json()) as LogoutBody).ok, true);
      assertCookieCleared(response.headers.get("set-cookie"));
    } finally {
      releaseCompositions();
    }
  });

  it("clears the cookie and succeeds for an already-unknown session", async () => {
    useCleanCompositions();
    try {
      const response = await logoutWithCookie(`${SESSION_COOKIE_NAME}=never-existed`);

      assert.equal(response.status, 200);
      const body = (await response.json()) as LogoutBody;
      assert.equal(body.ok, true);
      assert.equal(body.destroyed, false);
      assertCookieCleared(response.headers.get("set-cookie"));
    } finally {
      releaseCompositions();
    }
  });

  it("does not disturb accounts or expose private data when logging out", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);
      const cookie = await authenticate(email);

      await logoutWithCookie(cookie.header);

      // Termination must be scoped to the session. The account itself is untouched,
      // so the user can sign straight back in.
      const again = await authenticate(email);
      assert.equal((await getMeWithCookie(again.header)).status, 200, "the account survives logout");
    } finally {
      releaseCompositions();
    }
  });
});

describe("logout feedback rules (Task #107)", () => {
  it("reports success for a successful logout without leaking the destroyed flag", () => {
    const feedback = toLogoutFeedback({ ok: true, destroyed: false });
    assert.deepEqual(feedback, { ok: true });
    assert.equal(LOGOUT_SUCCESS_MESSAGE.length > 0, true);
  });

  it("renders the server message for the one renderable failure code", () => {
    const feedback = toLogoutFeedback({
      ok: false,
      error: { code: "storage-failure", message: "We could not sign you out right now." },
    });
    assert.deepEqual(feedback, { ok: false, message: "We could not sign you out right now." });
  });

  it("falls back to a local message for every other code and unusable body", () => {
    for (const payload of [
      { ok: false, error: { code: "unexpected", message: "replica vault-7 refused" } },
      { ok: false, error: { code: "storage-failure", message: "   " } },
      { ok: false },
      null,
      undefined,
    ]) {
      assert.deepEqual(toLogoutFeedback(payload as never), { ok: false, message: LOGOUT_GENERIC_ERROR });
    }
  });
});