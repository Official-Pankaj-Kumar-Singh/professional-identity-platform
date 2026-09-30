/**
 * @file config-tests/duplicate-identity-races.test.ts
 *
 * Task #102 — repeated and concurrent registration attempts for one identity.
 *
 * Every attempt below goes through the real `/api/register` handler against the
 * process-wide composition, so each call is an independent arrival at one
 * deployed server. Nothing is injected into the route.
 *
 * Task #100 proves the uniqueness invariant and that one account survives.
 * Task #101 proves a single rejected duplicate is non-disclosing and costs the
 * same as a success. Neither asserts what *every* losing attempt in a race
 * actually receives. That is this task's scope: after repeated and concurrent
 * attempts, exactly one account exists, and every rejected attempt returns the
 * same safe outcome — right status, right code, and nothing that echoes the
 * identity. A race that returned, say, a raw storage error to the losers would
 * still satisfy the uniqueness invariant while leaking how the race went.
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

let uniquePart = 0;
function uniqueEmail(prefix: string): string {
  uniquePart += 1;
  return `${prefix}${uniquePart}@example.com`;
}

/**
 * Identity spellings that must all collapse to the same account. Every variant
 * stays a well-formed address and differs only by case or surrounding
 * whitespace — variants that are malformed rather than merely different are a
 * validation concern, not a duplicate-identity one.
 */
function identityVariants(email: string): string[] {
  return [
    email,
    email.toUpperCase(),
    `  ${email}  `,
    `\t${email}\n`,
    `  ${email.toUpperCase()}  `,
  ];
}

async function postRegistration(email: string): Promise<Response> {
  return registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

async function bodyOf(response: Response): Promise<RegistrationResponseBody> {
  return (await response.json()) as RegistrationResponseBody;
}

/**
 * Assert a rejected attempt is a safe outcome: the documented status and code,
 * and a body that does not disclose the identity under any spelling.
 */
async function assertSafeOutcome(response: Response, email: string): Promise<void> {
  assert.equal(response.status, 400);
  const body = await bodyOf(response);
  assert.equal(body.ok, false);
  assert.equal(body.error?.code, "already-exists");
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(email), false);
  assert.equal(serialized.toLowerCase().includes(email.toLowerCase()), false);
}

describe("duplicate identity races and responses (Task #102)", () => {
  it("creates one account and returns a safe outcome for every repeated attempt", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("repeated");

      const first = await postRegistration(email);
      assert.equal(first.status, 201);
      const created = await bodyOf(first);
      assert.equal(created.ok, true);

      // Sequential replays of the same identity, spelled differently each time.
      const replays = identityVariants(email);
      for (const variant of replays) {
        await assertSafeOutcome(await postRegistration(variant), email);
      }

      assert.equal(composition.persistence.accountCount, 1);
      assert.equal(composition.persistence.credentials.size, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("creates one account and returns a safe outcome for every loser of a concurrent race", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("race");

      // All of these arrive before any of them has finished.
      const responses = await Promise.all(identityVariants(email).map(postRegistration));

      const created = responses.filter((response) => response.status === 201);
      const rejected = responses.filter((response) => response.status !== 201);
      assert.equal(created.length, 1, "exactly one concurrent attempt may create the account");
      assert.equal(rejected.length, responses.length - 1);

      // Every loser must get the same safe outcome, not just "some" of them.
      for (const response of rejected) {
        await assertSafeOutcome(response, email);
      }

      assert.equal(composition.persistence.accountCount, 1);
      assert.equal(composition.persistence.credentials.size, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("keeps the single winner's account and credential reachable after a race", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("winner");

      const responses = await Promise.all(identityVariants(email).map(postRegistration));
      const winner = responses.find((response) => response.status === 201);
      assert.ok(winner, "one attempt must have created the account");
      const winnerBody = await bodyOf(winner);

      const stored = composition.persistence.getAccountByEmail(email);
      assert.ok(stored, "the winning account must remain stored after the race");
      assert.equal(stored?.id, winnerBody.account?.id);

      const credential = await composition.persistence.getCredentialByEmail(email);
      assert.ok(credential, "the winner's credential must remain reachable after the race");
      assert.equal(credential?.accountId, winnerBody.account?.id);
      assert.equal(credential?.passwordHash.includes(password), false);
    } finally {
      resetAccountComposition();
    }
  });

  it("returns safe outcomes when a race runs against an identity that already exists", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("existing");
      const original = await postRegistration(email);
      assert.equal(original.status, 201);

      const responses = await Promise.all(identityVariants(email).map(postRegistration));
      for (const response of responses) {
        await assertSafeOutcome(response, email);
      }

      assert.equal(composition.persistence.accountCount, 1);
      assert.equal(composition.persistence.credentials.size, 1);
    } finally {
      resetAccountComposition();
    }
  });

  it("does not leak the identity when many duplicates are attempted in quick succession", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("flood");
      assert.equal((await postRegistration(email)).status, 201);

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => postRegistration(email)),
      );

      const bodies = await Promise.all(responses.map(bodyOf));
      for (const body of bodies) {
        assert.equal(body.ok, false);
        assert.equal(body.error?.code, "already-exists");
        assert.equal(JSON.stringify(body).includes(email), false);
      }

      assert.equal(composition.persistence.accountCount, 1);
    } finally {
      resetAccountComposition();
    }
  });
});
