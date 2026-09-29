import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountWriteLock } from "../account/lock";
import { InMemoryAccountRepository, normalizeEmail } from "../account/repository";
import { InMemoryAccountCredentialRepository } from "../auth/credential-repository";
import { createAccountPersistence } from "../account/persistence";
import type { NewAccountRecord } from "../account/types";

const timestamp = "2026-09-28T00:00:00Z";

function makeRecord(overrides: Partial<NewAccountRecord> = {}): NewAccountRecord {
  return {
    account: {
      id: overrides.account?.id ?? "account-1",
      email: overrides.account?.email ?? "person@example.com",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    credential: {
      accountId: overrides.credential?.accountId ?? "account-1",
      passwordHash: overrides.credential?.passwordHash ?? "hashed-password",
    },
  };
}

describe("account persistence (production infrastructure)", () => {
  it("normalizes email identity for comparison", () => {
    assert.equal(normalizeEmail("  Person@Example.com "), "person@example.com");
    assert.equal(normalizeEmail("PERSON@EXAMPLE.COM"), "person@example.com");
  });

  it("creates an account and exposes it by normalized email", async () => {
    const repository = new InMemoryAccountRepository();
    const created = await repository.create(makeRecord());

    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.id, "account-1");
    assert.equal(created.value.email, "person@example.com");
    assert.equal(repository.size, 1);
    assert.equal(repository.getByEmail("PERSON@EXAMPLE.COM")?.id, "account-1");
  });

  it("rejects a duplicate normalized identity with a safe issue", async () => {
    const repository = new InMemoryAccountRepository();
    await repository.create(makeRecord());
    const duplicate = await repository.create(makeRecord());

    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.issue.code, "already-exists");
    }
  });

  it("serializes concurrent duplicate attempts so only one succeeds", async () => {
    const lock = new AccountWriteLock();
    const repository = new InMemoryAccountRepository({ lock });
    const attempts = await Promise.all([
      repository.create(makeRecord({ account: { id: "a", email: "person@example.com", createdAt: timestamp, updatedAt: timestamp } })),
      repository.create(makeRecord({ account: { id: "b", email: " Person@Example.com ", createdAt: timestamp, updatedAt: timestamp } })),
      repository.create(makeRecord({ account: { id: "c", email: "PERSON@EXAMPLE.COM", createdAt: timestamp, updatedAt: timestamp } })),
    ]);

    const succeeded = attempts.filter((result) => result.ok);
    assert.equal(succeeded.length, 1);
    assert.equal(repository.size, 1);
  });

  it("does not leak storage details through the result contract", async () => {
    const repository = new InMemoryAccountRepository();
    const result = await repository.create(makeRecord());

    if (result.ok) {
      assert.equal("issue" in result, false);
    } else {
      assert.equal(typeof result.issue.code, "string");
    }
  });
});

describe("credential repository (production infrastructure)", () => {
  it("stores and retrieves credentials by normalized email", async () => {
    const repository = new InMemoryAccountCredentialRepository();
    await repository.putCredential({
      accountId: "account-1",
      email: " Person@Example.com ",
      passwordHash: "hashed-password",
    });

    assert.equal(repository.size, 1);
    const found = await repository.findByEmail("PERSON@EXAMPLE.COM");
    assert.equal(found.ok, true);
    if (!found.ok) return;
    assert.equal(found.value?.accountId, "account-1");
    assert.equal(found.value?.email, "person@example.com");
    assert.equal(found.value?.passwordHash, "hashed-password");
  });

  it("returns null for an unknown email", async () => {
    const repository = new InMemoryAccountCredentialRepository();
    const found = await repository.findByEmail("missing@example.com");
    assert.equal(found.ok, true);
    if (!found.ok) return;
    assert.equal(found.value, null);
  });
});

describe("account persistence composition (production infrastructure)", () => {
  it("atomically stores account and credential together", async () => {
    const persistence = createAccountPersistence();
    const created = await persistence.createAccount(makeRecord());

    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.account.id, "account-1");
    assert.equal((persistence.repository as InMemoryAccountRepository).size, 1);
    assert.equal(persistence.credentials.size, 1);

    const credential = await persistence.getCredentialByEmail("PERSON@EXAMPLE.COM");
    assert.equal(credential?.accountId, "account-1");
    assert.equal(credential?.passwordHash, "hashed-password");
  });

  it("rejects a duplicate account without storing a credential", async () => {
    const persistence = createAccountPersistence();
    await persistence.createAccount(makeRecord({ account: { id: "a", email: "person@example.com", createdAt: timestamp, updatedAt: timestamp } }));
    const duplicate = await persistence.createAccount(makeRecord({ account: { id: "b", email: " Person@Example.com ", createdAt: timestamp, updatedAt: timestamp } }));

    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.code, "already-exists");
    assert.equal((persistence.repository as InMemoryAccountRepository).size, 1);
    assert.equal(persistence.credentials.size, 1);
  });
});