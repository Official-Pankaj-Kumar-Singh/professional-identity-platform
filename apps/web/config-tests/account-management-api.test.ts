/**
 * @file config-tests/account-management-api.test.ts
 *
 * Feature #79 — account resource boundary tests (Tasks #129, #132, #135).
 *
 * These drive the real `GET`/`PATCH`/`DELETE` handlers of `/api/accounts/[id]`
 * against the shared account and session compositions, using the real
 * registration and sign-in endpoints to create accounts and sessions. Nothing is
 * injected into the handlers.
 *
 * The tests that matter most are the cross-account ones. Previously the
 * authorization primitive's `forbidden` branch could not be reached from any
 * HTTP boundary, because `/api/me` derives its account from the session and
 * accepts no identifier. These tests reach it through a real request that names
 * another account, which is the property Tasks #87, #119, and #120 require.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { createSessionComposition } from "../session/composition";
import { resetSessionComposition, setSessionComposition } from "../session/application";
import { resetAccountManagementService } from "../account-management/application";
import { validateAccountPatch } from "../account-management/update-validation";
import {
  ACCOUNT_GENERIC_ERROR,
  isConfirmedDeletion,
  toAccountFeedback,
  validateEmailChange,
} from "../app/account/account-rules";
import { POST as registerAccount } from "../app/api/register/route";
import { POST as signIn } from "../app/api/login/route";
import { GET as getMe } from "../app/api/me/route";
import { DELETE as deleteAccount, GET as getAccount, PATCH as patchAccount } from "../app/api/accounts/[id]/route";

const password = "correct horse battery staple";

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `acct-mgmt-${counter}@example.com`;
}

/** Fresh compositions for one test. The management service must be reset too. */
function useCleanState(): void {
  setAccountComposition(createAccountComposition());
  setSessionComposition(createSessionComposition());
  resetAccountManagementService();
}

function releaseState(): void {
  resetAccountManagementService();
  resetAccountComposition();
  resetSessionComposition();
}

/** Registers through the real endpoint and returns the account id. */
async function register(email: string): Promise<string> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 201, "registration should succeed for a unique identity");
  const body = (await response.json()) as { account: { id: string } };
  return body.account.id;
}

