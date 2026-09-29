import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountComposition } from "../account/composition";
import { AccountPersistenceManagementRepository } from "../account-management/repository";
import type { Account } from "../account/types";

const rawPassword = "correct horse battery staple";

async function seedAccount(): Promise<{ composition: ReturnType<typeof createAccountComposition>; account: Account }> {
  const composition = createAccountComposition();
  const result = await composition.create({ email: "person@example.com", password: rawPassword });
  if (!result.ok) throw new Error("seed failed");
  return { composition, account: result.account };
}

describe("account management (Tasks #127–#135)", () => {
  it("reads an account by its stable account ID", async () => {
    const { composition, account } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);
    const read = await repository.findById(account.id);

    assert.ok(read);
    assert.equal(read.id, account.id);
    assert.equal(read.email, "person@example.com");
    assert.equal("password" in read, false);
    assert.equal("passwordHash" in read, false);
  });

  it("updates the email with normalization and rejects duplicates", async () => {
    const { composition, account } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);

    const updated = await repository.update(account.id, { email: " Person@Example.com " });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.account.email, "person@example.com");

    // Updating to the same email the account already holds is a no-op success.
    const same = await repository.update(account.id, { email: "person@example.com" });
    assert.equal(same.ok, true);
    if (!same.ok) return;
    assert.equal(same.account.email, "person@example.com");

    // A different account cannot claim the same email.
    const other = await composition.create({ email: "other@example.com", password: rawPassword });
    if (!other.ok) throw new Error("second seed failed");
    const duplicate = await repository.update(other.account.id, { email: "person@example.com" });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error.code, "duplicate-identity");
  });

  it("rejects an invalid email update", async () => {
    const { composition, account } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);

    const invalid = await repository.update(account.id, { email: "bad" });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.error.code, "invalid-input");
  });

  it("rejects updates for a nonexistent account", async () => {
    const { composition } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);

    const missing = await repository.update("missing", { email: "other@example.com" });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error.code, "not-found");
  });

  it("deletes an account and its credential", async () => {
    const { composition, account } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);

    const deleted = await repository.delete(account.id);
    assert.equal(deleted.ok, true);

    const read = await repository.findById(account.id);
    assert.equal(read, null);
    assert.equal(composition.persistence.accountCount, 0);
    assert.equal(composition.persistence.credentials.size, 0);
  });

  it("rejects deletion of a nonexistent account", async () => {
    const { composition } = await seedAccount();
    const repository = new AccountPersistenceManagementRepository(composition.persistence);

    const missing = await repository.delete("missing");
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error.code, "not-found");
  });
});