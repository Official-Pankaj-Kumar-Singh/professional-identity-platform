# Authentication credential contract (Task #103)

This module defines the credential verification boundary for sign-in. It contains no session creation, no cookie or token issuance, and no route or UI code.

## Contract

- `CredentialInput` accepts only an email and password string.
- `AccountCredentialRecord` stores the account identity and a hashed password, but no raw password.
- `PasswordVerifier.verify` compares the provided password against the stored hash and returns a distinct success/failure result.
- `verifyCredentials` normalizes the email and checks for a registered account before verifying the password.
- Public failures collapse to the same generic message: the email or password is incorrect.
- Successful verification returns only a minimal authenticated identity without exposing password material.

The repository boundary and password verifier remain injected and storage-agnostic. This keeps the sign-in contract independent from the production database, hashing library, or session implementation.