/** Signs in through the real endpoint and returns the cookie and account id. */
async function authenticate(email: string): Promise<{ cookie: string; accountId: string }> {
  const response = await signIn(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  assert.equal(response.status, 200, "sign-in should succeed for valid credentials");
  const header = response.headers.get("set-cookie");
  assert.notEqual(header, null, "sign-in must issue a session cookie");
  const [pair] = header!.split(";");
  const separator = pair.indexOf("=");
  const sessionId = decodeURIComponent(pair.slice(separator + 1).trim());

  const me = await getMe(
    new Request("http://localhost/api/me", { method: "GET", headers: { cookie: `sessionId=${encodeURIComponent(sessionId)}` } }),
  );
  assert.equal(me.status, 200);
  const meBody = (await me.json()) as { account: { id: string } };
  return { cookie: `sessionId=${encodeURIComponent(sessionId)}`, accountId: meBody.account.id };
}

/** Registers and signs in, returning both. Use whenever an actor is needed. */
async function registerAndAuthenticate(email: string): Promise<{ cookie: string; accountId: string }> {
  await register(email);
  return authenticate(email);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface AccountBody {
  ok: boolean;
  account?: { id: string; email: string; createdAt: string; updatedAt: string };
  error?: { code: string; message: string; fields?: Record<string, string> };
  deleted?: boolean;
}

describe("account resource boundary — read (Tasks #127–#129)", () => {
  it("returns the account to its authenticated holder", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      const response = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(id));
      assert.equal(response.status, 200);
      const body = (await response.json()) as AccountBody;
      assert.equal(body.ok, true);
      assert.equal(body.account?.id, id);
      assert.equal(body.account?.email, email);
    } finally {
      releaseState();
    }
  });

  it("rejects an unauthenticated read", async () => {
    useCleanState();
    try {
      const id = await register(uniqueEmail());
      const response = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET" }), params(id));
      assert.equal(response.status, 401);
      assert.equal(((await response.json()) as AccountBody).error?.code, "unauthenticated");
    } finally {
      releaseState();
    }
  });

  it("reports an unknown account as not found", async () => {
    useCleanState();
    try {
      const { cookie } = await registerAndAuthenticate(uniqueEmail());
      const response = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params("does-not-exist"));
      assert.equal(response.status, 404);
      assert.equal(((await response.json()) as AccountBody).error?.code, "not-found");
    } finally {
      releaseState();
    }
  });

  it("refuses another user's account even when authenticated", async () => {
    useCleanState();
    try {
      const victimEmail = uniqueEmail();
      const victimId = await register(victimEmail);
      const { cookie } = await registerAndAuthenticate(uniqueEmail());

      // The real cross-account read. This is the forbidden path that was
      // unreachable before this resource boundary existed.
      const response = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(victimId));
      assert.equal(response.status, 403);
      const body = (await response.json()) as AccountBody;
      assert.equal(body.error?.code, "forbidden");
      assert.equal(body.account, undefined, "another account's details must not be exposed");
      assert.equal(JSON.stringify(body).includes(victimEmail), false, "the victim's email must not leak");
    } finally {
      releaseState();
    }
  });

  it("excludes credential material from the response", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      const response = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(id));
      const raw = await response.text();
      for (const forbidden of ["password", "passwordHash", "scrypt$", "credential", "sessionId"]) {
        assert.equal(raw.includes(`"${forbidden}"`), false, `response must not contain ${forbidden}`);
      }
    } finally {
      releaseState();
    }
  });

  it("does not treat a client-supplied identifier as the actor", async () => {
    useCleanState();
    try {
      const victimEmail = uniqueEmail();
      const victimId = await register(victimEmail);
      const attackerEmail = uniqueEmail();
      const attackerId = await register(attackerEmail);
      const { cookie } = await authenticate(attackerEmail);

      // Naming one's own id while presenting no session is still unauthenticated.
      const anonymous = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET" }), params(attackerId));
      assert.equal(anonymous.status, 401, "a supplied identifier must never establish an actor");

      // And naming the victim's id while authenticated as the attacker is forbidden.
      const crossed = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(victimId));
      assert.equal(crossed.status, 403);
    } finally {
      releaseState();
    }
  });
});

