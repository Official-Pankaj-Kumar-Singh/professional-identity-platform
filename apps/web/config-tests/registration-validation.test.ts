import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateRegistration } from "../account";

describe("registration validation (US-02)", () => {
  it("accepts valid email and a password meeting the documented minimum", () => {
    assert.deepEqual(validateRegistration({ email: " user@example.com ", password: "a sufficiently long password" }), { ok: true, issues: [] });
  });
  it("reports missing fields, malformed email, and short password against their fields", () => {
    assert.deepEqual(validateRegistration({ email: "bad", password: "short" }).issues.map(issue => [issue.field, issue.code]), [["email", "invalid-email"], ["password", "weak-password"]]);
    assert.deepEqual(validateRegistration({}).issues.map(issue => [issue.field, issue.code]), [["email", "required"], ["password", "required"]]);
  });
  it("rejects untrusted non-object and non-string input safely", () => {
    assert.equal(validateRegistration(null).ok, false);
    assert.equal(validateRegistration({ email: 1, password: [] }).ok, false);
  });
});
