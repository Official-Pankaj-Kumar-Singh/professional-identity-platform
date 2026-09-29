/**
 * @file authorization/service.ts
 *
 * Resource-ownership authorization (Tasks #118–#120).
 *
 * Decides whether an actor may access an account-owned private resource.
 * The decision is explicit and server-side: the client UI is never the
 * security boundary.
 */

import type { AccountId } from "../account/types";
import type { AccountOwnedResource, AuthorizationDecision, AuthorizationService } from "./types";

export function createAuthorizationService(): AuthorizationService {
  return {
    require(actor: AccountId | null, resource: AccountOwnedResource): AuthorizationDecision {
      if (!actor) return { allowed: false, code: "unauthenticated" };
      if (actor !== resource.accountId) return { allowed: false, code: "forbidden" };
      return { allowed: true, actor };
    },
  };
}

export type { AccountOwnedResource, AuthorizationDecision };