describe("account resource boundary — update (Tasks #130–#132)", () => {
  it("updates a permitted field for the owner", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);
      const nextEmail = `${email}-renamed`;

      const response = await patchAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: nextEmail }),
        }),
        params(id),
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as AccountBody;
      assert.equal(body.account?.email, nextEmail);
    } finally {
      releaseState();
    }
  });

  it("refuses to modify another account", async () => {
    useCleanState();
    try {
      const victimEmail = uniqueEmail();
      const victimId = await register(victimEmail);
      const { cookie } = await registerAndAuthenticate(uniqueEmail());

      const response = await patchAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "hijacked@example.com" }),
        }),
        params(victimId),
      );
      assert.equal(response.status, 403);

      // The victim's email must be untouched.
      const ownerCookie = await authenticate(victimEmail);
      const check = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie: ownerCookie.cookie } }), params(victimId));
      assert.equal(((await check.json()) as AccountBody).account?.email, victimEmail, "the victim's email must be unchanged");
    } finally {
      releaseState();
    }
  });

  it("rejects immutable and sensitive fields", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      for (const patch of [
        { id: "account-hijack" },
        { passwordHash: "scrypt$fake" },
        { accountId: "other" },
        { role: "admin" },
        { id: "x", email: `ok-${email}` },
      ]) {
        const response = await patchAccount(
          new Request("http://localhost/api/accounts/x", {
            method: "PATCH",
            headers: { cookie, "content-type": "application/json" },
            body: JSON.stringify(patch),
          }),
          params(id),
        );
        assert.equal(response.status, 400, `patch ${JSON.stringify(patch)} must be rejected`);
      }
    } finally {
      releaseState();
    }
  });

  it("rejects an invalid permitted value without partially mutating the account", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      const response = await patchAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: "   " }),
        }),
        params(id),
      );
      assert.equal(response.status, 400);
      const body = (await response.json()) as AccountBody;
      assert.ok(body.error?.fields?.email, "the offending field must be reported");

      const check = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(id));
      assert.equal(((await check.json()) as AccountBody).account?.email, email, "a rejected update must not mutate the account");
    } finally {
      releaseState();
    }
  });

  it("handles a duplicate identity safely", async () => {
    useCleanState();
    try {
      const takenEmail = uniqueEmail();
      await register(takenEmail);
      const mineEmail = uniqueEmail();
      const id = await register(mineEmail);
      const { cookie } = await authenticate(mineEmail);

      const response = await patchAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ email: takenEmail }),
        }),
        params(id),
      );
      assert.equal(response.status, 400);
      const body = (await response.json()) as AccountBody;
      assert.ok(body.error?.code === "duplicate-identity" || body.error?.code === "invalid-input");
      // Matches the convention registration already follows: the code may say the
      // identity is taken, but the response must never echo the submitted value
      // back, which would turn this endpoint into a confirmation oracle.
      assert.equal(JSON.stringify(body).includes(takenEmail), false, "must not echo the submitted identity");
    } finally {
      releaseState();
    }
  });

  it("rejects an unauthenticated update", async () => {
    useCleanState();
    try {
      const id = await register(uniqueEmail());
      const response = await patchAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "x@example.com" }),
        }),
        params(id),
      );
      assert.equal(response.status, 401);
    } finally {
      releaseState();
    }
  });
});

describe("account resource boundary — delete (Tasks #133–#135)", () => {
  it("deletes the account when the holder confirms", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      const response = await deleteAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }),
        params(id),
      );
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as AccountBody).deleted, true);

      // The account must be gone from persistence.
      const { cookie: secondCookie } = await registerAndAuthenticate(uniqueEmail());
      const check = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie: secondCookie } }), params(id));
      assert.equal(check.status, 404, "the deleted account must no longer exist");
    } finally {
      releaseState();
    }
  });

  it("requires confirmation", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      const response = await deleteAccount(
        new Request("http://localhost/api/accounts/x", { method: "DELETE", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({}) }),
        params(id),
      );
      assert.equal(response.status, 400);
      assert.equal(((await response.json()) as AccountBody).error?.code, "confirmation-required");

      // Unconfirmed deletion must not have removed anything.
      const check = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie } }), params(id));
      assert.equal(check.status, 200, "an unconfirmed delete must leave the account intact");
    } finally {
      releaseState();
    }
  });

  it("refuses to delete another account", async () => {
    useCleanState();
    try {
      const victimEmail = uniqueEmail();
      const victimId = await register(victimEmail);
      const { cookie } = await registerAndAuthenticate(uniqueEmail());

      const response = await deleteAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }),
        params(victimId),
      );
      assert.equal(response.status, 403);

      const owner = await authenticate(victimEmail);
      const check = await getAccount(new Request("http://localhost/api/accounts/x", { method: "GET", headers: { cookie: owner.cookie } }), params(victimId));
      assert.equal(check.status, 200, "the victim's account must survive");
    } finally {
      releaseState();
    }
  });

  it("rejects an unauthenticated deletion", async () => {
    useCleanState();
    try {
      const id = await register(uniqueEmail());
      const response = await deleteAccount(
        new Request("http://localhost/api/accounts/x", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) }),
        params(id),
      );
      assert.equal(response.status, 401);
    } finally {
      releaseState();
    }
  });

  it("revokes the account's sessions so the credential stops working", async () => {
    useCleanState();
    try {
      const email = uniqueEmail();
      const id = await register(email);
      const { cookie } = await authenticate(email);

      // The session is live before deletion.
      assert.equal((await getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie } }))).status, 200);

      const deleted = await deleteAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }),
        params(id),
      );
      assert.equal(deleted.status, 200);

      // The deleted account's session must no longer authenticate anything.
      assert.equal(
        (await getMe(new Request("http://localhost/api/me", { method: "GET", headers: { cookie } }))).status,
        401,
        "a deleted account's session must not remain usable",
      );
    } finally {
      releaseState();
    }
  });

  it("reports a nonexistent account as not found", async () => {
    useCleanState();
    try {
      const { cookie } = await registerAndAuthenticate(uniqueEmail());
      const response = await deleteAccount(
        new Request("http://localhost/api/accounts/x", {
          method: "DELETE",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        }),
        params("no-such-account"),
      );
      assert.equal(response.status, 404);
    } finally {
      releaseState();
    }
  });
});

