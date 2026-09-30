/** Stable account identifier. The application composition layer supplies its generator. */
export type AccountId = string;

import type { RegistrationValidationIssue } from "./registration-validation";

/** Identity information safe to return to application callers. */
export interface AccountIdentity {
  email: string;
}

/** Public account representation. Credential material is deliberately excluded. */
export interface Account extends AccountIdentity {
  id: AccountId;
  createdAt: string;
  updatedAt: string;
}

/** Sensitive input accepted only by the account creation operation. */
export interface RegistrationInput {
  email: string;
  password: string;
}

/** One-way credential material supplied to the persistence boundary. */
export interface AccountCredential {
  accountId: AccountId;
  passwordHash: string;
}

/** The repository receives a public account and its separate credential record. */
export interface NewAccountRecord {
  account: Account;
  credential: AccountCredential;
}

export type AccountRepositoryErrorCode = "already-exists" | "storage-failure";

export interface AccountRepositoryIssue {
  code: AccountRepositoryErrorCode;
}

/** Explicit result contract shared by storage-agnostic account operations. */
export type AccountRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: AccountRepositoryIssue };

/** Storage boundary; create must enforce normalized-email uniqueness atomically. */
export interface AccountRepository {
  existsByEmail(email: string): Promise<AccountRepositoryResult<boolean>>;
  create(record: NewAccountRecord): Promise<AccountRepositoryResult<Account>>;
}

/** A credential implementation must return a salted, non-reversible hash. */
export type PasswordHashResult = { ok: true; passwordHash: string } | { ok: false };

export interface PasswordHasher {
  hash(password: string): Promise<PasswordHashResult>;
}

export type AccountCreationErrorCode =
  | "invalid-input"
  | "already-exists"
  | "credential-processing-failed"
  | "storage-failure";

export interface AccountCreationError {
  code: AccountCreationErrorCode;
  message: string;
  /**
   * Task #98: when `code` is `invalid-input`, the field-level issues that caused
   * the rejection, so a caller can attribute the error without parsing a
   * message. Messages come from the shared registration policy and never
   * contain a submitted value, so carrying them reveals only which field was
   * rejected, never what was typed.
   */
  issues?: RegistrationValidationIssue[];
}

export type AccountCreationResult =
  | { ok: true; account: Account }
  | { ok: false; error: AccountCreationError };

export interface AccountCreationDependencies {
  repository: AccountRepository;
  passwordHasher: PasswordHasher;
  createAccountId: () => AccountId;
  /** Return a consistent ISO 8601 UTC timestamp. */
  now: () => string;
}
