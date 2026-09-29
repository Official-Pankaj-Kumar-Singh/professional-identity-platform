/**
 * @file session/service.ts
 *
 * Session lifecycle service (Tasks #106–#117).
 *
 * - `createSession` issues a fresh session for an authenticated account.
 * - `evaluateSession` returns the session only when it is still active at the
 *   supplied clock, so callers can reuse one evaluation across requests.
 * - `logout` destroys a session and reports whether one was found.
 * - `logoutAllForAccount` revokes every session for an account.
 *
 * Failures are reported through the existing result-union style; no storage
 * details leak into public results.
 */

import type {
  Session,
  SessionDependencies,
  SessionEvaluation,
  SessionRepository,
  SessionRepositoryResult,
  SessionStatus,
} from "./types";

const REVOKED: SessionEvaluation["status"] = "revoked";

export interface SessionServiceOptions {
  /** Clock used when evaluating sessions for expiration. Defaults to `now`. */
  readonly evaluateClock?: () => string;
}

export function createSessionService(
  dependencies: SessionDependencies,
  options: SessionServiceOptions = {},
): {
  create(accountId: string): Promise<SessionRepositoryResult<Session>>;
  evaluate(id: string): Promise<SessionEvaluation>;
  logout(id: string): Promise<SessionRepositoryResult<boolean>>;
  logoutAllForAccount(accountId: string): Promise<SessionRepositoryResult<number>>;
} {
  const { repository, createSessionId, now, sessionTtlMs } = dependencies;
  const evaluateClock = options.evaluateClock ?? now;

  return {
    async create(accountId: string): Promise<SessionRepositoryResult<Session>> {
      const timestamp = now();
      const expiresAt = new Date(Date.parse(timestamp) + sessionTtlMs).toISOString();
      const session: Session = {
        id: createSessionId(),
        accountId,
        createdAt: timestamp,
        expiresAt,
        updatedAt: timestamp,
      };
      return repository.create(session);
    },

    async evaluate(id: string): Promise<SessionEvaluation> {
      const result = await repository.getValid(id, evaluateClock);
      if (result.status === "not-found") return { status: REVOKED, session: null };
      if (!result.session) return { status: REVOKED, session: null };
      return result;
    },

    async logout(id: string): Promise<SessionRepositoryResult<boolean>> {
      return repository.destroy(id);
    },

    async logoutAllForAccount(accountId: string): Promise<SessionRepositoryResult<number>> {
      return repository.destroyAllForAccount(accountId);
    },
  };
}

export type { SessionStatus, SessionEvaluation, SessionRepository };