/**
 * @file config-tests/sign-in-experience.test.ts
 *
 * Task #105 — the sign-in experience and its tests.
 *
 * The existing `sign-in.test.ts` covers Task #104 at the service layer: it calls
 * `createSignInService` directly and proves credential outcomes. That is the
 * right place for the credential contract and it is left untouched. It cannot
 * reach the two things this task is actually about, because both live above the
 * service:
 *
 * - the form's own decisions (whether it submits, and what it puts on screen),
 *   which live in `app/login/sign-in-form-rules.ts` as pure functions because
 *   the repository has no component-test setup; and
 * - whether a successful sign-in leaves the browser actually authenticated,
 *   which is a property of the real `/login` handler and the cookie it sets.
 *
 * The route-level tests below invoke the real `POST /api/login` handler exactly
 * once per call, so each call is its own request answered by the production
 * code. Nothing is injected into the handler: the session has to survive the
 * request that created it, which it can only do through the process-wide
 * composition. A handler that built its own session store per request would
 * still return 200 with a cookie here, and the assertion that the cookie
 * resolves to a live session is what would catch that.
 *
 * The session is checked through the session service directly, not through
 * `GET /api/me`. Protected-resource enforcement and its boundary tests belong
 * to Task #110 and Task #111 and are not touched here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { getSessionComposition, resetSessionComposition, setSessionComposition } from "../session/application";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn, SESSION_COOKIE_NAME } from "../app/api/login/route";
import {
  SIGN_IN_GENERIC_ERROR,
  SIGN_IN_SUCCESS_MESSAGE,
  toSignInFeedback,
  validateSignInFields,
} from "../app/login/sign-in-form-rules";

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
  return `signin-${emailPart}@example.com`;
}

function postSignIn(email: string, attempt: string = password): Promise<Response> {
  return signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: attempt }),
    }),
  );
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

interface SignInBody {
  ok: boolean;
  session?: { id: string; accountId: string; email: string; expiresAt: string };
  error?: { code: string; message: string };
}

async function bodyOf(response: Response): Promise<SignInBody> {
  return (await response.json()) as SignInBody;
}

/** The `Set-Cookie` header, or null when the response set no cookie. */
function setCookieOf(response: Response): string | null {
  return response.headers.get("set-cookie");
}

/** The value of the session cookie in a `Set-Cookie` header. */
function cookieValue(header: string): string {
  const [pair] = header.split(";");
  const separator = pair.indexOf("=");
  assert.notEqual(separator, -1, "cookie header should contain a name=value pair");
  return decodeURIComponent(pair.slice(separator + 1).trim());
}

