/**
 * @file account-management/application.ts
 *
 * Process-wide composition for account management (Tasks #127–#135).
 *
 * Resolves the shared account and session compositions rather than building
 * either one, so a route handler observes the same accounts that registration
 * wrote and the same sessions that sign-in issued. Constructing either store per
 * request would start from an empty account set, which would make every account
 * lookup miss and would defeat ownership checking entirely.
 *
 * LIMITATION — process-local, not durable persistence: the underlying account
 * and session stores are in-memory and live only in this Node process, so state
 * is lost on restart and is not shared between processes, serverless invocations,
 * or deployment instances. This mirrors the limitation already documented on
 * `account/application.ts` and `session/application.ts`; a durable store is
 * installed there, not here.
 */

import { getAccountComposition } from "../account/application";
import { getSessionComposition } from "../session/application";
import { AccountPersistenceManagementRepository } from "./repository";
import { createAccountManagementService, type AccountManagementService } from "./service";
import type { AccountManagementRepository } from "./types";

let defaultService: AccountManagementService | undefined;

function build(): AccountManagementService {
  const accounts = getAccountComposition();
  const sessions = getSessionComposition();
  const repository: AccountManagementRepository = new AccountPersistenceManagementRepository(accounts.persistence);
  return createAccountManagementService({
    repository,
    revokeSessions: async (accountId) => sessions.logoutAllForAccount(accountId),
  });
}

/** The account-management service shared by every request handled by this process. */
export function getAccountManagementService(): AccountManagementService {
  if (!defaultService) defaultService = build();
  return defaultService;
}

/** Install a service. Intended for tests. */
export function setAccountManagementService(service: AccountManagementService): void {
  defaultService = service;
}

/**
 * Forget the cached service so the next request rebuilds it against the current
 * account and session compositions. Tests that swap either composition must call
 * this, otherwise the service would keep using the store it was built with.
 */
export function resetAccountManagementService(): void {
  defaultService = undefined;
}