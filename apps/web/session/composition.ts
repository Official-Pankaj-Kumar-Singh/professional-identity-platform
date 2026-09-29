/**
 * @file session/composition.ts
 *
 * Application composition for session management (Tasks #106–#120).
 *
 * Wires the storage-agnostic `createSessionService` to the in-memory
 * session repository, a UUID-based session-ID generator, and the system
 * clock. The resulting service is what the login/logout routes and the
 * protected-resource middleware consume.
 */

import { AccountWriteLock } from "../account/lock";
import { InMemorySessionRepository } from "./repository";
import { createSessionService } from "./service";
import type { Session, SessionDependencies, SessionEvaluation } from "./types";

export interface SessionComposition {
  readonly repository: InMemorySessionRepository;
  create(accountId: string): Promise<{ ok: true; session: Session } | { ok: false }>;
  evaluate(id: string): Promise<SessionEvaluation>;
  logout(id: string): Promise<{ ok: true; destroyed: boolean } | { ok: false }>;
  logoutAllForAccount(accountId: string): Promise<{ ok: true; revoked: number } | { ok: false }>;
  clear(): void;
}

export function createSessionComposition(options: { lock?: AccountWriteLock; ttlMs?: number } = {}): SessionComposition {
  const lock = options.lock ?? new AccountWriteLock();
  const repository = new InMemorySessionRepository({ lock });
  const service = createSessionService({
    repository,
    createSessionId: () => globalThis.crypto?.randomUUID?.() ?? `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    now: () => new Date().toISOString(),
    sessionTtlMs: options.ttlMs ?? 24 * 60 * 60 * 1000,
  });

  return {
    repository,
    create: async (accountId) => {
      const result = await service.create(accountId);
      if (!result.ok) return { ok: false };
      return { ok: true, session: result.value };
    },
    evaluate: (id) => service.evaluate(id),
    logout: async (id) => {
      const result = await service.logout(id);
      if (!result.ok) return { ok: false };
      return { ok: true, destroyed: result.value };
    },
    logoutAllForAccount: async (accountId) => {
      const result = await service.logoutAllForAccount(accountId);
      if (!result.ok) return { ok: false };
      return { ok: true, revoked: result.value };
    },
    clear: () => repository.clear(),
  };
}

export type { SessionDependencies, SessionEvaluation };