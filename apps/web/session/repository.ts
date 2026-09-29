/**
 * @file session/repository.ts
 *
 * In-memory session repository with serialized writes and explicit
 * expiration evaluation.
 *
 * Reads are lock-free; creation and destruction are serialized through a
 * shared lock so concurrent session creation for the same account cannot
 * produce duplicate active sessions where the architecture forbids it.
 */

import { AccountWriteLock } from "../account/lock";
import type {
  Session,
  SessionEvaluation,
  SessionRepository,
  SessionRepositoryResult,
} from "./types";

export interface InMemorySessionRepositoryOptions {
  readonly lock?: AccountWriteLock;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();
  private readonly lock: AccountWriteLock;

  constructor(options: InMemorySessionRepositoryOptions = {}) {
    this.lock = options.lock ?? new AccountWriteLock();
  }

  async create(input: { id: string; accountId: string; createdAt: string; expiresAt: string }): Promise<SessionRepositoryResult<Session>> {
    return this.lock.withLock(async () => {
      const session: Session = {
        id: input.id,
        accountId: input.accountId,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
        updatedAt: input.createdAt,
      };
      this.sessions.set(session.id, session);
      return { ok: true, value: session };
    });
  }

  async get(id: string): Promise<SessionRepositoryResult<Session | null>> {
    const session = this.sessions.get(id);
    return { ok: true, value: session ?? null };
  }

  async getValid(id: string, now: () => string): Promise<SessionEvaluation> {
    const session = this.sessions.get(id);
    if (!session) return { status: "not-found", session: null };

    const current = Date.parse(now());
    const expiresAt = Date.parse(session.expiresAt);
    if (!Number.isFinite(current) || !Number.isFinite(expiresAt) || current >= expiresAt) {
      return { status: "expired", session };
    }
    return { status: "active", session };
  }

  async destroy(id: string): Promise<SessionRepositoryResult<boolean>> {
    return this.lock.withLock(async () => {
      const existed = this.sessions.delete(id);
      return { ok: true, value: existed };
    });
  }

  async destroyAllForAccount(accountId: string): Promise<SessionRepositoryResult<number>> {
    return this.lock.withLock(async () => {
      let count = 0;
      for (const [id, session] of this.sessions) {
        if (session.accountId === accountId) {
          this.sessions.delete(id);
          count += 1;
        }
      }
      return { ok: true, value: count };
    });
  }

  /** Test/dev helper. */
  clear(): void {
    this.sessions.clear();
  }

  /** Test/dev helper. */
  get size(): number {
    return this.sessions.size;
  }
}

export type { SessionRepositoryResult };