# Account management (Feature #79)

Read, update, and delete boundary for a single account, addressed by
`GET`/`PATCH`/`DELETE` on `/api/accounts/[id]`.

This module owns: the account-management service (where authorization happens),
the process-wide composition, the update-patch allowlist and validation, the
deletion policy, and the safe `AccountView` representation returned to clients.

## Ownership enforcement

Every operation follows the same order, and the order *is* the security property:

```
cookie -> session -> actor -> load requested account -> authorization.require -> act
```

The **actor is the authenticated account from the session**. The `[id]` segment
selects which account is being asked about and never becomes the actor. That is
the whole of identifier-substitution protection: substituting another account's
identifier yields `403`, because the two account IDs are compared rather than
either being trusted.

The resource is loaded *before* authorization so the check compares two real
account IDs. A missing account is reported `not-found` before any ownership
question is asked, and the same code is used whether the account does not exist
or is not visible to the caller — so the endpoint is not an existence oracle for
account IDs.

`authorization/service.ts` is the ownership primitive and is unchanged. It stays
pure and stateless, and the repository stays storage-only: authorization is the
caller's job, never the repository's.

## Safe representation (Task #127)

`AccountView` is a distinct type from the stored `Account`, so a field added to
the stored record later cannot reach a response by accident — routes serialize
`AccountView` explicitly. It carries `id`, `email`, `createdAt`, `updatedAt` and
no credential material. The account record holds no password field at all, so
there is nothing to leak from it.

## Mutable fields (Task #130)

`MUTABLE_ACCOUNT_FIELDS` is an **allowlist** — currently `email` only. An
allowlist rather than a deny-list is deliberate: a deny-list silently widens, so
any field added to the account later would become writable without anyone
deciding it should.

Everything else is immutable to a client. `id` is the stable identity ownership is
decided on; `createdAt` and `updatedAt` are system-maintained; `id`, `accountId`,
`createdAt`, `updatedAt`, `password`, and `passwordHash` are refused outright
rather than silently ignored, so a caller is never told a write succeeded when
their value was discarded.

Changing a password is **not** part of this contract — credential recovery owns
it.

Identity uniqueness is not reimplemented here. The repository already normalizes
the email and enforces uniqueness atomically under the account write lock;
normalizing at the edge as well would duplicate that rule and risk the two
disagreeing.

## Deletion policy and safeguards (Task #133)

**What deletion does.** Removes the account record, its stored credential, and
every active session belonging to that account. Associated data is deleted with
the account rather than orphaned, because an orphaned session would leave a
credential that still authenticates against a resource that no longer exists.

**Safeguards.**

1. **Authentication.** Deletion requires an authenticated session. The actor
   comes from the session, never from the request.
2. **Ownership.** The account holder must authorize the deletion against the
   loaded resource. Ownership is settled *before* confirmation is considered, so
   an unauthorized caller learns nothing about the confirmation requirement.
3. **Explicit confirmation.** The request must carry `confirm: true`; the client
   additionally requires the user to type `DELETE`. Deleting without
   confirmation returns `confirmation-required` and removes nothing.
4. **Session revocation.** The account's sessions are revoked as part of the
   deletion, so the deleted account's session cannot remain usable.

**What deletion does not do.** It is irreversible, and there is no
recovery/undo path here — the deleted account cannot be restored by this module.
Recovering access to an account is credential recovery's concern, not deletion's.

## Process-local limitation

The account and session stores are in-memory and live only in this Node process.
State is lost on restart and is not shared between processes, serverless
invocations, or deployment instances. This mirrors the limitation already
documented on `account/application.ts` and `session/application.ts`; a durable
store is installed there, not here.