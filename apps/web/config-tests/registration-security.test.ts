/**
 * @file config-tests/registration-security.test.ts
 *
 * Task #96 — focused security checks across the registration acceptance cases:
 * successful registration, invalid input, duplicate identity, password storage,
 * and error responses.
 *
 * The distinction this suite draws is the *boundary*. Earlier suites verify the
 * service and composition layers: that a hash was stored, that a duplicate was
 * rejected, that a message withholds the identity. Those assertions are all
 * made in-process, on objects the test already holds. None of them looked at
 * what actually crosses the wire.
 *
 * Everything here therefore goes through the real `/api/register` handler, and
 * every assertion is about the bytes a caller receives or the bytes that were
 * kept. A service that hashed correctly but echoed `passwordHash` in its
 * success body, or a repository that raised with internal detail, would satisfy
 * every other suite in this repository and fail here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition, type AccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { POST as registerAccount } from "../app/api/register/route";
import type { AccountCreationResult } from "../account/types";

const strongPassword = "correct horse battery staple";

interface ResponseBody {
  ok?: boolean;
  account?: { id?: string; email?: string };
  error?: { code?: string; message?: string };
}

let uniquePart = 0;
function uniqueEmail(prefix: string): string {
  uniquePart += 1;
  return `${prefix}${uniquePart}@example.com`;
}

async function post(email: string, password = strongPassword): Promise<{ status: number; raw: string; body: ResponseBody }> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  const raw = await response.text();
  return { status: response.status, raw, body: JSON.parse(raw) as ResponseBody };
}

/**
 * Substrings that must never appear in anything a caller can observe.
 *
 * The submitted password is here by value, not by the word "password": a
 * legitimate message such as "Provide an email address and password." names a
 * field, which discloses nothing. A value, a hash, or an internal detail would.
 * Credential *keys* are checked separately by {@link assertNoCredentialKeys}.
 */
const FORBIDDEN = [strongPassword, "scrypt", "private", "stack", "at Object.", "node_modules", "Error:"];

const CREDENTIAL_KEYS = ["password", "passwordHash", "credential", "credentialHash", "salt"];

function assertClean(raw: string): void {
  for (const needle of FORBIDDEN) {
    assert.equal(
      raw.toLowerCase().includes(needle.toLowerCase()),
      false,
      `response must not disclose ${JSON.stringify(needle)}: ${raw}`,
    );
  }
}

/** No key anywhere in the payload may name credential material. */
function assertNoCredentialKeys(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialKeys(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(
      CREDENTIAL_KEYS.includes(key),
      false,
      `${path}.${key} must not be exposed in a response`,
    );
    assertNoCredentialKeys(child, `${path}.${key}`);
  }
}

/** Install a composition whose service fails, to reach the error paths. */
function failingComposition(result: AccountCreationResult): AccountComposition {
  return {
    persistence: createAccountComposition().persistence,
    create: async () => result,
    clear: () => undefined,
  };
}

