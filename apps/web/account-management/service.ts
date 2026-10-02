/**
 * @file account-management/service.ts
 *
 * Account read/update/delete application layer (Tasks #127–#135).
 *
 * This is where authorization happens. The repository is deliberately
 * storage-only and performs no authorization, so every operation follows the
 * same shape:
 *
 *   actor -> load the requested resource -> authorize -> act
 *
 * The `actor` is the authenticated account and is supplied by the caller from
 * the session. It is never derived from the requested resource identifier: a
 * client may select *which* account to ask about, but selecting an account never
 * makes the requester its owner. That is the whole of identifier-substitution
 * protection, and it is why `require` is called with the loaded resource rather
 * than with a value taken from the request.
 *
 * Ordering matters. The resource is loaded before authorization so the check
 * compares two real account IDs, and a non-existent resource is reported as
 * `not-found` before any ownership question is asked.
 *
 * Deletion additionally revokes every session belonging to the account
 * (Task #134). A deleted account whose sessions remained valid would leave a
 * credential that still authenticates against a resource that no longer exists,
 * so revocation is part of deletion rather than an optional extra.
 */

import { createAuthorizationService } from "../authorization/service";
import type { AuthorizationService } from "../authorization/types";
import type { Account, AccountId } from "../account/types";
import {
  toAccountView,
  type AccountManagementErrorCode,
  type AccountManagementRepository,
  type AccountUpdatePatch,
  type AccountView,
} from "./types";

/** The resource type used for account-owned records in authorization checks. */
export const ACCOUNT_RESOURCE_TYPE = "account";

export interface AccountManagementFailure {
  readonly code: AccountManagementErrorCode;
  readonly message: string;
  /** Field-level detail, present only for `invalid-input`. */
  readonly fields?: Readonly<Record<string, string>>;
}

export type AccountManagementOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccountManagementFailure };

export type AccountReadOutcome = AccountManagementOutcome<AccountView>;
export type AccountUpdateOutcome = AccountManagementOutcome<AccountView>;
export type AccountDeleteOutcome = AccountManagementOutcome<{ readonly deleted: true }>;

export interface AccountManagementServiceDependencies {
  readonly repository: AccountManagementRepository;
  /** Revokes every session belonging to an account. Supplied so deletion can revoke them. */
  readonly revokeSessions?: (accountId: AccountId) => Promise<unknown>;
  readonly authorization?: AuthorizationService;
}

const MESSAGES = {
  unauthenticated: "Sign in to continue.",
  forbidden: "Access denied.",
  notFound: "Account not found.",
  confirmationRequired: "Confirm the deletion to continue.",
  storageFailure: "We could not complete that request right now.",
} as const;

function failure(code: AccountManagementErrorCode, message: string, fields?: Record<string, string>): { ok: false; error: AccountManagementFailure } {
  return { ok: false, error: fields ? { code, message, fields } : { code, message } };
}

export function createAccountManagementService(dependencies: AccountManagementServiceDependencies) {
  const { repository, revokeSessions } = dependencies;
  const authorization = dependencies.authorization ?? createAuthorizationService();

  /**
   * Loads a resource and checks ownership. Returns the resource on success, or
   * the failure the caller must report.
   *
   * The `not-found` result deliberately does not distinguish "no such account"
   * from "no such account you may see": the account does not exist as far as
   * this caller is concerned, which avoids turning the endpoint into an
   * existence oracle for account IDs.
   */
  async function loadAuthorized(actor: AccountId | null, requestedId: string): Promise<
    { ok: true; account: Account } | { ok: false; error: AccountManagementFailure }
  > {
    if (!actor) return failure("unauthenticated", MESSAGES.unauthenticated);

    const account = await repository.findById(requestedId);
    if (!account) return failure("not-found", MESSAGES.notFound);

    const decision = authorization.require(actor, {
      accountId: account.id,
      resourceType: ACCOUNT_RESOURCE_TYPE,
      resourceId: account.id,
    });

    if (!decision.allowed) {
      return decision.code === "forbidden"
        ? failure("forbidden", MESSAGES.forbidden)
        : failure("unauthenticated", MESSAGES.unauthenticated);
    }

    return { ok: true, account };
  }

  return {
    /** Task #128 — read the requested account, returning only permitted fields. */
    async read(actor: AccountId | null, requestedId: string): Promise<AccountReadOutcome> {
      const loaded = await loadAuthorized(actor, requestedId);
      if (!loaded.ok) return loaded;
      return { ok: true, value: toAccountView(loaded.account) };
    },

    /** Task #131 — update permitted fields on the requested account. */
    async update(actor: AccountId | null, requestedId: string, patch: AccountUpdatePatch): Promise<AccountUpdateOutcome> {
      const loaded = await loadAuthorized(actor, requestedId);
      if (!loaded.ok) return loaded;

      const result = await repository.update(loaded.account.id, patch);
      if (!result.ok) {
        return failure(result.error.code, result.error.message, (result.error as { fields?: Record<string, string> }).fields);
      }
      return { ok: true, value: toAccountView(result.account) };
    },

    /** Task #134 — delete the requested account and revoke its sessions. */
    async remove(actor: AccountId | null, requestedId: string, confirmed: boolean): Promise<AccountDeleteOutcome> {
      const loaded = await loadAuthorized(actor, requestedId);
      if (!loaded.ok) return loaded;

      // Authorization is settled before confirmation is considered, so an
      // unauthorized caller learns nothing about the confirmation requirement.
      if (!confirmed) return failure("confirmation-required", MESSAGES.confirmationRequired);

      const deleted = await repository.delete(loaded.account.id);
      if (!deleted.ok) return failure(deleted.error.code, deleted.error.message);

      // A deleted account must not keep authenticating. Revocation failure does
      // not fail the deletion — the account is already gone — but it is never
      // silently ignored either, because a live session for a deleted account is
      // exactly the inconsistency this ordering prevents.
      if (revokeSessions) {
        const revoked = await revokeSessions(loaded.account.id);
        if (revoked && typeof revoked === "object" && "ok" in revoked && revoked.ok === false) {
          return failure("storage-failure", MESSAGES.storageFailure);
        }
      }

      return { ok: true, value: { deleted: true } };
    },
  };
}

export type AccountManagementService = ReturnType<typeof createAccountManagementService>;