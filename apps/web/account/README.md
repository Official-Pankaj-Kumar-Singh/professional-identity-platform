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

## Validation and neighboring stories

The service validates required fields, basic email format, and the minimum password length independently of the UI. It normalizes email identity, checks for an existing account, and handles the repository's atomic `already-exists` result; broader duplicate-account behavior belongs to US-03.

`validateRegistration` is the shared server-side validator: email must have a basic address shape and passwords must contain at least 12 characters. This minimum is a baseline for this flow, not a complete password policy review. The registration form mirrors the same rules, but the application service validates independently. The form accepts an injected submit operation for tests and integration. The `/register` route validates again server-side and persists through the production composition layer.

No professional profile fields are part of account registration. Account creation does not log in the user or create a session.

## Security and production integration

Password hashing uses scrypt with a random per-hash salt and constant-time verification. The repository receives only the hash, not the raw password. The public account result never contains credential material, and duplicate-registration responses never disclose the email. A shared write lock guarantees that concurrent registration attempts for the same identity cannot create two accounts until a real database unique constraint is introduced.