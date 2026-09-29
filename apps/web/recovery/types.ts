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
  | "storage-failure";

export interface RecoveryError {
  code: RecoveryErrorCode;
  message: string;
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
  /** Consume a token; invalid/expired/used tokens are reported through the result. */
  consume(token: string): Promise<ConsumeTokenResult>;
}

export interface RecoveryDependencies {
  repository: RecoveryRepository;
  createRecoveryToken: () => RecoveryToken;
  now: () => string;
  tokenTtlMs: number;
}