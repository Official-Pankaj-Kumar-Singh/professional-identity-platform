/**
 * @file account-management/types.ts
 *
 * Account read/update/delete boundary (Tasks #127–#135).
 *
 * Updates are restricted to a small, explicit set of mutable fields. The
 * account ID is immutable, and email identity is normalized before any
 * uniqueness check. Authorization is enforced by the caller against the
 * authenticated actor.
 */

import type { Account, AccountId } from "../account/types";

/** Fields that may be mutated on an existing account. */
export interface AccountUpdatePatch {
  readonly email?: string;
}

export type AccountManagementErrorCode =
  | "not-found"
  | "unauthorized"
  | "duplicate-identity"
  | "invalid-input"
  | "storage-failure";

export interface AccountManagementError {
  code: AccountManagementErrorCode;
  message: string;
}

export type AccountReadResult =
  | { ok: true; account: Account }
  | { ok: false; error: AccountManagementError };

export type AccountUpdateResult =
  | { ok: true; account: Account }
  | { ok: false; error: AccountManagementError };

export type AccountDeleteResult =
  | { ok: true }
  | { ok: false; error: AccountManagementError };

export interface AccountManagementRepository {
  /** Look up an account by its stable account ID. */
  findById(accountId: AccountId): Promise<Account | null>;
  /** Look up an account by normalized email. */
  findByEmail(email: string): Promise<Account | null>;
  /**
   * Update the account's mutable fields. Returns the updated account, or
   * `not-found` when no account matches. The caller is responsible for
   * authorization; the repository enforces identity uniqueness.
   */
  update(accountId: AccountId, patch: AccountUpdatePatch): Promise<AccountUpdateResult>;
  /** Delete an account by its stable account ID. */
  delete(accountId: AccountId): Promise<AccountDeleteResult>;
}

export interface AccountManagementDependencies {
  repository: AccountManagementRepository;
  now: () => string;
}