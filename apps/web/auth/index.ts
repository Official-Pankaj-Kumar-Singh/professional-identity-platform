export { verifyCredentials } from "./verify-credential";
export type {
  AccountCredentialRecord,
  AccountCredentialRepository,
  AccountRepositoryResult,
  AuthenticationDependencies,
  AuthenticationError,
  AuthenticationErrorCode,
  AuthenticatedIdentity,
  CredentialInput,
  CredentialVerificationResult,
  PasswordVerificationResult,
  PasswordVerifier,
  RepositoryIssue,
  RepositoryIssueCode,
} from "./types";
export { ScryptPasswordHasher, ScryptPasswordVerifier, createPasswordHasher } from "./password-hasher";
export type { PasswordHasherOptions } from "./password-hasher";
export { InMemoryAccountCredentialRepository, type StoredCredential } from "./credential-repository";