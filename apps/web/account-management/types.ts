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

/**
 * Error codes the account-management boundary can produce.
 *
 * `unauthenticated` and `forbidden` are raised by the authorization step in
 * `service.ts`; `confirmation-required` by the deletion guard; the remainder are
 * produced by the repository. They are declared together so the route's status
 * mapping and the service's results cannot drift apart.
 */
export type AccountManagementErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "unauthorized"
  | "duplicate-identity"
  | "invalid-input"
  | "confirmation-required"
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

/**
 * The only account fields a client may change (Task #130).
 *
 * This is an explicit allowlist rather than "everything except the protected
 * fields", because a deny-list silently widens: any field added to the account
 * later would become writable without anyone deciding it should be.
 *
 * Everything else on `Account` is immutable to a client:
 *
 * - `id` is the account's stable identity and the key ownership is decided on.
 * - `createdAt` and `updatedAt` are maintained by the system.
 *
 * Credential material is not part of the account record at all, so there is no
 * password field to accidentally expose here. Changing a password is not part of
 * this contract; credential recovery owns it.
 */
export const MUTABLE_ACCOUNT_FIELDS = ["email"] as const;

export type MutableAccountField = (typeof MUTABLE_ACCOUNT_FIELDS)[number];

/** Fields a client may never send, and which are rejected if present. */
export const PROTECTED_ACCOUNT_FIELDS = ["id", "createdAt", "updatedAt", "accountId", "password", "passwordHash"] as const;

/**
 * The account representation returned to clients (Task #127).
 *
 * Deliberately a distinct type from `Account` so a future field added to the
 * stored record cannot leak into a response by accident: the route serializes
 * this shape explicitly. It contains no credential material.
 */
export interface AccountView {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Projects an `Account` onto the safe public representation. */
export function toAccountView(account: Account): AccountView {
  return { id: account.id, email: account.email, createdAt: account.createdAt, updatedAt: account.updatedAt };
}