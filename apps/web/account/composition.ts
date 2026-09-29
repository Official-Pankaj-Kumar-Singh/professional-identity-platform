/**
 * @file account/composition.ts
 *
 * Application composition for account registration. Wires the storage-agnostic
 * `createAccountService` to the production persistence and password-hashing
 * implementations.
 *
 * The service itself never touches storage directly; this module supplies the
 * concrete `AccountRepository`, `PasswordHasher`, account-ID generator, and
 * clock. Callers receive the existing `AccountCreationResult` contract.
 */

import { createAccountPersistence, type AccountPersistence } from "./persistence";
import { createPasswordHasher } from "../auth/password-hasher";
import { createAccountService } from "./create-account";
import type { Account, AccountCreationDependencies, AccountCreationResult, RegistrationInput } from "./types";

export interface AccountComposition {
  readonly persistence: AccountPersistence;
  create(input: RegistrationInput): Promise<AccountCreationResult>;
  clear(): void;
}

/**
 * Build a registration service whose repository delegates to the atomic
 * `createAccount` boundary. The service's `repository.create` call therefore
 * stores the account and its credential together under the shared lock, and
 * the service's `existsByEmail` check is answered by the same store.
 */
function createDelegatingRepository(persistence: AccountPersistence): AccountCreationDependencies["repository"] {
  return {
    async existsByEmail(email) {
      return persistence.repository.existsByEmail(email);
    },
    async create(record) {
      const result = await persistence.createAccount(record);
      if (!result.ok) {
        return { ok: false, issue: { code: result.code === "already-exists" ? "already-exists" : "storage-failure" } };
      }
      return { ok: true, value: result.account };
    },
  };
}

export function createAccountComposition(): AccountComposition {
  const persistence = createAccountPersistence();
  const { hasher } = createPasswordHasher();
  const service = createAccountService({
    repository: createDelegatingRepository(persistence),
    passwordHasher: hasher,
    createAccountId: () => globalThis.crypto?.randomUUID?.() ?? `account-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    now: () => new Date().toISOString(),
  });

  return {
    persistence,
    create: (input) => service.create(input),
    clear: () => persistence.clear(),
  };
}

export type { AccountCreationDependencies, AccountCreationResult, RegistrationInput, Account };