describe("registration security checks (Task #96)", () => {
  it("returns an account on success and discloses no credential material", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("success");
      const created = await post(email);

      assert.equal(created.status, 201);
      assert.equal(created.body.ok, true);
      assert.equal(created.body.account?.email, email);
      assert.equal(typeof created.body.account?.id, "string");

      // The success body is the only place a hash could leak.
      assertClean(created.raw);
      assertNoCredentialKeys(created.body);
      assert.equal(created.body.account && "passwordHash" in created.body.account, false);
      assert.equal(created.body.account && "password" in created.body.account, false);
    } finally {
      resetAccountComposition();
    }
  });

  it("stores the password only as a salted scrypt hash, never as plain text", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("storage");
      assert.equal((await post(email)).status, 201);

      const credential = await composition.persistence.getCredentialByEmail(email);
      assert.ok(credential, "a credential must be stored for the new account");
      assert.equal(credential?.passwordHash.includes(strongPassword), false, "plain text password must not be stored");
      assert.ok(credential?.passwordHash.startsWith("scrypt$"), "the stored form must be a scrypt hash");

      // Nor may the password survive anywhere in the serialized stores.
      const account = composition.persistence.getAccountByEmail(email);
      assert.ok(account);
      assert.equal(JSON.stringify(account).includes(strongPassword), false);
      assert.equal("password" in account!, false);
      assert.equal("passwordHash" in account!, false);

      // Two accounts with the same password must not share a hash.
      const other = uniqueEmail("storage");
      assert.equal((await post(other)).status, 201);
      const otherCredential = await composition.persistence.getCredentialByEmail(other);
      assert.notEqual(otherCredential?.passwordHash, credential?.passwordHash, "hashes must be salted per account");
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects invalid input without echoing what was submitted or why in detail", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("invalid");
      for (const bad of [await post(""), await post("not-an-address"), await post(email, "short")]) {
        assert.equal(bad.status, 400);
        assert.equal(bad.body.ok, false);
        assert.equal(bad.body.error?.code, "invalid-input");
        assert.equal(
          (bad.body.error?.message ?? "").includes(email),
          false,
          "a rejection must not echo the submitted identity",
        );
        assertClean(bad.raw);
        assertNoCredentialKeys(bad.body);
      }
      assert.equal(composition.persistence.accountCount, 0, "nothing may be created by invalid input");
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects a duplicate identity without disclosing it", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("duplicate");
      assert.equal((await post(email)).status, 201);

      const again = await post(email.toUpperCase());
      assert.equal(again.status, 400);
      assert.equal(again.body.error?.code, "already-exists");
      assert.equal(again.raw.includes(email), false, "a duplicate must not echo the identity");
      assertClean(again.raw);
      assert.equal(composition.persistence.accountCount, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("sanitizes a storage failure so internal detail never reaches the caller", async () => {
    setAccountComposition(
      failingComposition({
        ok: false,
        error: { code: "storage-failure", message: "The account could not be created." },
      }),
    );
    try {
      const result = await post(uniqueEmail("storagefail"));

      assert.equal(result.status, 400);
      assert.equal(result.body.error?.code, "storage-failure");
      assert.equal(result.body.error?.message, "The account could not be created.");
      assertClean(result.raw);
    } finally {
      resetAccountComposition();
    }
  });

  it("sanitizes a credential-processing failure", async () => {
    setAccountComposition(
      failingComposition({
        ok: false,
        error: { code: "credential-processing-failed", message: "The account could not be created." },
      }),
    );
    try {
      const result = await post(uniqueEmail("crediffail"));

      assert.equal(result.status, 400);
      assert.equal(result.body.error?.code, "credential-processing-failed");
      assert.equal(result.body.error?.message, "The account could not be created.");
      assertClean(result.raw);
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects a malformed request body without echoing it", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const response = await registerAccount(
        new Request("http://localhost/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json at all",
        }),
      );
      const raw = await response.text();

      assert.equal(response.status, 400);
      const parsed = JSON.parse(raw) as ResponseBody;
      assert.equal(parsed.ok, false);
      assert.equal(parsed.error?.code, "invalid-input");
      assertClean(raw);
      assertNoCredentialKeys(parsed);
      assert.equal(composition.persistence.accountCount, 0);
    } finally {
      resetAccountComposition();
    }
  });

  it("never accepts a password supplied under an unexpected key", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("shape");
      const response = await registerAccount(
        new Request("http://localhost/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: strongPassword, role: "admin", isAdmin: true }),
        }),
      );
      const raw = await response.text();

      assert.equal(response.status, 201);
      const parsed = JSON.parse(raw) as ResponseBody;
      // Unexpected fields must not be reflected back into the account.
      assert.equal("role" in (parsed.account ?? {}), false);
      assert.equal("isAdmin" in (parsed.account ?? {}), false);
      assertClean(raw);
      assertNoCredentialKeys(parsed);

      const account = composition.persistence.getAccountByEmail(email);
      assert.ok(account);
      assert.equal("role" in account!, false);
      assert.equal("isAdmin" in account!, false);
    } finally {
      resetAccountComposition();
    }
  });
});
