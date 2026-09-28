# Account creation (Task #94)

This module defines the account identity, registration input, credential, repository, and account-creation service contracts. It contains no HTTP route, UI, session, login, database adapter, or authentication provider.

## Contracts and service

- `RegistrationInput` contains only email and password. Email is trimmed and lowercased for identity comparison; the raw password is passed only to `PasswordHasher`.
- `Account` is the public account representation. It contains the account ID, normalized email, and UTC creation/update timestamps; it never contains a password or password hash.
- `NewAccountRecord` separates the public account from its `AccountCredential`. The credential stores only `passwordHash` and is passed only to `AccountRepository`.
- `createAccountService` checks required values, asks the repository whether the normalized email exists, hashes the password, and asks the repository to create the record. Repository `create` must enforce uniqueness atomically to close the race between the existence check and creation.
- Results use explicit success/failure unions. Public errors are fixed messages and do not include credentials or storage details.

The caller supplies the repository, password-hashing implementation, account ID generator, and clock. The clock must return an ISO 8601 UTC timestamp. This reuses the application's existing injection-oriented, storage-agnostic contract style without choosing new ID or persistence infrastructure.

## Validation and neighboring stories

The service validates required fields, basic email format, and the minimum password length independently of the UI. It normalizes email identity, checks for an existing account, and handles the repository's atomic `already-exists` result; broader duplicate-account behavior belongs to US-03.

`validateRegistration` is the shared server-side validator: email must have a basic address shape and passwords must contain at least 12 characters. This minimum is a baseline for this flow, not a complete password policy review. The registration form mirrors the same rules, but the application service validates independently. The form accepts an injected submit operation for tests and integration. The current `/register` route intentionally fails closed because no persistent repository or reviewed password hasher has been configured; it does not report a successful account creation.

No professional profile fields are part of account registration. Account creation does not log in the user or create a session.

## Security and production integration

No password hashing library or implementation exists in this repository. The service requires an injected `PasswordHasher` that returns a salted, non-reversible hash, rejects empty hashes and a hash identical to the raw password, and never returns credential material. The repository receives only the hash, not the raw password. A production composition layer must select and review the hashing implementation and supply a persistent repository whose uniqueness constraint is atomic before registration can be enabled. No database, ORM, schema, migration, or dependency is introduced here.
