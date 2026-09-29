/**
 * @file authorization/types.ts
 *
 * Resource-ownership authorization boundary (Tasks #118–#120).
 *
 * Authorization is decided by comparing the authenticated account against
 * the owner of the resource being accessed. The decision is explicit and
 * server-side: the client UI is never the security boundary.
 */

import type { AccountId } from "../account/types";

/** Discriminated result of an authorization check. */
export type AuthorizationDecision =
  | { allowed: true; actor: AccountId }
  | { allowed: false; code: "unauthenticated" | "forbidden" };

/** A resource that belongs to exactly one account. */
export interface AccountOwnedResource {
  accountId: AccountId;
  resourceType: string;
  resourceId: string;
}

/** Authorization boundary for account-owned private resources. */
export interface AuthorizationService {
  require(actor: AccountId | null, resource: AccountOwnedResource): AuthorizationDecision;
}