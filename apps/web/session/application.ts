/**
 * @file session/application.ts
 *
 * Process-wide application composition for sessions (Task #105).
 *
 * A session is only meaningful if it outlives the request that created it. The
 * sign-in handler issues a session and hands its identifier to the browser in a
 * cookie, so the browser carries that identifier back on later requests. If
 * each caller built its own `createSessionComposition()`, every call would
 * create a brand-new in-memory repository and the session written during
 * sign-in would be unreachable the moment the response was sent — the cookie
 * would name a session that never existed for anyone else.
 *
 * This module exists for the same reason `account/application.ts` does under
 * Task #100: an invariant that holds only within one request is not an
 * invariant. Route handlers resolve the shared composition here so every
 * request handled by this process observes the same session set.
 *
 * LIMITATION — process-local, not durable session storage: the default
 * composition uses `InMemorySessionRepository`. Sessions live only in this Node
 * process, so they are lost on restart and are not shared between processes,
 * serverless invocations, or deployment instances. This is sign-in scaffolding
 * so that the credential check produces a real authenticated state, NOT
 * production session persistence. A real deployment must supply a shared
 * durable store behind the `SessionRepository` contract and install it with
 * `setSessionComposition` (or replace the factory below).
 *
 * Session lifetime, refresh, and expiration policy are NOT decided here. The
 * TTL below is the pre-existing default from `session/composition.ts` and is
 * left exactly as it was; stating it as policy, and any refresh or renewal
 * behavior, belongs to Task #112 and Task #113 and is deliberately untouched.
 */

import { createSessionComposition, type SessionComposition } from "./composition";

let defaultComposition: SessionComposition | undefined;

/** The session composition shared by every request handled by this process. */
export function getSessionComposition(): SessionComposition {
  if (!defaultComposition) defaultComposition = createSessionComposition();
  return defaultComposition;
}

/**
 * Install the composition that `getSessionComposition` should hand out.
 * Intended for tests and for a host that supplies a shared store instead of the
 * process-local default.
 */
export function setSessionComposition(composition: SessionComposition): void {
  defaultComposition = composition;
}

/** Forget the current composition so the next request rebuilds the default. */
export function resetSessionComposition(): void {
  defaultComposition = undefined;
}
