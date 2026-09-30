/**
 * @file config-tests/registration-form-feedback.test.ts
 *
 * Task #95 — the registration form's checks and its server-to-feedback mapping.
 *
 * The rules under test were previously inline in the form component and the
 * page's submit handler, where no test could reach them: the repository has no
 * component-test setup, and the config-test build compiles `config/**` and
 * `config-tests/**`. They now live in `app/register/registration-form-rules.ts`
 * as pure functions, so the behaviour this task ships is verifiable.
 *
 * Task #99 owns validation *boundary* coverage for the server policy and
 * Task #97/#98 own that policy; this suite covers only what the form does with
 * values and with a server response, and deliberately stays clear of the
 * boundary cases those tasks exist to pin down.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGISTRATION_GENERIC_ERROR,
  REGISTRATION_HINT,
  toRegistrationFeedback,
  validateRegistrationFields,
} from "../app/register/registration-form-rules";

const strongPassword = "correct horse battery staple";

describe("registration form checks and feedback (Task #95)", () => {
  it("accepts a complete, well-formed submission", () => {
    assert.deepEqual(validateRegistrationFields({ email: "person@example.com", password: strongPassword }), {});
  });

  it("reports the required checks clearly, per field", () => {
    const errors = validateRegistrationFields({ email: "   ", password: "" });

    assert.equal(errors.email, "Enter your email address.");
    assert.equal(errors.password, "Enter a password.");
  });

  it("reports a malformed email against the email field only", () => {
    const errors = validateRegistrationFields({ email: "not-an-address", password: strongPassword });

    assert.equal(errors.email, "Enter a valid email address.");
    assert.equal(errors.password, undefined, "a valid password must not be flagged");
  });

  it("reports a short password against the password field only", () => {
    const errors = validateRegistrationFields({ email: "person@example.com", password: "short" });

    assert.equal(errors.password, "Use at least 12 characters.");
    assert.equal(errors.email, undefined, "a valid email must not be flagged");
    assert.equal(errors.password, REGISTRATION_HINT, "the hint and the error must agree");
  });

  it("ignores surrounding whitespace when judging the email", () => {
    assert.deepEqual(validateRegistrationFields({ email: "  person@example.com  ", password: strongPassword }), {});
  });

  it("treats a password of exactly the minimum length as acceptable", () => {
    const errors = validateRegistrationFields({ email: "person@example.com", password: "123456789012" });
    assert.equal(errors.password, undefined);
  });

  it("accepts a valid submission so the form is allowed to submit it", () => {
    // The submit handler submits exactly when this returns nothing.
    const errors = validateRegistrationFields({ email: "person@example.com", password: strongPassword });
    assert.equal(Object.keys(errors).length, 0, "no field errors means the form may submit");
  });

  it("surfaces a successful response as success", () => {
    assert.deepEqual(toRegistrationFeedback({ ok: true }), { ok: true });
  });

  it("maps invalid-input to field-level feedback on both fields", () => {
    const feedback = toRegistrationFeedback({
      ok: false,
      error: { code: "invalid-input", message: "Check the registration details and try again." },
    });

    assert.equal(feedback.ok, false);
    if (feedback.ok) return;
    assert.equal(feedback.message, "Check the registration details and try again.");
    assert.equal(feedback.fieldErrors?.email, "Check your email address.");
    assert.equal(feedback.fieldErrors?.password, "Check your password.");
  });

  it("keeps a duplicate rejection non-disclosing and unattached to any field", () => {
    const feedback = toRegistrationFeedback({
      ok: false,
      error: { code: "already-exists", message: "An account could not be created with these details." },
    });

    assert.equal(feedback.ok, false);
    if (feedback.ok) return;
    assert.equal(feedback.message, "An account could not be created with these details.");
    assert.equal(feedback.fieldErrors, undefined, "a duplicate must not be blamed on a field");
    assert.equal(feedback.message.includes("@"), false, "a duplicate must not echo an address");
  });

  it("falls back to neutral copy when the server says nothing usable", () => {
    const empty = toRegistrationFeedback({ ok: false });
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.equal(empty.message, REGISTRATION_GENERIC_ERROR);
      assert.equal(empty.fieldErrors, undefined);
    }

    const malformed = toRegistrationFeedback({ ok: false, error: {} });
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.message, REGISTRATION_GENERIC_ERROR);
  });

  it("never renders a server message that is empty or non-string", () => {
    const feedback = toRegistrationFeedback({ ok: false, error: { code: "storage-failure", message: "" } });
    assert.equal(feedback.ok, false);
    if (!feedback.ok) assert.equal(feedback.message, REGISTRATION_GENERIC_ERROR);
  });

  it("does not attach field errors for storage failures", () => {
    const feedback = toRegistrationFeedback({
      ok: false,
      error: { code: "storage-failure", message: "The account could not be created." },
    });

    assert.equal(feedback.ok, false);
    if (!feedback.ok) {
      assert.equal(feedback.message, "The account could not be created.");
      assert.equal(feedback.fieldErrors, undefined);
    }
  });
});
