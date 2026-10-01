# Protected-resource authentication contract (Task #109)

This module owns the session lifecycle: the storage-agnostic `Session` boundary, the in-memory session repository, the session service, the composition, and the process-wide session composition.

This document defines **which resources are protected, how an authenticated session is recognised, and what a protected resource returns when it is not**. It is a contract, not an implementation. It contains no enforcement code, no middleware, and no tests, and it deliberately does not decide session lifetime, refresh, or persistence — those belong to Task #112 and Task #113.

Task #110 implements this contract against the existing code. Task #111 proves it at the HTTP boundary. Task #106 terminates the session this contract observes.

## What makes a resource protected

A resource is protected when its response depends on a specific account, and that account is not identified by the request alone. A protected resource must therefore not be reachable by a request that carries no authenticated session.

The application currently has exactly **one** protected resource:

| Route | Method | Status | Reads a session | Returns account data |
|---|---|---|---|---|
| `app/api/me/route.ts` | `GET` | Protected | Yes | Yes |

Every other existing route is public and returns no account-scoped data:

| Route | Method | Purpose |
|---|---|---|
| `app/api/register/route.ts` | `POST` | Creates an account. Public by necessity. |
| `app/api/login/route.ts` | `POST` | Establishes a session. Public by necessity. |
| `app/logout/route.ts` | `POST` | Terminates a session (Task #106). |
| `app/page.tsx` | `GET` | Marketing landing page. |
| `app/login/page.tsx` | `GET` | Sign-in form. |
| `app/register/page.tsx` | `GET` | Registration form. |

There is **no** `middleware.ts` in the application. Nothing intercepts requests globally; each protected handler is responsible for enforcing this contract itself.

No account-management route exists yet, so no other resource is protected. Account read, update, and delete handlers belong to Tasks #128, #131, and #134, and this contract applies to them when they are built — it does not describe them as protected today.

## Session identification and transport

The session identifier travels in a single cookie. The name is **`sessionId`**, exported as `SESSION_COOKIE_NAME` from `app/api/login/route.ts` so that no reader re-declares it.

`POST /api/login` sets it on success only:

- `Path=/`
- `HttpOnly` — the identifier is not readable by page scripts
- `SameSite=Lax` — other sites cannot drive an authenticated request with the cookie attached
- `Max-Age` — derived from the created session's own `expiresAt`, so the browser and the server cannot disagree on when the session ends
- `Secure` — applied **only** when `NODE_ENV === "production"`, so plain-HTTP local development is not silently broken

No failure response sets the cookie. A rejected sign-in attempt leaves the browser exactly as unauthenticated as it was.

## Reading the session identifier

A protected resource obtains the identifier from the request's `Cookie` header. `readSessionId` in `app/api/me/route.ts` is the existing reader: it takes `request.headers.get("cookie")` and matches the cookie by name, then URL-decodes the value. It does not use `next/headers` or `cookies()`.

Observed parsing behaviour, verified against the current regular expression:

| Input | Result |
|---|---|
| Cookie header absent | No identifier → unauthenticated |
| `sessionId` absent | No identifier → unauthenticated |
| `sessionId=` (empty value) | No identifier → unauthenticated |
| `sessionId=<valid>` | Identifier returned, decoded |
| Two `sessionId` cookies | **The first wins.** Not defined behaviour; see ambiguities. |

## Evaluating the session

An identifier is not an identity. It must be resolved against the shared session store before it means anything.

`SessionComposition.evaluate(id)` delegates to the repository's `getValid`, which classifies the session:

| Condition | Status | Session object |
|---|---|---|
| Identifier not present in the store | `not-found` | `null` |
| `now >= expiresAt` | `expired` | Present |
| Otherwise | `active` | Present |

The service then maps `not-found` to **`revoked`**. So `evaluate` returns one of `active`, `expired`, or `revoked`; **`not-found` never reaches a caller**, which keeps a nonexistent session indistinguishable from a deliberately destroyed one.

A session is therefore **authenticated and active** only when `evaluate` returns `status === "active"` with a non-null session. Every other status is unauthenticated.

Expiry is evaluated at access time against the supplied clock rather than at a background sweep, so a session can expire between two requests without anything having to run.

The `Session` object carries `id`, `accountId`, `createdAt`, `expiresAt`, and `updatedAt`. It never carries a password or a password hash, and it stores only a stable account reference — never the credential that produced it.

## Required composition access

**A protected resource must resolve the process-wide session composition — `getSessionComposition()` from `session/application.ts` — and must not construct its own.**

This is not a stylistic preference. `createSessionComposition()` builds a brand-new `InMemorySessionRepository`, with a brand-new empty `Map`, on every call. A protected handler that called it would evaluate every identifier against an empty store, so every session would resolve as `revoked` and the resource could never return `200`. The invariant "a session issued at sign-in is the same session observed later" only holds when requests share one store, which is the same reason `account/application.ts` exists for account identity uniqueness under Task #100.

**Limitation — process-local, not durable session storage.** The default composition uses `InMemorySessionRepository`. Sessions live only in the Node process that created them: they are lost on restart and are not shared between processes, serverless invocations, or deployment instances. `getSessionComposition()` is sign-in scaffolding, not production session persistence. A deployment must install a shared store behind the `SessionRepository` contract via `setSessionComposition`.

The same applies to the account side. `app/api/me/route.ts` resolves the account with `createAccountPersistence()` rather than `getAccountComposition()`. Resolving the identity of *which* account a session belongs to is a separate lookup from establishing that the session is authenticated, and it must also read a shared store for the same reason.

## Unauthenticated response contract

A protected resource that cannot establish an active session rejects the request. The existing response, defined in `app/api/me/route.ts`, is:

- **Status `401`**
- Body `{ "ok": false, "error": { "code": "unauthenticated", "message": "Sign in to continue." } }`

Every unauthenticated case produces this same response, so a caller cannot learn whether the failure was a missing cookie, a malformed cookie, an unknown session, a destroyed session, or an expired one. The distinction between those causes is deliberately not disclosed to the requester.

The server distinguishes them internally for logging and for the work of Task #115, which owns the expired-session response contract. **`expired` and `revoked` currently produce an identical 401.** See ambiguities.

## Forbidden response contract

An authenticated session is not by itself permission to read any resource. When the session is valid but the identity does not own the requested resource, the response is:

- **Status `403`**
- Body `{ "ok": false, "error": { "code": "forbidden", "message": "Access denied." } }`

On success the protected resource returns `200` with account data scoped to the session's own account.

## Authentication, authorization, and ownership

These are three separate questions and are resolved in this order:

1. **Authentication** — is this request associated with a session that is currently active? Answered by the cookie lookup and `evaluate`. No session, or not active, ends the request with `401`.
2. **Identity resolution** — which account does this session belong to? Answered by `session.accountId` and the shared account store.
3. **Authorization and ownership** — may this identity act on this resource? Answered by `AuthorizationService.require(actor, resource)`.

`authorization/service.ts` is the existing ownership rule, defined by Tasks #118–#120. It is a pure, stateless comparison: a missing actor is `unauthenticated`, a mismatched owner is `forbidden`, and a match is allowed. **Authentication strictly precedes authorization** — an ownership check must never be asked about a request that has not already been authenticated, because an unauthenticated caller has no identity to own anything.

Task #110 consumes this contract and the existing authorization service. It must not redefine the ownership rule; that is #118's contract, and #119 owns enforcing it across private operations.

The chain a protected handler follows is:

```
request
  -> read sessionId cookie
  -> evaluate session against the shared store
  -> 401 unless active
  -> resolve accountId through the shared account store
  -> authorize the resolved identity against the resource
  -> 403 unless allowed
  -> perform the resource operation as the authenticated identity
```

Only `app/api/me/route.ts` is known to follow this chain. This contract does not assert that future handlers will, which is exactly why #111 exists to prove it at the HTTP boundary.

## Enforcement is server-side

**Client-side UI is never the security boundary.** Every check above runs on the server, on the request itself, using only the cookie the browser presented.

There is no client-side authentication guard to remove, no client-side route middleware, and no navigation check that could be bypassed by navigating directly to a URL, editing client state, or suppressing a client-side error. Deleting the sign-in form, forging a client-side session object, or calling the endpoint from anywhere on the internet still reaches the same server-side checks. `SameSite=Lax` limits cross-site riding of the cookie; it is a hardening measure, not the control that rejects unauthenticated requests.

This is what satisfies the "UI changes cannot bypass checks" criterion in Task #110 and in parent story #84.

## Identity context available to authorized logic

What a protected handler passes onward is currently narrower than it may need to be. `app/api/me/route.ts` passes a bare `AccountId` string — `evaluation.session.accountId` — into `AuthorizationService.require`, then reads the full `Account` from the account store.

Two richer identity shapes already exist and are **not** what reaches the authorization call today:

- `AuthenticatedIdentity` (`auth/types.ts`) — `{ accountId, email }`, the credential contract from Task #103
- `Account` (`account/types.ts`) — `{ id, email, createdAt, updatedAt }`, the public account representation

Both exclude credential material. Which one authorized logic should receive is an open question recorded below.

## Open ambiguities

These are recorded rather than resolved. **Task #110 must settle each one consistently with this contract**, and must not invent a value that contradicts what is written here.

1. **Malformed cookie values are not handled.** `readSessionId` calls `decodeURIComponent` on the matched value with no error handling. A cookie such as `sessionId=%ZZ` throws `URIError`, which escapes the handler as an unhandled error rather than being rejected as unauthenticated. Verified against the current regular expression. A protected resource must treat an undecodable cookie as unauthenticated and return `401`; it must not surface a server error to a caller who controls the cookie value.
2. **Which identity authorized logic receives.** Currently a bare `AccountId`. Whether protected-resource logic should receive `AuthenticatedIdentity` or the full `Account` is not defined. Task #110 must decide and apply it consistently.
3. **`expired` versus `revoked`.** Both currently produce the same `401`. Whether an expired session should be distinguishable to the client — for example to trigger a re-authentication prompt — is explicitly Task #115's decision, not #110's. #110 must not pre-empt it.
4. **Duplicate `sessionId` cookies.** The current reader takes the first match. Which one should win is not defined.
5. **Cookie attributes on read.** The server cannot verify that an incoming cookie was set with `HttpOnly` or `Secure`; those are honoured by the browser. Nothing in the contract depends on the server checking them, but no server-side validation exists.
6. **Session lifetime.** The `Max-Age` a browser holds is derived from the session's `expiresAt`, whose TTL currently defaults to 24 hours in `session/composition.ts`. Whether that is the correct lifetime is Task #112's policy decision. #110 must consume the session's own expiry and must not restate a lifetime of its own.
7. **Cross-site request forgery.** `SameSite=Lax` is the only mitigation in place, and there is no CSRF token. For a `GET` resource that returns data to the caller rather than mutating state this is not the primary control, but if a protected resource is ever added that mutates state, this contract does not yet cover it.

## Adjacent work this contract does not perform

- Task #106 implements session termination and cookie clearing. This contract only defines what "active" means, and therefore what a terminated session must stop being.
- Task #111 proves these boundaries at the HTTP boundary, including requests that bypass client navigation.
- Task #112 sets session lifetime and secure-handling policy.
- Task #113 implements session persistence and refresh. Nothing here refreshes a session; `evaluate` reports expiry and does not extend it.
- Task #115 owns the expired-session response contract, including whether expiry is distinguishable from revocation.
- Tasks #118–#120 own the ownership rule and its enforcement across private operations. This contract consumes the service; it does not define the rule.