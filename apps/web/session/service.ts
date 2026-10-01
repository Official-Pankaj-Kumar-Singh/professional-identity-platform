/**
 * @file session/service.ts
 *
 * Session lifecycle service (Tasks #106–#117).
 *
 * - `createSession` issues a fresh session for an authenticated account.
 * - `evaluateSession` returns the session only when it is still active at the
 *   supplied clock, so callers can reuse one evaluation across requests.
 * - `refreshSession` slides a valid session's expiry forward so an active user
 *   is not signed out mid-use (Task #113).
 * - `logout` destroys a session and reports whether one was found.
 * - `logoutAllForAccount` revokes every session for an account.
 *
 * Failures are reported through the existing result-union style; no storage
 * details leak into public results.
 */

import { renewedExpiry } from "./policy";
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
  refresh(id: string): Promise<SessionRepositoryResult<Session | null>>;
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

    /**
     * Slides a still-valid session's expiry forward (Task #113).
     *
     * This is what makes continuity work: a user who keeps using the application
     * is not signed out while they work, while an idle session still expires
     * because renewal only ever happens on a request that already presented a
     * valid session.
     *
     * Returns the renewed session, or `null` when the session is unknown or
     * already expired. Refusing to renew an expired session is deliberate and is
     * what makes the pre-expiry evaluation in `evaluate` authoritative — without
     * it, the first request after expiry could quietly extend the session
     * instead of rejecting it.
     */
    async refresh(id: string): Promise<SessionRepositoryResult<Session | null>> {
      const timestamp = now();
      const current = await repository.getValid(id, evaluateClock);
      // A session that is not currently active is never extended. `not-found`
      // means unknown or already destroyed; either way there is nothing to renew.
      if (current.status !== "active" || !current.session) {
        return { ok: true, value: null };
      }
      return repository.renew(id, timestamp, renewedExpiry(timestamp, sessionTtlMs));
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