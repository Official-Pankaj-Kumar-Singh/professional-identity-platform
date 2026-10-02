# Account recovery (Feature #78)

Recovery boundary for a registered account that cannot sign in. Task #121 defines
the request contract, #124 the reset contract, and #122/#125 the operations.

## The privacy rule

**A recovery request never reveals whether an account exists.**

`POST /api/recovery` returns one response for every accepted submission, whether
the address is registered or not. Issuing a token only when the account exists is
an implementation detail the caller cannot observe, because **the token is never
returned in the response** — it goes to the delivery boundary.

That second point is the load-bearing one. A response that echoed the token would
be worse than an existence disclosure: it would turn "submit an email address"
into "reset the password of anyone whose address you can guess". The endpoint
returns nothing beyond the neutral confirmation, and the form (`recover-rules.ts`)
enforces the same rule in the UI so it cannot be inferred from the wording either.

## Delivery boundary

There is no mail transport in this platform, so recovery defines a boundary rather
than inventing a provider. `RecoveryTokenDelivery` receives the token; the
default `InMemoryRecoveryOutbox` records deliveries in memory. A real deployment
swaps in a mailer without any caller changing.

**No email is sent by this feature.** Tests obtain the token from the outbox,
which stands in for "what the user would have received in their inbox".

## Token contract (Task #124)

| Property | Value |
|---|---|
| Format | opaque UUID from `crypto.randomUUID()` |
| Carries account identity | **No** — the public value is random, not an encoded account reference |
| Lifetime | 30 minutes (`RECOVERY_TOKEN_TTL_MS`) |
| Expiry check | at access time, inclusive — invalid at or after `expiresAt` |
| Single use | Yes — `consume` marks the record used exactly once |
| Storage | in-memory, keyed by token value; the account link stays server-side |

## Session policy after a reset (Task #124)

**A successful password reset revokes every session the account holds**,
including the one in use. `SESSIONS_ARE_REVOKED_AFTER_RESET` states it in code.

The reasoning: a reset is what a user does when they no longer control their
password, so the account must be treated as possibly compromised. Leaving an
existing session valid would let an attacker who captured one stay authenticated
indefinitely — the exact situation that prompted the reset.

## Ordering in the reset flow

The order is a correctness property, not a style choice:

```
validate token (no consume)
  -> validate the new password against the shared registration policy
  -> hash the new password
  -> consume the token
  -> store the new hash
  -> revoke the account's sessions
```

`validate` and `consume` are deliberately separate repository operations.
Hashing is the expensive, fallible step, so it runs **before** the single-use
token is spent. Consuming first would mean a weak password or a transient hashing
failure left the user holding a dead link and no way forward short of requesting a
second one.

The password is validated with `validateRegistration` — the same policy
registration enforces. Recovery previously restated the minimum inline, which
meant a change to the policy would silently leave reset on a different rule.

## Error semantics

`invalid-input` describes something the user can correct and carries field detail.
`invalid-token`, `expired-token`, and `used-token` describe the link;
`invalid-password` describes the password — separately, so the form can explain
the right field. The three link failures render one neutral message: telling a
holder of a stale token that it is "expired" rather than "invalid" confirms the
token was genuine, which is a free information gain to an attacker.

## Process-local limitation

The account store, the session store, and the recovery-token store are all
in-memory and live only in this Node process:

- Recovery tokens are lost on restart — a link issued before a restart stops
  working and the user must request another.
- Tokens are not shared between processes, serverless invocations, or deployment
  instances. A link issued by one instance may not resolve on another.
- **There is no durable production persistence.** This is a real implementation
  of the feature, not a production-ready recovery service.

`RecoveryRepository` is storage-agnostic so a durable store can be installed
behind it, exactly as `SessionRepository` is.

## Composition

`recovery/composition.ts` resolves the **shared** `getAccountComposition()` and
`getSessionComposition()`.

It previously called `createAccountPersistence()`, building a brand-new in-memory
account store. Recovery therefore resolved accounts against an empty store that
nothing else wrote to, so it could never find any account the application had
actually registered — the flow was unreachable in production while the
service-level tests passed, because those injected one shared persistence into
both sides by hand. `config-tests/recovery-api.test.ts` now drives the real
handlers against the same shared store, so that failure mode cannot recur
unnoticed.