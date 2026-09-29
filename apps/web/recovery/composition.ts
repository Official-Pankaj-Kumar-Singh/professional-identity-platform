/**
 * @file recovery/composition.ts
 *
 * Application composition for password recovery (Tasks #121–#126).
 *
 * Wires the recovery service to the in-memory token store, the account
 * persistence boundary (for resolving account IDs and storing new
 * password hashes), and a UUID-based token generator.
 */

import { InMemoryRecoveryRepository } from "./repository";
import { createRecoveryService } from "./service";
import { createAccountPersistence } from "../account/persistence";
import { ScryptPasswordHasher } from "../auth/password-hasher";
import type { RecoveryService } from "./service";
import type { RecoveryDependencies } from "./types";

export interface RecoveryComposition {
  readonly service: RecoveryService;
  requestRecovery(email: string): Promise<{ ok: true; token: string | null } | { ok: false }>;
  resetPassword(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  clear(): void;
}

export function createRecoveryComposition(options: { tokenTtlMs?: number } = {}): RecoveryComposition {
  const persistence = createAccountPersistence();
  const repository = new InMemoryRecoveryRepository();
  const dependencies: RecoveryDependencies = {
    repository,
    createRecoveryToken: () => globalThis.crypto?.randomUUID?.() ?? `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    now: () => new Date().toISOString(),
    tokenTtlMs: options.tokenTtlMs ?? 30 * 60 * 1000,
  };
  const service = createRecoveryService(dependencies, {
    repository,
    resolveAccountIdByEmail: async (email) => {
      const account = persistence.getAccountByEmail(email);
      return account ? account.id : null;
    },
    setPasswordHash: (accountId, passwordHash) => persistence.setPasswordHash(accountId, passwordHash),
    hashPassword: (password) => new ScryptPasswordHasher().hash(password),
  });

  return {
    service,
    requestRecovery: async (email) => {
      const result = await service.requestRecovery(email);
      if (!result.ok) return { ok: false };
      return { ok: true, token: result.token };
    },
    resetPassword: async (token, newPassword) => {
      const result = await service.resetPassword(token, newPassword);
      if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
      return { ok: true };
    },
    clear: () => {
      persistence.clear();
      repository.clear();
    },
  };
}

export type { RecoveryDependencies };