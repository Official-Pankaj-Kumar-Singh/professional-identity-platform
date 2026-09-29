/**
 * @file recovery/repository.ts
 *
 * In-memory recovery-token store.
 *
 * Tokens are keyed by their public value. Consuming a token marks it used
 * and returns the associated account; invalid, expired, and already-used
 * tokens are all reported as distinct failure codes so callers can drive
 * the UI without ever learning whether an account exists.
 */

import type { ConsumeTokenResult, RecoveryTokenRecord } from "./types";

export interface InMemoryRecoveryRepositoryOptions {
  readonly clock?: () => string;
}

export class InMemoryRecoveryRepository {
  private readonly records = new Map<string, RecoveryTokenRecord>();
  private readonly clock: () => string;

  constructor(options: InMemoryRecoveryRepositoryOptions = {}) {
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  async create(email: string, record: RecoveryTokenRecord): Promise<string | null> {
    void email;
    this.records.set(record.token, record);
    return record.token;
  }

  async consume(token: string): Promise<ConsumeTokenResult> {
    const record = this.records.get(token);
    if (!record) return { ok: false, error: { code: "invalid-token", message: "This recovery link is not valid." } };

    if (record.usedAt) return { ok: false, error: { code: "used-token", message: "This recovery link has already been used." } };

    const expiresAt = Date.parse(record.expiresAt);
    const current = Date.parse(this.clock());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(current) || current >= expiresAt) {
      return { ok: false, error: { code: "expired-token", message: "This recovery link has expired." } };
    }

    this.records.set(token, { ...record, usedAt: this.clock() });
    return { ok: true, accountId: record.accountId };
  }

  /** Test/dev helper. */
  clear(): void {
    this.records.clear();
  }

  /** Test/dev helper. */
  get size(): number {
    return this.records.size;
  }
}

export type { ConsumeTokenResult };