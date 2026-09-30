/**
 * @file config-tests/server-validation-parity.test.ts
 *
 * Task #98 — apply the registration rules on the server, and present client
 * field errors using the same expectations.
 *
 * Before this task the server collapsed every validation failure into one flat
 * message with no field attribution, so the form had to guess: it attached
 * "Check your email address." and "Check your password." to *both* fields on any
 * `invalid-input` rejection, even when only one was wrong. The rules were
 * shared (Task #97), but the *rejection* was not — the client could not show the
 * user which field to fix, and was told to look at a field that was fine.
 *
 * The server now carries the policy's per-field issues through to the response,
 * and the form uses them. Two properties are asserted here:
 *
 * 1. The server rejects on its own. Every request below goes straight to the
 *    handler with no form involved, so nothing depends on client-side checks.
 * 2. Client and server agree. For the same input the form's field errors are
 *    the server's own messages, not a parallel set.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { validateRegistration, MIN_REGISTRATION_PASSWORD_LENGTH } from "../account";
import { toRegistrationFeedback, validateRegistrationFields } from "../app/register/registration-form-rules";
import { POST as registerAccount } from "../app/api/register/route";

const strongPassword = "correct horse battery staple";

interface ServerError {
  code?: string;
  message?: string;
  issues?: Array<{ field?: string; code?: string; message?: string }>;
}
interface ResponseBody {
  ok?: boolean;
  error?: ServerError;
}

let uniquePart = 0;
function uniqueEmail(prefix: string): string {
  uniquePart += 1;
  return `${prefix}${uniquePart}@example.com`;
}

/** Submit straight to the server. No client-side validation is in the path. */
async function submitToServer(email: unknown, password: unknown): Promise<{ status: number; body: ResponseBody }> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { status: response.status, body: (await response.json()) as ResponseBody };
}

describe("server validation and client parity (Task #98)", () => {
  it("rejects a malformed email on the server, naming only the email field", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const result = await submitToServer("not-an-address", strongPassword);

      assert.equal(result.status, 400);
      assert.equal(result.body.error?.code, "invalid-input");
      assert.deepEqual(
        result.body.error?.issues?.map((issue) => [issue.field, issue.code]),
        [["email", "invalid-email"]],
        "the server must name the field that failed",
      );
      assert.equal(composition.persistence.accountCount, 0);
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects a weak password on the server, naming only the password field", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const result = await submitToServer(uniqueEmail("weak"), "short");

      assert.equal(result.status, 400);
      assert.deepEqual(
        result.body.error?.issues?.map((issue) => [issue.field, issue.code]),
        [["password", "weak-password"]],
      );
    } finally {
      resetAccountComposition();
    }
  });

  it("names both fields when both are wrong", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const result = await submitToServer("bad", "short");

      assert.equal(result.status, 400);
      assert.deepEqual(result.body.error?.issues?.map((issue) => issue.field), ["email", "password"]);
    } finally {
      resetAccountComposition();
    }
  });

  it("rejects an entirely absent payload without relying on the client", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      for (const [email, password] of [["", strongPassword], [uniqueEmail("nopw"), ""], [undefined, undefined]]) {
        const result = await submitToServer(email, password);
        assert.equal(result.status, 400, `${JSON.stringify([email, password])} must be rejected`);
        assert.equal(result.body.error?.code, "invalid-input");
      }
      assert.equal(composition.persistence.accountCount, 0);
    } finally {
      resetAccountComposition();
    }
  });

  it("identifies fields without exposing the values that were submitted", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("private");
      // Deliberately below the minimum, so the rejection is on the password and
      // the submitted value is something the response must not echo back.
      const weakPassword = "hunter2";
      assert.ok(
        weakPassword.length < MIN_REGISTRATION_PASSWORD_LENGTH,
        `sentinel must be below the minimum to trigger a rejection, was ${weakPassword.length}`,
      );
      const result = await submitToServer(email, weakPassword);

      assert.equal(result.status, 400);
      const serialized = JSON.stringify(result.body);
      assert.equal(serialized.includes(email), false, "a rejection must not echo the submitted address");
      assert.equal(serialized.includes(weakPassword), false, "a rejection must not echo the submitted password");
      // It does still say which field, which is the point of the task.
      assert.equal(result.body.error?.issues?.some((issue) => issue.field === "password"), true);
    } finally {
      resetAccountComposition();
    }
  });

  it("presents the server's own field errors rather than guessing", async () => {
    const result = await submitToServer("not-an-address", strongPassword);
    const feedback = toRegistrationFeedback(result.body);

    assert.equal(feedback.ok, false);
    if (feedback.ok) return;
    assert.equal(feedback.fieldErrors?.email, "Enter a valid email address.");
    assert.equal(
      feedback.fieldErrors?.password,
      undefined,
      "a valid password must not be blamed when only the email was rejected",
    );
  });

  it("agrees with the client on exactly which fields are invalid", async () => {
    const cases: Array<[string, string]> = [
      ["not-an-address", strongPassword],
      [uniqueEmail("clientweak"), "short"],
      ["bad", "short"],
      ["", ""],
    ];

    for (const [email, password] of cases) {
      const server = await submitToServer(email, password);
      const client = validateRegistrationFields({ email, password });
      const feedback = toRegistrationFeedback(server.body);

      assert.equal(server.status, 400, `${JSON.stringify([email, password])} must be rejected by the server`);
      assert.equal(feedback.ok, false);

      const serverFields = (server.body.error?.issues ?? [])
        .filter((issue) => typeof issue.field === "string")
        .map((issue) => issue.field as string)
        .sort();
      const clientFields = Object.keys(client).sort();

      assert.deepEqual(clientFields, serverFields, `client and server must agree on ${JSON.stringify([email, password])}`);

      // And the text shown is the server's, verbatim.
      if (!feedback.ok) {
        for (const field of clientFields) {
          assert.equal(feedback.fieldErrors?.[field as "email" | "password"], client[field as "email" | "password"]);
        }
      }
    }
  });

  it("keeps a duplicate unattributed and non-disclosing", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const email = uniqueEmail("dup");
      assert.equal((await submitToServer(email, strongPassword)).status, 201);

      const again = await submitToServer(email.toUpperCase(), strongPassword);
      const feedback = toRegistrationFeedback(again.body);

      assert.equal(again.status, 400);
      assert.equal(again.body.error?.code, "already-exists");
      assert.equal(again.body.error?.issues, undefined, "a duplicate carries no field attribution");
      assert.equal(feedback.ok, false);
      if (!feedback.ok) {
        assert.equal(feedback.fieldErrors, undefined, "the form must not blame a field for a duplicate");
        assert.equal(JSON.stringify(again.body).includes(email), false);
      }
    } finally {
      resetAccountComposition();
    }
  });

  it("applies the same minimum the client believes it is applying", async () => {
    const atMinimum = "x".repeat(MIN_REGISTRATION_PASSWORD_LENGTH);
    const below = "x".repeat(MIN_REGISTRATION_PASSWORD_LENGTH - 1);

    assert.equal(validateRegistration({ email: "user@example.com", password: atMinimum }).ok, true);
    assert.deepEqual(
      validateRegistration({ email: "user@example.com", password: below }).issues.map((issue) => issue.code),
      ["weak-password"],
    );

    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      assert.equal((await submitToServer(uniqueEmail("atmin"), atMinimum)).status, 201);
      assert.equal((await submitToServer(uniqueEmail("below"), below)).status, 400);
    } finally {
      resetAccountComposition();
    }
  });
});
