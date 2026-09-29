import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { createSignInService } from "../auth/sign-in";
import type { CredentialVerificationResult } from "../auth/types";

const rawPassword = "correct horse battery staple";

describe("sign-in (Tasks #104–#105)", () => {
  it("authenticates a registered account and returns only the identity", async () => {
    const composition = createAccountComposition();
    await composition.create({ email: " Person@Example.com ", password: rawPassword });

    const signIn = createSignInService({ repository: composition.persistence.credentials });
    const result: CredentialVerificationResult = await signIn.verify({ email: "PERSON@EXAMPLE.COM", password: rawPassword });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.identity.email, "person@example.com");
    assert.equal(typeof result.identity.accountId, "string");
    assert.equal("password" in result.identity, false);
    assert.equal("passwordHash" in result.identity, false);
  });

  it("rejects an incorrect password with the same safe response as an unknown account", async () => {
    const composition = createAccountComposition();
    await composition.create({ email: "person@example.com", password: rawPassword });

    const signIn = createSignInService({ repository: composition.persistence.credentials });
    const wrongPassword = await signIn.verify({ email: "person@example.com", password: "wrong password" });
    const unknownAccount = await signIn.verify({ email: "missing@example.com", password: rawPassword });

    assert.equal(wrongPassword.ok, false);
    assert.equal(unknownAccount.ok, false);
    if (!wrongPassword.ok) {
      assert.equal(wrongPassword.error.code, "invalid-credentials");
      assert.equal(wrongPassword.error.message, "The email or password is incorrect.");
    }
    if (!unknownAccount.ok) assert.equal(unknownAccount.error.code, "invalid-credentials");
  });

  it("rejects missing or malformed credentials before touching the repository", async () => {
    const composition = createAccountComposition();
    await composition.create({ email: "person@example.com", password: rawPassword });

    const signIn = createSignInService({ repository: composition.persistence.credentials });
    const missingEmail = await signIn.verify({ email: "   ", password: rawPassword });
    const malformedEmail = await signIn.verify({ email: "bad", password: rawPassword });
    const missingPassword = await signIn.verify({ email: "person@example.com", password: "" });

    assert.equal(missingEmail.ok, false);
    assert.equal(malformedEmail.ok, false);
    assert.equal(missingPassword.ok, false);
  });
});