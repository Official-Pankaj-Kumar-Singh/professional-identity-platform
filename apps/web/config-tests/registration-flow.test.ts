import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { InMemoryAccountRepository } from "../account/repository";
import type { AccountCreationResult } from "../account/types";

const rawPassword = "correct horse battery staple";

function repoSize(composition: ReturnType<typeof createAccountComposition>): number {
  return (composition.persistence.repository as InMemoryAccountRepository).size;
}

describe("registration end-to-end (Tasks #95–#102)", () => {
  it("creates a normalized account, hashes the password, and persists only a hash", async () => {
    const composition = createAccountComposition();
    const result: AccountCreationResult = await composition.create({
      email: "  Person@Example.com ",
      password: rawPassword,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.account.email, "person@example.com");
    assert.equal(typeof result.account.id, "string");
    assert.equal(result.account.id.length > 0, true);
    assert.equal("password" in result.account, false);
    assert.equal("passwordHash" in result.account, false);

    const credential = await composition.persistence.getCredentialByEmail("PERSON@EXAMPLE.COM");
    assert.ok(credential, "credential should be reachable");
    assert.equal(credential?.email, "person@example.com");
    assert.equal(credential?.accountId, result.account.id);
    assert.notEqual(credential?.passwordHash, rawPassword);
    assert.ok(credential?.passwordHash.startsWith("scrypt$"));
  });

  it("rejects missing email or password before touching persistence", async () => {
    const composition = createAccountComposition();
    const noEmail = await composition.create({ email: "   ", password: rawPassword });
    const noPassword = await composition.create({ email: "person@example.com", password: "" });

    assert.equal(noEmail.ok, false);
    assert.equal(noPassword.ok, false);
    assert.equal(repoSize(composition), 0);
  });

  it("rejects malformed email and weak password with field-associated issues", async () => {
    const composition = createAccountComposition();
    const malformed = await composition.create({ email: "bad", password: rawPassword });
    const weak = await composition.create({ email: "person@example.com", password: "short" });

    assert.equal(malformed.ok, false);
    assert.equal(weak.ok, false);
    assert.equal(repoSize(composition), 0);
  });

  it("rejects a duplicate normalized identity without disclosing it", async () => {
    const composition = createAccountComposition();
    await composition.create({ email: " Person@Example.com ", password: rawPassword });
    const duplicate = await composition.create({ email: "PERSON@EXAMPLE.COM", password: rawPassword });

    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, "already-exists");
      assert.equal(duplicate.error.message.includes("person@example.com"), false);
    }
    assert.equal(repoSize(composition), 1);
  });

  it("does not create two accounts under concurrent duplicate attempts", async () => {
    const composition = createAccountComposition();
    const results = await Promise.all([
      composition.create({ email: "person@example.com", password: rawPassword }),
      composition.create({ email: " Person@Example.com ", password: rawPassword }),
      composition.create({ email: "PERSON@EXAMPLE.COM", password: rawPassword }),
    ]);

    const succeeded = results.filter((result) => result.ok);
    assert.equal(succeeded.length, 1);
    assert.equal(repoSize(composition), 1);
    assert.equal(composition.persistence.credentials.size, 1);
  });

  it("never persists the raw password", async () => {
    const composition = createAccountComposition();
    await composition.create({ email: "person@example.com", password: rawPassword });

    const credential = await composition.persistence.getCredentialByEmail("person@example.com");
    assert.ok(credential);
    assert.equal(credential?.passwordHash.includes(rawPassword), false);
  });
});