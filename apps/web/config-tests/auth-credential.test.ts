import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyCredentials } from "../auth";
import type {
  AccountCredentialRecord,
  AccountCredentialRepository,
  AccountRepositoryResult,
  AuthenticationDependencies,
  PasswordVerificationResult,
} from "../auth";

const validPassword = "correct horse battery staple";
const record: AccountCredentialRecord = {
  accountId: "account-123",
  email: "person@example.com",
  passwordHash: "hashed-password",
};

function createFixture(options: {
  lookup?: AccountRepositoryResult<AccountCredentialRecord | null>;
  verify?: PasswordVerificationResult;
  lookupThrows?: boolean;
  verifyThrows?: boolean;
} = {}) {
  let verifyCalls = 0;
  const dependencies: AuthenticationDependencies = {
    repository: {
      async findByEmail(email) {
        assert.equal(email, "person@example.com");
        if (options.lookupThrows) throw new Error("private lookup detail");
        return options.lookup ?? { ok: true, value: record };
      },
    } satisfies AccountCredentialRepository,
    passwordVerifier: {
      async verify(password, passwordHash) {
        verifyCalls += 1;
        assert.equal(password, validPassword);
        assert.equal(passwordHash, "hashed-password");
        if (options.verifyThrows) throw new Error("private verification detail");
        return options.verify ?? { ok: true };
      },
    },
  };

  return {
    service: verifyCredentials(dependencies),
    get verifyCalls() { return verifyCalls; },
  };
}

describe("authentication credential contract (Task #103)", () => {
  it("accepts a valid email and password and returns only the authenticated identity", async () => {
    const fixture = createFixture();
    const result = await fixture.service.verify({ email: " Person@Example.com ", password: validPassword });

    assert.equal(result.ok, true);
    assert.equal(fixture.verifyCalls, 1);
    if (result.ok) {
      assert.deepEqual(result.identity, { accountId: "account-123", email: "person@example.com" });
      assert.equal("password" in result.identity, false);
      assert.equal("passwordHash" in result.identity, false);
    }
  });

  it("rejects missing or malformed credentials before repository access", async () => {
    const fixture = createFixture();
    const missingEmail = await fixture.service.verify({ email: "   ", password: validPassword });
    const malformedEmail = await fixture.service.verify({ email: "bad", password: validPassword });
    const missingPassword = await fixture.service.verify({ email: "person@example.com", password: "" });

    assert.equal(missingEmail.ok, false);
    assert.equal(malformedEmail.ok, false);
    assert.equal(missingPassword.ok, false);
    assert.equal(fixture.verifyCalls, 0);
    if (!missingEmail.ok) assert.equal(missingEmail.error.message, "The email or password is incorrect.");
  });

  it("maps not found and invalid password responses to the same safe outcome", async () => {
    const notFound = createFixture({ lookup: { ok: true, value: null } });
    const noMatch = createFixture({ verify: { ok: false } });
    const missingRecord = await notFound.service.verify({ email: "person@example.com", password: validPassword });
    const wrongPassword = await noMatch.service.verify({ email: "person@example.com", password: validPassword });

    assert.equal(missingRecord.ok, false);
    assert.equal(wrongPassword.ok, false);
    if (!missingRecord.ok) assert.equal(missingRecord.error.code, "invalid-credentials");
    if (!wrongPassword.ok) {
      assert.equal(wrongPassword.error.code, "invalid-credentials");
      assert.equal(wrongPassword.error.message.includes("person@example.com"), false);
    }
  });

  it("sanitizes repository and verifier failures without revealing credential details", async () => {
    const repoFailure = createFixture({ lookupThrows: true });
    const verifierFailure = createFixture({ verifyThrows: true });
    const repoResult = await repoFailure.service.verify({ email: "person@example.com", password: validPassword });
    const verifyResult = await verifierFailure.service.verify({ email: "person@example.com", password: validPassword });

    assert.equal(repoResult.ok, false);
    assert.equal(verifyResult.ok, false);
    if (!repoResult.ok) assert.equal(repoResult.error.code, "storage-failure");
    if (!verifyResult.ok) {
      assert.equal(verifyResult.error.code, "credential-verification-failed");
      assert.equal(verifyResult.error.message, "The email or password is incorrect.");
    }
  });
});
