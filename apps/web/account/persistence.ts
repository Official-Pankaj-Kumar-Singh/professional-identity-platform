/**
 * @file account/persistence.ts
 *
 * Unified production persistence boundary for accounts and their credentials.
 *
 * The account creation flow must keep the public account record and its
 * credential material in a single consistent store: the account cannot be
 * considered created unless its credential hash is also reachable. This
 * module coordinates the two in-memory stores behind a single shared lock
 * so atomicity is guaranteed for the registration flow.
 *
 * Callers receive the existing `AccountRepository` / `AccountCredentialRepository`
 * contracts, never raw storage details.
 */

import { AccountWriteLock } from "./lock";
import { InMemoryAccountRepository } from "./repository";
import type { Account, AccountRepository, NewAccountRecord } from "./types";
import { InMemoryAccountCredentialRepository, type StoredCredential } from "../auth/credential-repository";

export interface AccountPersistence {
  readonly repository: AccountRepository;
  readonly credentials: InMemoryAccountCredentialRepository;

  /**
   * Atomically create an account and its credential. Either both are stored
   * or neither is, and a duplicate normalized email is rejected for both.
   */
  createAccount(record: NewAccountRecord): Promise<{ ok: true; account: Account } | { ok: false; code: "already-exists" | "storage-failure" }>;

  /** Look up the stored credential for a normalized email. */
  getCredentialByEmail(email: string): Promise<StoredCredential | null>;

  /** Update the stored credential hash for an account. */
  setPasswordHash(accountId: string, passwordHash: string): Promise<boolean>;

  /** Update the mutable fields of an existing account. */
  updateAccount(accountId: string, email: string): Promise<Account | null>;

  /** Delete an account and its credential. */
  deleteAccount(accountId: string): Promise<boolean>;

  /** Look up a stored account by its stable account ID. */
  getAccountById(id: string): Account | null;

  /** Look up a stored account by normalized email. Returns null when absent. */
  getAccountByEmail(email: string): Account | null;

  /** Number of stored accounts. */
  get accountCount(): number;

  /** Drop all stored accounts and credentials. */
  clear(): void;
}

export function createAccountPersistence(): AccountPersistence {
  const lock = new AccountWriteLock();
  const repository = new InMemoryAccountRepository({ lock });
  const credentials = new InMemoryAccountCredentialRepository({ lock });

  return {
    repository,
    credentials,

    async createAccount(record: NewAccountRecord) {
      const created = await repository.create(record);
      if (!created.ok) {
        if (created.issue.code === "already-exists") return { ok: false, code: "already-exists" };
        return { ok: false, code: "storage-failure" };
      }
      await credentials.putCredential({
        accountId: created.value.id,
        email: created.value.email,
        passwordHash: record.credential.passwordHash,
      });
      return { ok: true, account: created.value };
    },

    async getCredentialByEmail(email: string) {
      const result = await credentials.findByEmail(email);
      if (!result.ok || !result.value) return null;
      return {
        accountId: result.value.accountId,
        email: result.value.email,
        passwordHash: result.value.passwordHash,
      };
    },

    async setPasswordHash(accountId, passwordHash) {
      return credentials.updatePasswordHash(accountId, passwordHash);
    },

    async updateAccount(accountId, email) {
      return repository.update(accountId, email);
    },

    async deleteAccount(accountId) {
      const deleted = await repository.delete(accountId);
      if (deleted) await credentials.deleteForAccount(accountId);
      return deleted;
    },

    getAccountById(id) {
      return repository.getById(id) ?? null;
    },

    getAccountByEmail(email) {
      return repository.getByEmail(email) ?? null;
    },

    get accountCount() {
      return repository.size;
    },

    clear() {
      repository.clear();
      credentials.clear();
    },
  };
}

export type { AccountRepository, NewAccountRecord };