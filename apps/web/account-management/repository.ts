/**
 * @file account-management/repository.ts
 *
 * Concrete account-management repository backed by the account persistence
 * boundary. Delegates to `AccountPersistence` so read/update/delete share the
 * same normalized-email identity and atomic write lock as registration.
 */

import { normalizeEmail } from "../account/repository";
import type { AccountManagementRepository, AccountUpdatePatch } from "./types";
import type { AccountPersistence } from "../account/persistence";

function notFoundError() {
  return { code: "not-found" as const, message: "Account not found." };
}
function duplicateError() {
  return { code: "duplicate-identity" as const, message: "That account identity is already in use." };
}
function invalidError() {
  return { code: "invalid-input" as const, message: "Check the account details and try again." };
}
function storageError() {
  return { code: "storage-failure" as const, message: "We could not update your account right now." };
}

export class AccountPersistenceManagementRepository implements AccountManagementRepository {
  constructor(private readonly persistence: AccountPersistence) {}

  async findById(accountId: string) {
    return this.persistence.getAccountById(accountId);
  }

  async findByEmail(email: string) {
    return this.persistence.getAccountByEmail(email);
  }

  async update(accountId: string, patch: AccountUpdatePatch) {
    const existing = this.persistence.getAccountById(accountId);
    if (!existing) return { ok: false as const, error: notFoundError() };

    const nextEmail = patch.email !== undefined ? normalizeEmail(patch.email) : existing.email;
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return { ok: false as const, error: invalidError() };
    }

    const occupant = this.persistence.getAccountByEmail(nextEmail);
    if (occupant && occupant.id !== accountId) {
      return { ok: false as const, error: duplicateError() };
    }

    try {
      const updated = await this.persistence.updateAccount(accountId, nextEmail);
      if (!updated) return { ok: false as const, error: storageError() };
      return { ok: true as const, account: updated };
    } catch {
      return { ok: false as const, error: storageError() };
    }
  }

  async delete(accountId: string) {
    const existing = this.persistence.getAccountById(accountId);
    if (!existing) return { ok: false as const, error: notFoundError() };

    try {
      const deleted = await this.persistence.deleteAccount(accountId);
      if (!deleted) return { ok: false as const, error: storageError() };
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: storageError() };
    }
  }
}

export type { AccountManagementRepository };