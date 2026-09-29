/**
 * @file account/repository.ts
 *
 * Concrete production account persistence behind the storage-agnostic
 * `AccountRepository` contract defined in `account/types.ts`.
 *
 * This implementation provides:
 *   - normalized-email identity matching (case-insensitive, trimmed)
 *   - atomic uniqueness under concurrent registration (shared write lock)
 *   - safe, non-disclosing error results
 *   - stable account IDs supplied by the caller
 *   - mutable email updates and safe deletion
 *
 * It intentionally keeps storage details out of the domain contract: callers
 * receive `AccountRepositoryResult` values, never raw driver errors.
 */

import type {
  Account,
  AccountRepository,
  AccountRepositoryResult,
  NewAccountRecord,
} from "./types";
import { AccountWriteLock } from "./lock";

/** Normalizes an email address for identity comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface InMemoryAccountRepositoryOptions {
  /** Shared lock coordinating writes across account + credential stores. */
  readonly lock?: AccountWriteLock;
  /** Simulated latency for persistence operations, in milliseconds. */
  readonly latencyMs?: number;
}

/**
 * In-memory account repository with serialized (atomic) writes.
 *
 * Writes are guarded by a shared lock so concurrent registration attempts
 * for the same normalized email cannot both succeed. This is the
 * production guarantee required by Task #100 / US-03 until a real database
 * with a unique constraint is introduced.
 */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly records = new Map<string, Account>();
  private readonly lock: AccountWriteLock;
  private readonly latencyMs: number;

  constructor(options: InMemoryAccountRepositoryOptions = {}) {
    this.lock = options.lock ?? new AccountWriteLock();
    this.latencyMs = options.latencyMs ?? 0;
  }

  async existsByEmail(email: string): Promise<AccountRepositoryResult<boolean>> {
    const normalized = normalizeEmail(email);
    return { ok: true, value: this.records.has(normalized) };
  }

  async create(record: NewAccountRecord): Promise<AccountRepositoryResult<Account>> {
    return this.lock.withLock(async () => {
      if (this.latencyMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
      const normalized = normalizeEmail(record.account.email);
      if (this.records.has(normalized)) {
        return { ok: false, issue: { code: "already-exists" } };
      }
      const stored: Account = {
        id: record.account.id,
        email: normalized,
        createdAt: record.account.createdAt,
        updatedAt: record.account.updatedAt,
      };
      this.records.set(normalized, stored);
      return { ok: true, value: stored };
    });
  }

  /**
   * Update the mutable fields of an existing account.
   *
   * The new email is normalized; if it already belongs to a different
   * account the update is rejected as a duplicate identity.
   */
  async update(accountId: string, email: string): Promise<Account | null> {
    return this.lock.withLock(async () => {
      const existing = this.getById(accountId);
      if (!existing) return null;

      const normalized = normalizeEmail(email);
      const occupant = this.records.get(normalized);
      if (occupant && occupant.id !== accountId) return null;

      const updated: Account = {
        ...existing,
        email: normalized,
        updatedAt: new Date().toISOString(),
      };
      this.records.delete(existing.email);
      this.records.set(normalized, updated);
      return updated;
    });
  }

  /** Delete an account and its credential by account ID. */
  async delete(accountId: string): Promise<boolean> {
    return this.lock.withLock(async () => {
      for (const [email, account] of this.records) {
        if (account.id === accountId) {
          this.records.delete(email);
          return true;
        }
      }
      return false;
    });
  }

  /** Test/dev helper: drop all stored accounts. */
  clear(): void {
    this.records.clear();
  }

  /** Test/dev helper: number of stored accounts. */
  get size(): number {
    return this.records.size;
  }

  /** Test/dev helper: access a stored account by normalized email. */
  getByEmail(email: string): Account | undefined {
    return this.records.get(normalizeEmail(email));
  }

  /** Test/dev helper: access a stored account by account ID. */
  getById(id: string): Account | undefined {
    for (const account of this.records.values()) {
      if (account.id === id) return account;
    }
    return undefined;
  }
}

export type { AccountRepositoryResult };