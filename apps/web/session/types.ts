/**
 * @file session/types.ts
 *
 * Session boundary for EPIC-01 (Tasks #106–#120).
 *
 * A session is the authenticated state that follows a successful sign-in.
 * It is intentionally decoupled from the credential contract: the session
 * stores only a stable account reference, never credentials.
 *
 * Sessions expire. Expiration is evaluated at access time so the same
 * session object can be reused across requests without re-checking the
 * clock on every read.
 */

import type { AccountId } from "../account/types";

/** Stable session identifier. */
export type SessionId = string;

/** Session state after expiration has been evaluated. */
export type SessionStatus = "active" | "expired" | "revoked" | "not-found";

/** Public session representation. Never contains credentials. */
export interface Session {
  id: SessionId;
  accountId: AccountId;
  createdAt: string;
  /** Session is invalid at or after this instant. */
  expiresAt: string;
  updatedAt: string;
}

/** Input accepted only when creating a session. */
export interface CreateSessionInput {
  accountId: AccountId;
  /** Absolute expiry timestamp in ISO 8601 UTC. */
  expiresAt: string;
}

/** Result of evaluating a session against the current time. */
export interface SessionEvaluation {
  status: SessionStatus;
  session: Session | null;
}

export type SessionRepositoryErrorCode = "not-found" | "storage-failure";

export interface SessionRepositoryIssue {
  code: SessionRepositoryErrorCode;
}

export type SessionRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: SessionRepositoryIssue };

/** Storage-agnostic session boundary. */
export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRepositoryResult<Session>>;
  get(id: SessionId): Promise<SessionRepositoryResult<Session | null>>;
  /** Returns the session only when it is still valid at the supplied clock. */
  getValid(id: SessionId, now: () => string): Promise<SessionEvaluation>;
  /**
   * Extends a still-valid session's expiry and stamps its last-use time
   * (Task #113). Returns the renewed session, or `null` when the session is
   * unknown or already expired — an expired session is never resurrected. A
   * `null` `expiresAt` means policy declined to renew and the record is
   * returned unchanged.
   */
  renew(id: SessionId, now: string, expiresAt: string | null): Promise<SessionRepositoryResult<Session | null>>;
  destroy(id: SessionId): Promise<SessionRepositoryResult<boolean>>;
  /** Destroy every session for an account (used on logout-all and deletion). */
  destroyAllForAccount(accountId: AccountId): Promise<SessionRepositoryResult<number>>;
}

export interface SessionDependencies {
  repository: SessionRepository;
  createSessionId: () => SessionId;
  now: () => string;
  /** Session lifetime in milliseconds. */
  sessionTtlMs: number;
}