describe("sign-in form rules (Task #105)", () => {
  it("blocks submission when a required field is empty", () => {
    assert.deepEqual(validateSignInFields({ email: "", password: "" }), {
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  it("treats whitespace-only email as empty and keeps a valid pair submittable", () => {
    assert.deepEqual(validateSignInFields({ email: "   ", password }), {
      email: "Enter your email address.",
    });
    assert.deepEqual(validateSignInFields({ email: " person@example.com ", password }), {});
  });

  it("does not apply the registration password minimum to a sign-in attempt", () => {
    // The 12-character rule governs creating a password. Reusing it here would
    // lock out any account whose password predates the rule, so a short
    // password must still be submitted and judged by the server.
    assert.deepEqual(validateSignInFields({ email: "person@example.com", password: "short" }), {});
  });

  it("reports a successful attempt without handing the session id to the page", () => {
    const feedback = toSignInFeedback({
      ok: true,
      session: { id: "session-secret", accountId: "account-1", email: "person@example.com", expiresAt: "2026-01-01T00:00:00.000Z" },
    });
    assert.deepEqual(feedback, { ok: true });
    assert.equal(JSON.stringify(feedback).includes("session-secret"), false);
    assert.equal(SIGN_IN_SUCCESS_MESSAGE.length > 0, true);
  });

  it("renders the non-disclosing server message and attributes it to no field", () => {
    const feedback = toSignInFeedback({ ok: false, error: { code: "invalid-credentials", message: "The email or password is incorrect." } });
    assert.deepEqual(feedback, { ok: false, message: "The email or password is incorrect." });
    // A field-level error here would tell the user their address is unknown.
    assert.equal("fieldErrors" in feedback, false);
  });

  it("falls back to a local message for every other code and for unusable bodies", () => {
    for (const payload of [
      { ok: false, error: { code: "storage-failure", message: "connection to vault-7 refused" } },
      { ok: false, error: { code: "credential-verification-failed", message: "scrypt params invalid" } },
      { ok: false, error: { code: "invalid-credentials", message: "   " } },
      { ok: false },
      null,
      undefined,
    ]) {
      assert.deepEqual(toSignInFeedback(payload as never), { ok: false, message: SIGN_IN_GENERIC_ERROR });
    }
  });
});

describe("sign-in session establishment (Task #105)", () => {
  it("signs in an account created through the real registration endpoint", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(`  ${email.toUpperCase()}  `);

      const response = await postSignIn(email);
      assert.equal(response.status, 200);

      const body = await bodyOf(response);
      assert.equal(body.ok, true);
      assert.equal(body.session?.email, email);
      assert.equal(typeof body.session?.accountId, "string");
    } finally {
      releaseCompositions();
    }
  });

  it("sets a hardened session cookie that resolves to a live session", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const response = await postSignIn(email);
      const header = setCookieOf(response);
      assert.notEqual(header, null, "a successful sign-in must establish browser state");

      assert.match(header!, new RegExp(`^${SESSION_COOKIE_NAME}=`));
      assert.match(header!, /HttpOnly/);
      assert.match(header!, /SameSite=Lax/);
      assert.match(header!, /Path=\//);
      assert.match(header!, /Max-Age=\d+/);

      // The point of the cookie: it names a session that outlived the request
      // that created it. Checked through the session service, because the
      // protected-resource boundary is Task #110's.
      const evaluation = await getSessionComposition().evaluate(cookieValue(header!));
      assert.equal(evaluation.status, "active");
      assert.ok(evaluation.session);
    } finally {
      releaseCompositions();
    }
  });

  it("carries no credential material in the cookie or the response body", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const response = await postSignIn(email);
      const header = setCookieOf(response)!;
      const raw = await response.text();

      for (const secret of [password, "scrypt$", "passwordHash"]) {
        assert.equal(header.includes(secret), false, `cookie must not carry ${secret}`);
        assert.equal(raw.includes(secret), false, `body must not carry ${secret}`);
      }
    } finally {
      releaseCompositions();
    }
  });

  it("sets no cookie and gives the identical answer for a wrong password and an unknown account", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const wrongPassword = await postSignIn(email, "definitely not the password");
      const unknownAccount = await postSignIn("nobody@example.com");

      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownAccount.status, 401);
      assert.deepEqual(await bodyOf(wrongPassword), await bodyOf(unknownAccount));
      assert.equal(setCookieOf(wrongPassword), null, "a rejected attempt must not authenticate the browser");
      assert.equal(setCookieOf(unknownAccount), null, "a rejected attempt must not authenticate the browser");
    } finally {
      releaseCompositions();
    }
  });

  it("rejects a malformed body without establishing any session", async () => {
    useCleanCompositions();
    try {
      const response = await signIn(
        new Request("http://localhost/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json at all",
        }),
      );
      assert.equal(response.status, 400);
      assert.equal(setCookieOf(response), null);
      assert.equal((await bodyOf(response)).error?.code, "invalid-credentials");
    } finally {
      releaseCompositions();
    }
  });

  it("leaves previously issued sessions untouched by a later failed attempt", async () => {
    useCleanCompositions();
    try {
      const email = uniqueEmail();
      await register(email);

      const first = await postSignIn(email);
      const firstCookie = setCookieOf(first)!;

      await postSignIn(email, "definitely not the password");

      const evaluation = await getSessionComposition().evaluate(cookieValue(firstCookie));
      assert.equal(evaluation.status, "active", "a failed retry must not revoke an existing session");
    } finally {
      releaseCompositions();
    }
  });
});
