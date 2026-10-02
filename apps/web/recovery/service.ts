/**
 * @file recovery/service.ts
 *
 * Password-recovery service (Tasks #121–#126).
 *
 * - `requestRecovery` is privacy-preserving: it reports the same generic success
 *   whether or not the account exists, and only issues a token when it does.
 * - `validateToken` classifies a token without consuming it.
 * - `resetPassword` checks the credential, checks the new password, hashes it,
 *   and only then consumes the token and stores the new hash.
 * - `setPasswordHash` is followed by the session policy: a successful reset
 *   revokes every session the account holds.
 */

import { normalizeEmail } from "../account/repository";
import { validateRegistration } from "../account/registration-validation";
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

/**
 * Session policy after a password change (Task #124).
 *
 * A reset is the user's response to a password they no longer control, so the
 * account is assumed possibly compromised: every session it holds is revoked,
 * including the one in use. The user signs back in with the new password. Not
 * revoking would leave an intruder who captured a session authenticated
 * indefinitely, which is the case that prompted the reset in the first place.
 */
export const SESSIONS_ARE_REVOKED_AFTER_RESET = true;

export interface RecoveryService {
  requestRecovery(email: string): Promise<RequestRecoveryResult>;
  validateToken(token: string): Promise<ConsumeTokenResult>;
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
  /** Applies the session policy. Omitted in tests that do not exercise it. */
  revokeSessions?: (accountId: string) => Promise<unknown>;
}

export function createRecoveryService(
  dependencies: RecoveryDependencies,
  options: RecoveryServiceOptions,
): RecoveryService {
  const { repository, createRecoveryToken, now, tokenTtlMs } = dependencies;

  async function inspect(token: unknown): Promise<ConsumeTokenResult> {
    if (typeof token !== "string" || token.length === 0) return { ok: false, error: INVALID };
    try {
      return await repository.validate(token);
    } catch {
      return { ok: false, error: STORAGE_FAILURE };
    }
  }

  return {
    async requestRecovery(email: string): Promise<RequestRecoveryResult> {
      if (typeof email !== "string" || email.trim().length === 0) {
        return { ok: false, error: { code: "invalid-input", message: "Enter your email address.", fields: { email: "Enter your email address." } } };
      }

      const normalized = normalizeEmail(email);
      const accountId = await options.resolveAccountIdByEmail(normalized);
      if (!accountId) {
        // Privacy-preserving: report success without issuing a token. The caller
        // must respond identically in both cases, which is what stops this from
        // confirming which addresses are registered.
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

    async validateToken(token: string): Promise<ConsumeTokenResult> {
      return inspect(token);
    },

    async consumeToken(token: string): Promise<ConsumeTokenResult> {
      const checked = await inspect(token);
      if (!checked.ok) return checked;
      try {
        return await repository.consume(token);
      } catch {
        return { ok: false, error: STORAGE_FAILURE };
      }
    },

    async resetPassword(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: RecoveryError }> {
      // The credential is checked first so an unusable link reports "this link is
      // not valid" rather than complaining about the new password.
      const checked = await inspect(token);
      if (!checked.ok) return { ok: false, error: checked.error };

      // The password is then validated against the SAME policy registration
      // enforces. Recovery previously restated the minimum inline, which meant a
      // change to the policy would silently leave reset on a different rule.
      const passwordCheck = validateRegistration({ email: "placeholder@example.com", password: newPassword });
      const passwordIssue = passwordCheck.issues.find((issue) => issue.field === "password");
      if (passwordIssue) {
        return {
          ok: false,
          error: {
            code: "invalid-password",
            message: "Choose a password that meets the requirements.",
            fields: { password: passwordIssue.message },
          },
        };
      }

      // Hashing is the expensive, fallible step, so it runs BEFORE the token is
      // consumed. Consuming first would mean a transient hashing failure left the
      // user holding a dead recovery link with no way to retry.
      const hashed = await options.hashPassword(newPassword);
      if (!hashed.ok) return { ok: false, error: STORAGE_FAILURE };

      // Only now is the single-use credential spent.
      const consumed = await this.consumeToken(token);
      if (!consumed.ok) return { ok: false, error: consumed.error };

      try {
        const stored = await options.setPasswordHash(consumed.accountId, hashed.passwordHash);
        if (!stored) return { ok: false, error: STORAGE_FAILURE };
      } catch {
        return { ok: false, error: STORAGE_FAILURE };
      }

      if (SESSIONS_ARE_REVOKED_AFTER_RESET && options.revokeSessions) {
        await options.revokeSessions(consumed.accountId);
      }

      return { ok: true };
    },
  };
}

export type { RecoveryRepository, RecoveryError, RequestRecoveryResult, ConsumeTokenResult };