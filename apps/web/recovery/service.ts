/**
 * @file recovery/service.ts
 *
 * Password-recovery service (Tasks #121–#126).
 *
 * - `requestRecovery` is privacy-preserving: it returns the same generic
 *   success response whether or not the email exists, and only issues a
 *   token when the account exists.
 * - `consumeToken` validates, expires, and single-use checks in one step.
 * - `resetPassword` consumes the token, hashes the new password, and stores
 *   the new credential through the account persistence boundary.
 */

import { normalizeEmail } from "../account/repository";
import type {
  ConsumeTokenResult,
  RecoveryDependencies,
  RecoveryError,
  RecoveryRepository,
  RequestRecoveryResult,
  RecoveryTokenRecord,
} from "./types";
import type { PasswordHashResult } from "../account/types";

const INVALID: RecoveryError = {
  code: "invalid-token",
  message: "This recovery link is not valid.",
};
const STORAGE_FAILURE: RecoveryError = {
  code: "storage-failure",
  message: "We could not process your request right now.",
};

export interface RecoveryService {
  requestRecovery(email: string): Promise<RequestRecoveryResult>;
  consumeToken(token: string): Promise<ConsumeTokenResult>;
  resetPassword(token: string, newPassword: string): Promise<
    | { ok: true }
    | { ok: false; error: RecoveryError }
  >;
}

export interface RecoveryServiceOptions {
  repository: RecoveryRepository;
  resolveAccountIdByEmail(email: string): Promise<string | null>;
  setPasswordHash(accountId: string, passwordHash: string): Promise<boolean>;
  hashPassword(password: string): Promise<PasswordHashResult>;
}

export function createRecoveryService(
  dependencies: RecoveryDependencies,
  options: RecoveryServiceOptions,
): RecoveryService {
  const { repository, createRecoveryToken, now, tokenTtlMs } = dependencies;

  return {
    async requestRecovery(email: string): Promise<RequestRecoveryResult> {
      const normalized = normalizeEmail(email);
      const accountId = await options.resolveAccountIdByEmail(normalized);
      if (!accountId) {
        // Privacy-preserving: report success without issuing a token.
        return { ok: true, token: null };
      }

      const timestamp = now();
      const token = createRecoveryToken();
      const record: RecoveryTokenRecord = {
        token,
        accountId,
        createdAt: timestamp,
        expiresAt: new Date(Date.parse(timestamp) + tokenTtlMs).toISOString(),
        usedAt: null,
      };

      try {
        const stored = await repository.create(normalized, record);
        if (!stored) return { ok: true, token: null };
        return { ok: true, token: stored };
      } catch {
        return { ok: false, error: STORAGE_FAILURE };
      }
    },

    async consumeToken(token: string): Promise<ConsumeTokenResult> {
      if (typeof token !== "string" || token.length === 0) return { ok: false, error: INVALID };
      try {
        return await repository.consume(token);
      } catch {
        return { ok: false, error: STORAGE_FAILURE };
      }
    },

    async resetPassword(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: RecoveryError }> {
      if (typeof newPassword !== "string" || newPassword.length < 12) {
        return { ok: false, error: { code: "invalid-token", message: "Use at least 12 characters for your new password." } };
      }

      const consumed = await this.consumeToken(token);
      if (!consumed.ok) return { ok: false, error: consumed.error };

      const hashed = await options.hashPassword(newPassword);
      if (!hashed.ok) return { ok: false, error: STORAGE_FAILURE };

      try {
        const stored = await options.setPasswordHash(consumed.accountId, hashed.passwordHash);
        if (!stored) return { ok: false, error: STORAGE_FAILURE };
      } catch {
        return { ok: false, error: STORAGE_FAILURE };
      }

      return { ok: true };
    },
  };
}

export type { RecoveryRepository, RecoveryError, RequestRecoveryResult, ConsumeTokenResult };