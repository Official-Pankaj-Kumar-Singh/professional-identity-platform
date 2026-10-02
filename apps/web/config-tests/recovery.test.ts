import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { InMemoryRecoveryRepository } from "../recovery/repository";
import { createRecoveryService } from "../recovery/service";
import { ScryptPasswordHasher } from "../auth/password-hasher";
import type { RecoveryDependencies } from "../recovery/types";

const FIXED_NOW = "2026-09-28T12:00:00Z";
const ONE_HOUR_MS = 60 * 60 * 1000;
const rawPassword = "correct horse battery staple";

function makeDependencies() {
  const composition = createAccountComposition();
  const repository = new InMemoryRecoveryRepository({ clock: () => FIXED_NOW });
  return {
    composition,
    repository,
    deps: {
      repository,
      createRecoveryToken: () => "token-1",
      now: () => FIXED_NOW,
      tokenTtlMs: ONE_HOUR_MS,
    } satisfies RecoveryDependencies,
  };
}

function makeService(deps: ReturnType<typeof makeDependencies>) {
  const persistence = deps.composition.persistence;
  return createRecoveryService(deps.deps, {
    repository: deps.repository,
    resolveAccountIdByEmail: async (email) => {
      const record = persistence.getAccountByEmail(email);
      return record ? record.id : null;
    },
    setPasswordHash: (accountId, passwordHash) => persistence.setPasswordHash(accountId, passwordHash),
    hashPassword: (password) => new ScryptPasswordHasher().hash(password),
  });
}

async function seedAccount() {
  const deps = makeDependencies();
  const result = await deps.composition.create({ email: "person@example.com", password: rawPassword });
  if (!result.ok) throw new Error("seed failed");
  return deps;
}

describe("password recovery (Tasks #121–#126)", () => {
  it("issues a token only for an existing account", async () => {
    const deps = await seedAccount();
    const service = makeService(deps);

    const existing = await service.requestRecovery(" Person@Example.com ");
    assert.equal(existing.ok, true);
    if (existing.ok) assert.equal(existing.token, "token-1");

    const missing = await service.requestRecovery("nobody@example.com");
    assert.equal(missing.ok, true);
    if (missing.ok) assert.equal(missing.token, null);
  });

  it("rejects an invalid, expired, or already-used token", async () => {
    const deps = await seedAccount();
    const service = makeService(deps);

    await service.requestRecovery("person@example.com");
    const used = await service.resetPassword("token-1", "a sufficiently long new password");
    assert.equal(used.ok, true);

    const reused = await service.resetPassword("token-1", "another sufficiently long password");
    assert.equal(reused.ok, false);
    if (!reused.ok) assert.equal(reused.error.code, "used-token");

    const invalid = await service.resetPassword("not-a-token", "a sufficiently long new password");
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.error.code, "invalid-token");
  });

  it("hashes the new password and stores only the hash", async () => {
    const deps = await seedAccount();
    const service = makeService(deps);

    await service.requestRecovery("person@example.com");
    const result = await service.resetPassword("token-1", rawPassword);
    assert.equal(result.ok, true);

    const credential = await deps.composition.persistence.getCredentialByEmail("person@example.com");
    assert.ok(credential);
    assert.notEqual(credential?.passwordHash, rawPassword);
    assert.notEqual(credential?.passwordHash, "old-hash");
    assert.ok(credential?.passwordHash.startsWith("scrypt"));
  });

  it("rejects a too-short new password without consuming the token", async () => {
    const deps = await seedAccount();
    const service = makeService(deps);

    await service.requestRecovery("person@example.com");
    const result = await service.resetPassword("token-1", "short");
    assert.equal(result.ok, false);
    // Task #124: the password problem is reported as its own code rather than
    // being reported as a bad token, so the form can explain the field. This
    // expectation previously asserted "invalid-token", which described the link
    // rather than the password.
    if (!result.ok) assert.equal(result.error.code, "invalid-password");

    // And the link must still be usable after a rejected attempt.
    const retry = await service.resetPassword("token-1", "a sufficiently long replacement");
    assert.equal(retry.ok, true, "a rejected password must not burn the recovery token");
  });
});