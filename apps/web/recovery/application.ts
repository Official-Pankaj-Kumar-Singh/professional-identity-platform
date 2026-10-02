/**
 * @file recovery/application.ts
 *
 * Process-wide composition for password recovery (Tasks #121–#126).
 *
 * A recovery token issued during one request has to still be resolvable during
 * the next, and the accounts it points at have to be the same accounts
 * registration wrote. Building a composition per request would put the token
 * store and the account store in fresh, empty containers every time, so the flow
 * could not work at all. This is the same reasoning as `account/application.ts`
 * (Task #100) and `session/application.ts` (Task #105).
 *
 * LIMITATION — process-local, not durable: recovery tokens are lost on restart
 * and are not shared between processes or deployment instances. A durable token
 * store would be installed behind the `RecoveryRepository` contract.
 */

import { createRecoveryComposition, type RecoveryComposition, type RecoveryCompositionOptions } from "./composition";

let defaultComposition: RecoveryComposition | undefined;

/** The recovery composition shared by every request handled by this process. */
export function getRecoveryComposition(): RecoveryComposition {
  if (!defaultComposition) defaultComposition = createRecoveryComposition();
  return defaultComposition;
}

/** Install a composition. Intended for tests and for a host supplying a durable token store. */
export function setRecoveryComposition(composition: RecoveryComposition): void {
  defaultComposition = composition;
}

/** Forget the current composition so the next request rebuilds the default. */
export function resetRecoveryComposition(): void {
  defaultComposition = undefined;
}

export type { RecoveryCompositionOptions };