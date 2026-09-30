/**
 * @file config-tests/registration-field-rules.test.ts
 *
 * Task #97 — the shared registration field rules as a stated contract.
 *
 * Task #97 asks that the rules cover required fields, email format, password
 * requirements, and field-specific failures. Those rules existed and were
 * exercised in `registration-validation.test.ts`, but the *contract* behind them
 * was implicit: the password minimum was written out in three separate places —
 * the policy comparison, the form's `minLength` attribute, and the on-screen
 * hint — so nothing tied them together and nothing stopped them from drifting
 * apart. This suite pins the contract so a future change has to be deliberate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_REGISTRATION_PASSWORD_LENGTH, validateRegistration } from "../account";
import { REGISTRATION_HINT } from "../app/register/registration-form-rules";

const longEnough = "correct horse battery staple";

function codesFor(input: unknown): Array<[string, string]> {
  return validateRegistration(input).issues.map((issue) => [issue.field, issue.code]);
}

describe("registration field rules contract (Task #97)", () => {
  it("states the password minimum once, and everything else reads that value", () => {
    assert.equal(MIN_REGISTRATION_PASSWORD_LENGTH, 12);
    // The hint is derived from the policy, so the two cannot contradict.
    assert.equal(REGISTRATION_HINT, `Use at least ${MIN_REGISTRATION_PASSWORD_LENGTH} characters.`);
  });

  it("enforces the password requirement at exactly the stated minimum", () => {
    const oneShort = "x".repeat(MIN_REGISTRATION_PASSWORD_LENGTH - 1);
    const exactly = "x".repeat(MIN_REGISTRATION_PASSWORD_LENGTH);

    assert.deepEqual(codesFor({ email: "user@example.com", password: oneShort }), [["password", "weak-password"]]);
    assert.equal(validateRegistration({ email: "user@example.com", password: exactly }).ok, true);
  });

  it("covers required fields for both fields", () => {
    assert.deepEqual(codesFor({}), [["email", "required"], ["password", "required"]]);
    assert.deepEqual(codesFor({ email: "   ", password: longEnough }), [["email", "required"]]);
    assert.deepEqual(codesFor({ email: "user@example.com", password: "" }), [["password", "required"]]);
  });

  it("covers email format and trims before judging", () => {
    for (const malformed of ["bad", "no-at-sign.example.com", "no@domain", "@example.com", "a@b", "a b@example.com"]) {
      assert.deepEqual(
        codesFor({ email: malformed, password: longEnough }),
        [["email", "invalid-email"]],
        `${JSON.stringify(malformed)} must be rejected as an invalid email`,
      );
    }
    assert.equal(validateRegistration({ email: "  user@example.com  ", password: longEnough }).ok, true);
  });

  it("reports every failure against its own field and codes, in a stable order", () => {
    assert.deepEqual(
      codesFor({ email: "bad", password: "short" }),
      [["email", "invalid-email"], ["password", "weak-password"]],
    );
    // Order is part of the contract so presentation does not shift between fields.
    assert.deepEqual(codesFor({}), [["email", "required"], ["password", "required"]]);
  });

  it("never puts a submitted value in an issue message", () => {
    const result = validateRegistration({ email: "secret-address@example.com", password: "hunter2secret" });
    const messages = result.issues.map((issue) => issue.message).join(" ");

    assert.equal(messages.includes("secret-address@example.com"), false, "an email must never be echoed back");
    assert.equal(messages.includes("hunter2secret"), false, "a password must never be echoed back");
  });

  it("treats an untrusted payload as failing every field rather than throwing", () => {
    for (const untrusted of [null, undefined, "a string", 42, [], { email: 1, password: [] }, { email: {}, password: {} }]) {
      const result = validateRegistration(untrusted);
      assert.equal(result.ok, false, `${JSON.stringify(untrusted)} must be rejected`);
      assert.equal(Array.isArray(result.issues), true);
    }
  });

  it("treats a whitespace-only password as missing rather than merely short", () => {
    // A password of spaces is present but must not be accepted by length alone.
    assert.deepEqual(codesFor({ email: "user@example.com", password: "   " }), [["password", "weak-password"]]);
  });
});
