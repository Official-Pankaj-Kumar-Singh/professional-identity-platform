/**
 * @file recovery/types.ts
 *
 * Password-recovery boundary (Tasks #121–#126).
 *
 * A recovery request is privacy-preserving: the response never reveals
 * whether an account exists. A time-limited, single-use token is issued
 * only when the account exists; the token carries no account identity in
 * its public form.
 */

import type { AccountId } from "../account/types";

/** Public recovery token. Never contains the account identity. */
export type RecoveryToken = string;

export interface RecoveryTokenRecord {
  token: RecoveryToken;
  accountId: AccountId;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export type RecoveryErrorCode =
  | "invalid-token"
  | "expired-token"
  | "used-token"
  | "invalid-password"
  | "invalid-input"
  | "storage-failure";

export interface RecoveryError {
  code: RecoveryErrorCode;
  message: string;
  /** Field-level detail. Only ever populated for `invalid-input` / `invalid-password`. */
  fields?: Readonly<Record<string, string>>;
}

export type RequestRecoveryResult =
  | { ok: true; token: RecoveryToken | null }
  | { ok: false; error: RecoveryError };

export type ConsumeTokenResult =
  | { ok: true; accountId: AccountId }
  | { ok: false; error: RecoveryError };

export interface RecoveryRepository {
  /**
   * Store a recovery token for an account matching the normalized email.
   * Returns the public token when the account exists, otherwise null — the
   * caller must not infer account existence from the null.
   */
  create(email: string, record: RecoveryTokenRecord): Promise<RecoveryToken | null>;
  /**
   * Inspect a token **without consuming it** (Task #124).
   *
   * Separated from `consume` deliberately. The reset flow has to check the new
   * password and hash it before it burns the user's only recovery link; if
   * validation and consumption were a single step, an ordinary rejection or a
   * transient hashing failure would leave the user with a dead link and no way
   * forward short of requesting another one.
   */
  validate(token: string): Promise<ConsumeTokenResult>;
  /** Consume a token; invalid/expired/used tokens are reported through the result. */
  consume(token: string): Promise<ConsumeTokenResult>;
}

/**
 * Where a recovery token is delivered (Task #122).
 *
 * Deliberately a boundary rather than an email integration. This platform has
 * no mail transport, so a concrete provider would be speculative
 * infrastructure. The default implementation records deliveries in an in-memory
 * outbox; a real deployment swaps in a mailer without any caller changing.
 *
 * The HTTP surface never reads from here — the token must not travel back to
 * the requester, because returning it would turn "submit an email address" into
 * a way to reset any account whose address you know.
 */
export interface RecoveryTokenDelivery {
  deliver(message: RecoveryDeliveryMessage): Promise<void>;
  /** Optional teardown used by tests to isolate state between cases. */
  clear?(): void;
}

export interface RecoveryDeliveryMessage {
  readonly token: RecoveryToken;
  readonly accountId: AccountId;
  readonly email: string;
  readonly expiresAt: string;
}

export interface RecoveryDependencies {
  repository: RecoveryRepository;
  createRecoveryToken: () => RecoveryToken;
  now: () => string;
  tokenTtlMs: number;
}