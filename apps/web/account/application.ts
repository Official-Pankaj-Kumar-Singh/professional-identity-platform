/**
 * @file account/application.ts
 *
 * Process-wide application composition for account registration (Task #100).
 *
 * Route handlers resolve the registration service through this module so every
 * request observes the same account store. Account identity uniqueness is an
 * invariant over the account set, so it can only hold — or be tested — when
 * requests share one repository. A handler that built its own composition per
 * request would start from an empty account set every time and accept a repeated
 * identity.
 *
 * The composition is still created behind the storage-agnostic `AccountRepository`
 * contract, so replacing the store does not change any caller.
 *
 * LIMITATION — process-local, not durable persistence: the default composition
 * uses `InMemoryAccountRepository`. Accounts live only in this Node process, so
 * they are lost on restart and are not shared between processes, serverless
 * invocations, or deployment instances. This is registration scaffolding, not
 * production persistence; a real deployment must supply a durable store that
 * enforces a unique constraint on normalized email, and install it with
 * `setAccountComposition` (or replace the factory below).
 */

import { createAccountComposition, type AccountComposition } from "./composition";

let defaultComposition: AccountComposition | undefined;

/** The account composition shared by every request handled by this process. */
export function getAccountComposition(): AccountComposition {
  if (!defaultComposition) defaultComposition = createAccountComposition();
  return defaultComposition;
}

/**
 * Install the composition that `getAccountComposition` should hand out. Intended
 * for tests and for a host that supplies a durable repository instead of the
 * process-local default.
 */
export function setAccountComposition(composition: AccountComposition): void {
  defaultComposition = composition;
}

/** Forget the current composition so the next request rebuilds the default. */
export function resetAccountComposition(): void {
  defaultComposition = undefined;
}