describe("account view rules (Tasks #127–#135)", () => {
  it("accepts a permitted field and trims it", () => {
    const result = validateAccountPatch({ email: "  person@example.com  " });
    assert.deepEqual(result, { ok: true, patch: { email: "person@example.com" } });
  });

  it("rejects protected and unknown fields by name", () => {
    for (const patch of [{ id: "x" }, { passwordHash: "y" }, { createdAt: "z" }, { role: "admin" }]) {
      const result = validateAccountPatch(patch);
      assert.equal(result.ok, false);
      assert.ok("forbidden" in result, `expected forbidden for ${JSON.stringify(patch)}`);
    }
  });

  it("rejects malformed and empty patches with field detail", () => {
    for (const patch of [{ email: "" }, { email: "   " }, { email: 42 }, {}, null, [], "text"]) {
      const result = validateAccountPatch(patch);
      assert.equal(result.ok, false);
      assert.ok("fields" in result, `expected field detail for ${JSON.stringify(patch)}`);
    }
  });

  it("validates the email field locally without replacing the server check", () => {
    assert.deepEqual(validateEmailChange("  person@example.com  "), {});
    assert.deepEqual(validateEmailChange(""), { email: "Enter a value." });
    assert.deepEqual(validateEmailChange("   "), { email: "Enter a value." });
    assert.deepEqual(validateEmailChange("nope"), { email: "Enter a valid email address." });
  });

  it("maps account responses to safe feedback", () => {
    assert.deepEqual(toAccountFeedback({ ok: true }), { ok: true });

    /** Narrows the union so the assertions below can read `message`/`fields`. */
    function failureFor(payload: unknown) {
      const result = toAccountFeedback(payload as never);
      assert.equal(result.ok, false, "expected a failure feedback");
      if (result.ok) throw new Error("unreachable");
      return result;
    }

    assert.equal(failureFor({ ok: false, error: { code: "unauthenticated" } }).message, "Sign in to continue.");
    assert.equal(failureFor({ ok: false, error: { code: "forbidden" } }).message, "You do not have access to that account.");
    assert.equal(failureFor({ ok: false, error: { code: "not-found" } }).message, "That account could not be found.");

    // Field detail surfaces only for the documented validation path.
    assert.deepEqual(
      failureFor({ ok: false, error: { code: "invalid-input", message: "Check.", fields: { email: "Enter a value." } } }).fields,
      { email: "Enter a value." },
    );

    // Anything unexpected falls back to the shared message.
    for (const payload of [null, undefined, {}, { ok: false, error: { code: "weird", message: "leaky detail" } }]) {
      assert.deepEqual(failureFor(payload), { ok: false, message: ACCOUNT_GENERIC_ERROR, fields: {} });
    }
  });

  it("requires the exact confirmation phrase before deletion", () => {
    // Case-insensitive on purpose: the safeguard is about typing the right word,
    // not about enforcing letter case.
    assert.equal(isConfirmedDeletion("DELETE"), true);
    assert.equal(isConfirmedDeletion("  delete  "), true);
    for (const typed of ["", "yes", "removed", "DELETING", "delete my account"]) {
      assert.equal(isConfirmedDeletion(typed), false, `"${typed}" must not confirm a deletion`);
    }
  });
});