# Resource ownership authorization (Task #118)

The server-side ownership rule: which authenticated account may operate on which
account-owned resource, and why a client-supplied identifier can never answer
that question.

This module is deliberately tiny — `service.ts` and `types.ts`, no dependencies.
It is tiny on purpose; see *Why this module does nothing else* below.

## The rule

Ownership is decided by comparing two account IDs that were derived
independently of one another:

```
authenticatedActor.accountId  ===  resource.accountId   →  allowed
```

| Condition | Decision |
|---|---|
| `actor === null` | `{ allowed: false, code: "unauthenticated" }` |
| `actor !== resource.accountId` | `{ allowed: false, code: "forbidden" }` |
| `actor === resource.accountId` | `{ allowed: true, actor }` |

### Where each value comes from

| Value | Source | Never from |
|---|---|---|
| `actor` | the authenticated session, i.e. `session.accountId` | a URL segment, query parameter, or request body |
| `resource.accountId` | the server-loaded record, after `repository.findById(requestedId)` | the client |
| `requestedId` | the client, used **only** to select which record to load | — it is never an input to the decision |

`requestedId` selects a resource. It does not participate in the decision. That
separation is the whole of the security property, and it is why the comparison
reads `resource.accountId` rather than `resource.resourceId`.

### The client-identifier rule

For `GET /api/accounts/{id}`, `{id}` answers *which* account the server should
try to load. It does not answer *who is asking*. The actor comes from the
session:

```
actor     = session.accountId          ← authenticated identity
resource  = repository.findById(id)    ← selected by the client
decision  = authorization.require(actor, resource)
```

never:

```
actor = id                             ← WRONG: the client would be choosing its own identity
```

An anonymous caller therefore cannot reach another account's data by writing a
different `{id}` into the URL: substituting it changes which record is loaded,
not who is authenticated, so the comparison simply fails and the request is
refused.

## Why this module does nothing else

`authorization/service.ts` performs one comparison and returns. It deliberately
does **not**:

- query storage or know a repository exists,
- load a resource, or decide what a resource *is* beyond the `accountId` it was handed,
- parse a URL, query string, or request body,
- create, read, or invalidate a session,
- verify a credential.

Each of those belongs elsewhere, and keeping them out is what lets this rule be
reasoned about on its own:

```
HTTP / session boundary
        ↓
authenticated actor            ← session composition
        ↓
resource lookup                ← account-management service + repository
        ↓
authorization.require(actor, resource)
        ↓
authorized operation
```

The caller authorizes **after** loading and **before** acting. Loading first is
what allows two real account IDs to be compared; authorizing before loading
would have nothing to compare against.

## Callers

| Caller | Supplies actor from | Loads resource via |
|---|---|---|
| `account-management/service.ts` | its caller (the route) | `repository.findById` |
| `app/api/me/route.ts` | `session.accountId` | `getAccountById` |

## Evidence

**Focused rule tests** — `config-tests/authorization.test.ts`: owner allowed,
unauthenticated rejected, different account forbidden, and the identifier
independence cases that pin `accountId` as the thing being compared.

**HTTP-boundary tests** — `config-tests/account-management-api.test.ts`, added by
Task #119/#120, exercise the rule through the real routes against real sessions:
`refuses another user's account even when authenticated`,
`does not treat a client-supplied identifier as the actor`, `refuses to modify
another account`, `refuses to delete another account`,
`rejects an unauthenticated read/update/deletion`. Those are the end-to-end
proof and are referenced rather than duplicated here.

## Provenance

The rule itself predates this file and was reviewed as part of the Account
Management work (#119, #120), which is where its behaviour is exercised. This
document and the focused rule tests give Task #118 its own dedicated provenance.

**Process-local limitation is not an ownership concern.** Accounts are held in an
in-memory store, so this rule is only ever comparing identities within one
process. That limitation is documented on `account/application.ts` and does not
weaken the rule — an identity comparison is an identity comparison wherever the
records live.