/**
 * @file auth/credential-repository.ts
 *
 * Concrete persistence for the credential lookup boundary defined in
 * `auth/types.ts`. The same store that backs account creation also backs
 * credential verification, so email identity stays consistent across both
 * flows.
 *
 * Writes are guarded by the same shared lock as the account repository so
 * an account and its credential are stored atomically.
 */

import type {
  AccountCredentialRepository,
  AccountRepositoryResult,
} from "./types";
import { normalizeEmail } from "../account/repository";
import { AccountWriteLock } from "../account/lock";

export { normalizeEmail };

export interface StoredCredential {
  readonly accountId: string;
  readonly email: string;
  readonly passwordHash: string;
}

/**
 * Credential store keyed by normalized email. Reads are lock-free; writes
 * are serialized through the shared lock so the account and its credential
 * can never diverge.
 */
export class InMemoryAccountCredentialRepository implements AccountCredentialRepository {
  private readonly credentials = new Map<string, StoredCredential>();
  private readonly lock: AccountWriteLock;

  constructor(options: { lock?: AccountWriteLock } = {}) {
    this.lock = options.lock ?? new AccountWriteLock();
  }

  async findByEmail(email: string): Promise<AccountRepositoryResult<import("./types").AccountCredentialRecord | null>> {
    const normalized = normalizeEmail(email);
    const stored = this.credentials.get(normalized);
    if (!stored) return { ok: true, value: null };
    return {
      ok: true,
      value: {
        accountId: stored.accountId,
        email: stored.email,
        passwordHash: stored.passwordHash,
      },
    };
  }

  /** @internal Test/dev helper: store a credential directly. */
  async putCredential(credential: StoredCredential): Promise<void> {
    await this.lock.withLock(async () => {
      this.credentials.set(normalizeEmail(credential.email), {
        ...credential,
        email: normalizeEmail(credential.email),
      });
    });
  }

  /** Update the stored password hash for an account. Returns false when no credential exists. */
  async updatePasswordHash(accountId: string, passwordHash: string): Promise<boolean> {
    return this.lock.withLock(async () => {
      for (const [email, stored] of this.credentials) {
        if (stored.accountId === accountId) {
          this.credentials.set(email, { ...stored, passwordHash });
          return true;
        }
      }
      return false;
    });
  }

  /** Remove every credential for an account. */
  async deleteForAccount(accountId: string): Promise<number> {
    return this.lock.withLock(async () => {
      let count = 0;
      for (const [email, stored] of this.credentials) {
        if (stored.accountId === accountId) {
          this.credentials.delete(email);
          count += 1;
        }
      }
      return count;
    });
  }

  /** @internal Test/dev helper: drop all stored credentials. */
  clear(): void {
    this.credentials.clear();
  }

  /** @internal Test/dev helper: number of stored credentials. */
  get size(): number {
    return this.credentials.size;
  }
}

export type { AccountCredentialRepository, AccountRepositoryResult };