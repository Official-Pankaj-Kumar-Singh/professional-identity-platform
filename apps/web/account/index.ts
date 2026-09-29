export { createAccountService } from "./create-account";
export { validateRegistration } from "./registration-validation";
export type { RegistrationField, RegistrationValidationIssue, RegistrationValidationResult } from "./registration-validation";
export type {
  Account,
  AccountCreationDependencies,
  AccountCreationError,
  AccountCreationErrorCode,
  AccountCreationResult,
  AccountCredential,
  AccountId,
  AccountIdentity,
  AccountRepository,
  AccountRepositoryErrorCode,
  AccountRepositoryIssue,
  AccountRepositoryResult,
  NewAccountRecord,
  PasswordHasher,
  PasswordHashResult,
  RegistrationInput,
} from "./types";
export { normalizeEmail } from "./repository";
export type { InMemoryAccountRepository, InMemoryAccountRepositoryOptions } from "./repository";
export { AccountWriteLock } from "./lock";
export type { AccountPersistence } from "./persistence";
export { createAccountPersistence } from "./persistence";
export { createAccountComposition, type AccountComposition } from "./composition";
export { getAccountComposition, resetAccountComposition, setAccountComposition } from "./application";