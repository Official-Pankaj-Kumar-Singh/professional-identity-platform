# Account creation (Task #94)

This module defines the account identity, registration input, credential, repository, and account-creation service contracts. It contains no HTTP route, UI, session, login, database adapter, or authentication provider.

## Contracts and service

- `RegistrationInput` contains only email and password. Email is trimmed and lowercased for identity comparison; the raw password is passed only to `PasswordHasher`.
- `Account` is the public account representation. It contains the account ID, normalized email, and UTC creation/update timestamps; it never contains a password or password hash.
- `NewAccountRecord` separates the public account from its `AccountCredential`. The credential stores only `passwordHash` and is passed only to `AccountRepository`.
- `createAccountService` checks required values, asks the repository whether the normalized email exists, hashes the password, and asks the repository to create the record. Repository `create` must enforce uniqueness atomically to close the race between the existence check and creation.
- Results use explicit success/failure unions. Public errors are fixed messages and do not include credentials or storage details.

The caller supplies the repository, password-hashing implementation, account ID generator, and clock. The clock must return an ISO 8601 UTC timestamp. This reuses the application's existing injection-oriented, storage-agnostic contract style without choosing new ID or persistence infrastructure.

## Production infrastructure

Concrete implementations live alongside the contracts:

- `account/repository.ts` — `InMemoryAccountRepository` with a shared `AccountWriteLock` so concurrent registration attempts for the same normalized email cannot both succeed.
- `account/persistence.ts` — `createAccountPersistence` coordinates the account and credential stores behind one lock so an account and its credential are stored atomically.
- `account/composition.ts` — `createAccountComposition` wires the service to the production repository, an `ScryptPasswordHasher`, a UUID-based account ID generator, and the system clock.
- `auth/password-hasher.ts` — `ScryptPasswordHasher` / `ScryptPasswordVerifier` backed by `node:crypto.scrypt`. Hashes are self-describing (`$scrypt$<logN>$<r>$<p>$<salt>$<hash>`) so verification can reuse the original work factor.
- `auth/credential-repository.ts` — `InMemoryAccountCredentialRepository` for the sign-in lookup boundary.

No password hashing library or third-party dependency is introduced; `node:crypto` ships with Node and provides a vetted, parameterized scrypt implementation. A production deployment should later swap the in-memory stores for a real database with a unique constraint on normalized email.

## Canonical identity comparison (Task #100)

Account identity is the normalized email address. `normalizeEmail` in
`account/repository.ts` defines the comparison and is the only normalization used
for identity:

1. Trim leading and trailing whitespace (including tabs and newlines).
2. Lowercase the whole address.

No other transformation is applied: the local part is case-sensitive for some real
providers, and plus-addressing (`a+b@example.com`) and dot variants are treated as
distinct identities. Two registration inputs denote the same account exactly when
their normalized values are equal, so `Person@Example.com `, `PERSON@example.com`,
and `\tperson@example.com\n` are one identity.

Uniqueness invariant: at most one account may exist per normalized identity. Both
sides of the boundary use the same normalization — the service normalizes before
`existsByEmail`, and `InMemoryAccountRepository.create` re-normalizes and re-checks
under the shared `AccountWriteLock` before inserting, so the check and the write are
one atomic step and concurrent registrations cannot both win.

## Where the invariant lives across requests

`account/application.ts` exposes the process-wide composition that route handlers
use. Uniqueness is an invariant over the whole account set, so requests must share
one repository; a handler that built its own composition per request would start
from an empty account set every time and accept a repeated identity.
`config-tests/account-identity-uniqueness.test.ts` drives the real `/register`
handler twice to pin this down.

**Limitation:** that shared composition is process-local. Accounts live in Node
memory, disappear on restart, and are not shared between processes, serverless
invocations, or deployment instances. It is registration scaffolding, not durable
production persistence.

## Validation and neighboring stories

The service validates required fields, basic email format, and the minimum password length independently of the UI. It normalizes email identity, checks for an existing account, and handles the repository's atomic `already-exists` result; broader duplicate-account behavior belongs to US-03.

`validateRegistration` is the shared server-side validator: email must have a basic address shape and passwords must contain at least 12 characters. This minimum is a baseline for this flow, not a complete password policy review. The registration form mirrors the same rules, but the application service validates independently. The form accepts an injected submit operation for tests and integration. The `/api/register` route validates again server-side and persists through the production composition layer.

No professional profile fields are part of account registration. Account creation does not log in the user or create a session.

## Duplicate registration handling (Task #101)

Task #100 makes identity unique; this task makes rejecting an already-registered identity safe to do so. A duplicate registration creates no second account, and the response discloses no account details — but withholding the identity from the message is only half of non-disclosure. The service therefore computes the password hash **before** it tests for an existing account, so a rejected duplicate performs the same expensive work as a first-time registration. Returning early on the duplicate path made "this identity is registered" observable as a much faster response, which would have handed back exactly the fact the error message is written to withhold.

Ordering in `create-account.ts` is therefore: validate, hash, test for an existing account, build, persist. The early `existsByEmail` rejection survives as a cheap short-circuit, and the repository's atomic check from Task #100 remains the authority on uniqueness — this ordering does not weaken that invariant, it only removes a side channel. Malformed input still short-circuits before hashing, because an invalid request carries no information about whether an account exists.

Duplicate attempts are deliberately made to cost the server a hash. That trades a small amount of CPU for removing an identity-enumeration oracle, which is the right direction for an endpoint that accepts unauthenticated input.

Race conditions and concurrent duplicate attempts are verified separately under Task #102.

## Security and production integration

Password hashing uses scrypt with a random per-hash salt and constant-time verification. The repository receives only the hash, not the raw password. The public account result never contains credential material, and duplicate-registration responses never disclose the email. A shared write lock guarantees that concurrent registration attempts for the same identity cannot create two accounts until a real database unique constraint is introduced.