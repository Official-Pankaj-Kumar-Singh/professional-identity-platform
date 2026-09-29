/**
 * @file config-tests/account-identity-uniqueness.test.ts
 *
 * Task #100 — account identity uniqueness across separate HTTP requests.
 *
 * Each call below invokes the real `/register` route handler exactly once, so two
 * calls model two separate arrivals at one deployed server. Nothing is injected
 * into the handler: uniqueness has to come from the application composition the
 * route resolves for itself. A route that built its own store per request would
 * accept both requests and fail these tests, which is the defect Task #100 fixes.
 *
 * The duplicate response contract (HTTP status, `already-exists` code, and the
 * non-disclosing message) is the one the route already had; only its reachability
 * across requests is under test here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { POST as registerAccount } from "../app/api/register/route";

const password = "correct horse battery staple";

interface RegistrationResponseBody {
  ok: boolean;
  account?: { id: string; email: string };
  error?: { code: string; message: string };
}

/** One POST /register, as its own request, answered by the real route handler. */
function postRegistration(email: string): Promise<Response> {
  return registerAccount(
    new Request("http://localhost/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

async function bodyOf(response: Response): Promise<RegistrationResponseBody> {
  return (await response.json()) as RegistrationResponseBody;
}

let uniquePart = 0;
function uniqueEmail(prefix: string): string {
  uniquePart += 1;
  return `${prefix}${uniquePart}@example.com`;
}

describe("account identity uniqueness across requests (Task #100)", () => {
  it("rejects the same identity resent by a second request and keeps the first account visible", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const first = await postRegistration("  Person@Example.com ");
      assert.equal(first.status, 201);
      const created = await bodyOf(first);
      assert.equal(created.ok, true);
      assert.equal(created.account?.email, "person@example.com");

      const second = await postRegistration("PERSON@example.COM  ");
      assert.equal(second.status, 400);
      const rejected = await bodyOf(second);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.error?.code, "already-exists");
      // Existing non-disclosing duplicate contract: nothing echoes the identity.
      assert.equal(rejected.error?.message.includes("person@example.com"), false);
      assert.equal(JSON.stringify(rejected).includes("person@example.com"), false);

      // The account created by the first request is still visible to the second.
      assert.equal(composition.persistence.accountCount, 1);
      const stored = composition.persistence.getAccountByEmail("Person@EXAMPLE.com");
      assert.ok(stored, "the account created by the first request must still be stored");
      assert.equal(stored?.id, created.account?.id);
      const credential = await composition.persistence.getCredentialByEmail("PeRsOn@exAmPlE.cOm");
      assert.ok(credential, "its credential must still be reachable");
      assert.equal(credential?.accountId, created.account?.id);
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects a second request that differs only in surrounding whitespace", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      assert.equal((await postRegistration("whitespace@example.com")).status, 201);
      const repeated = await postRegistration("\twhitespace@example.com\n");
      assert.equal(repeated.status, 400);
      assert.equal((await bodyOf(repeated)).error?.code, "already-exists");
      assert.equal(composition.persistence.accountCount, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects concurrent duplicate registrations arriving as separate requests", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("race");
      const responses = await Promise.all([
        postRegistration(` ${email.toUpperCase()} `),
        postRegistration(email),
        postRegistration(`\n${email}\t`),
      ]);

      const created = responses.filter((response) => response.status === 201);
      const rejected = responses.filter((response) => response.status === 400);
      assert.equal(created.length, 1);
      assert.equal(rejected.length, 2);
      for (const response of rejected) {
        assert.equal((await bodyOf(response)).error?.code, "already-exists");
      }
      assert.equal(composition.persistence.accountCount, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("shares one account store across requests in the route's own default composition", async () => {
    // Nothing is installed: this is the path a deployed request actually takes.
    resetAccountComposition();
    const email = uniqueEmail("shared");
    try {
      assert.equal((await postRegistration(` ${email} `)).status, 201);
      const repeated = await postRegistration(email.toUpperCase());
      assert.equal(repeated.status, 400);
      assert.equal((await bodyOf(repeated)).error?.code, "already-exists");
    } finally {
      resetAccountComposition();
    }
  });

  it("still accepts distinct identities arriving from separate requests", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      assert.equal((await postRegistration(uniqueEmail("first"))).status, 201);
      assert.equal((await postRegistration(uniqueEmail("second"))).status, 201);
      assert.equal(composition.persistence.accountCount, 2);
    } finally {
      resetAccountComposition();
    }
  });
});