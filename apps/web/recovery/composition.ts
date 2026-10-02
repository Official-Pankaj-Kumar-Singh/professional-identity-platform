/**
 * @file recovery/composition.ts
 *
 * Application composition for password recovery (Tasks #121–#126).
 *
 * Wires the recovery service to the in-memory token store, a UUID-based token
 * generator, and — critically — the **shared** account and session
 * compositions.
 *
 * This file previously called `createAccountPersistence()`, which builds a
 * brand-new in-memory account store. Recovery therefore resolved accounts
 * against an empty store that nothing else wrote to, so it could never find any
 * account the application had actually registered: the token path was
 * unreachable in production even though the service-level tests passed, because
 * those tests injected one shared persistence into both sides by hand. The
 * composition now resolves `getAccountComposition()` and
 * `getSessionComposition()` instead, for the same reason Task #100 did this for
 * account uniqueness and Task #105 for sessions — an invariant that holds only
 * within one store is not an invariant.
 *
 * LIMITATION — process-local, not durable: tokens and the account/session stores
 * are in-memory and live only in this Node process. Recovery tokens are lost on
 * restart and are not shared between instances. A real deployment must supply a
 * durable token store behind the `RecoveryRepository` contract. That is
 * Task-level durability work and is deliberately not invented here.
 */

import { InMemoryRecoveryRepository } from "./repository";
import { createRecoveryService, type RecoveryService } from "./service";
import { ScryptPasswordHasher } from "../auth/password-hasher";
import { getAccountComposition } from "../account/application";
import { normalizeEmail } from "../account/repository";
import { getSessionComposition } from "../session/application";
import type { RecoveryDependencies, RecoveryDeliveryMessage, RecoveryTokenDelivery } from "./types";

/** Default token lifetime. Stated here once; the policy is documented in the README. */
export const RECOVERY_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface RecoveryComposition {
  readonly service: RecoveryService;
  readonly delivery: RecoveryTokenDelivery;
  requestRecovery(email: string): Promise<{ ok: true; token: string | null } | { ok: false }>;
  resetPassword(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  clear(): void;
}

export interface RecoveryCompositionOptions {
  readonly tokenTtlMs?: number;
  readonly now?: () => string;
  /** Inspect-only token store, injectable so tests can drive expiration deterministically. */
  readonly repository?: InMemoryRecoveryRepository;
  readonly createRecoveryToken?: () => string;
  readonly delivery?: RecoveryTokenDelivery;
}

/**
 * Records deliveries in memory.
 *
 * A stand-in for a mail transport, not a mailer: the platform has no mail
 * infrastructure and inventing one would be speculative. It exists so the
 * delivery boundary is real and swappable, and so tests can observe what was
 * "sent" without the HTTP response ever carrying a token.
 */
export class InMemoryRecoveryOutbox implements RecoveryTokenDelivery {
  private readonly messages: RecoveryDeliveryMessage[] = [];

  async deliver(message: RecoveryDeliveryMessage): Promise<void> {
    this.messages.push(message);
  }

  /** Latest delivery, or null when nothing has been sent. */
  get last(): RecoveryDeliveryMessage | null {
    return this.messages.length === 0 ? null : this.messages[this.messages.length - 1];
  }

  get count(): number {
    return this.messages.length;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

export function createRecoveryComposition(options: RecoveryCompositionOptions = {}): RecoveryComposition {
  const accounts = getAccountComposition();
  const sessions = getSessionComposition();
  const repository = options.repository ?? new InMemoryRecoveryRepository();
  const delivery = options.delivery ?? new InMemoryRecoveryOutbox();
  const now = options.now ?? (() => new Date().toISOString());
  const hasher = new ScryptPasswordHasher();

  const dependencies: RecoveryDependencies = {
    repository,
    createRecoveryToken:
      options.createRecoveryToken ??
      (() => globalThis.crypto?.randomUUID?.() ?? `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
    now,
    tokenTtlMs: options.tokenTtlMs ?? RECOVERY_TOKEN_TTL_MS,
  };

  const service = createRecoveryService(dependencies, {
    repository,
    resolveAccountIdByEmail: async (email) => {
      const account = accounts.persistence.getAccountByEmail(email);
      return account ? account.id : null;
    },
    setPasswordHash: (accountId, passwordHash) => accounts.persistence.setPasswordHash(accountId, passwordHash),
    hashPassword: (password) => hasher.hash(password),
    revokeSessions: async (accountId) => sessions.logoutAllForAccount(accountId),
  });

  return {
    service,
    delivery,
    requestRecovery: async (email) => {
      const result = await service.requestRecovery(email);
      if (!result.ok) return { ok: false };
      if (result.token) {
        const normalized = normalizeEmail(email);
        const account = accounts.persistence.getAccountByEmail(normalized);
        await delivery.deliver({
          token: result.token,
          accountId: account?.id ?? "",
          email: normalized,
          expiresAt: new Date(Date.parse(now()) + dependencies.tokenTtlMs).toISOString(),
        });
      }
      return { ok: true, token: result.token };
    },
    resetPassword: async (token, newPassword) => {
      const result = await service.resetPassword(token, newPassword);
      if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
      return { ok: true };
    },
    clear: () => {
      repository.clear();
      delivery.clear?.();
    },
  };
}

export type { RecoveryDependencies };