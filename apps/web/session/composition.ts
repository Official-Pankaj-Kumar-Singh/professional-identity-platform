/**
 * @file session/composition.ts
 *
 * Application composition for session management (Tasks #106–#120).
 *
 * Wires the storage-agnostic `createSessionService` to the in-memory
 * session repository, a UUID-based session-ID generator, and the clock. The
 * resulting service is what the login/logout routes and the
 * protected-resource middleware consume.
 *
 * Lifetime comes from `session/policy.ts` rather than a literal here, so the
 * policy is stated in exactly one place (Task #112).
 *
 * Clock seam (Task #113): both `now` and the evaluation clock are injectable.
 * `createSessionService` already accepted an `evaluateClock`, but this factory
 * hardcoded the system clock and never threaded it through, which left session
 * expiry untestable at any boundary above the service. Expiration is the entire
 * subject of #114 and #117, and testing it against a real route requires
 * controlling time. Injecting the clock is the smallest change that makes those
 * tests deterministic instead of dependent on wall-clock sleeps. Production
 * callers pass nothing and get the system clock.
 */

import { AccountWriteLock } from "../account/lock";
import { InMemorySessionRepository } from "./repository";
import { createSessionService } from "./service";
import { SESSION_LIFETIME_MS, renewedExpiry } from "./policy";
import type { Session, SessionDependencies, SessionEvaluation } from "./types";

export interface SessionComposition {
  readonly repository: InMemorySessionRepository;
  /**
   * The clock this composition issues and evaluates sessions against.
   *
   * Exposed so a caller deriving a cookie lifetime from a session's `expiresAt`
   * uses the *same* clock the store does. A route computing "seconds remaining"
   * with its own `Date.now()` agrees with the store only by coincidence, and the
   * two silently diverge as soon as the clock is anything other than wall time.
   */
  now(): string;
  create(accountId: string): Promise<{ ok: true; session: Session } | { ok: false }>;
  evaluate(id: string): Promise<SessionEvaluation>;
  /**
   * Slides a valid session forward. Returns the renewed session, or `null` when
   * the session is unknown or expired — an expired session is never extended.
   */
  refresh(id: string): Promise<{ ok: true; session: Session | null } | { ok: false }>;
  logout(id: string): Promise<{ ok: true; destroyed: boolean } | { ok: false }>;
  logoutAllForAccount(accountId: string): Promise<{ ok: true; revoked: number } | { ok: false }>;
  clear(): void;
}

export interface SessionCompositionOptions {
  readonly lock?: AccountWriteLock;
  /** Session lifetime in milliseconds. Defaults to the policy lifetime. */
  readonly ttlMs?: number;
  /** Issue-time clock. Defaults to the system clock. */
  readonly now?: () => string;
  /** Expiry-evaluation clock. Defaults to the issue-time clock. */
  readonly evaluateClock?: () => string;
}

export function createSessionComposition(options: SessionCompositionOptions = {}): SessionComposition {
  const lock = options.lock ?? new AccountWriteLock();
  const repository = new InMemorySessionRepository({ lock });
  const now = options.now ?? (() => new Date().toISOString());
  const service = createSessionService(
    {
      repository,
      createSessionId: () => globalThis.crypto?.randomUUID?.() ?? `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      now,
      sessionTtlMs: options.ttlMs ?? SESSION_LIFETIME_MS,
    },
    { evaluateClock: options.evaluateClock ?? now },
  );

  return {
    repository,
    now,
    create: async (accountId) => {
      const result = await service.create(accountId);
      if (!result.ok) return { ok: false };
      return { ok: true, session: result.value };
    },
    evaluate: (id) => service.evaluate(id),
    refresh: async (id) => {
      const result = await service.refresh(id);
      if (!result.ok) return { ok: false };
      return { ok: true, session: result.value };
    },
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

export { renewedExpiry };
export type { SessionDependencies, SessionEvaluation };