export interface CredentialInput {
  email: string;
  password: string;
}

export interface AccountCredentialRecord {
  accountId: string;
  email: string;
  passwordHash: string;
}

export type RepositoryIssueCode = "not-found" | "storage-failure";

export interface RepositoryIssue {
  code: RepositoryIssueCode;
  message?: string;
}

export type AccountRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: RepositoryIssue };

export interface AccountCredentialRepository {
  findByEmail(email: string): Promise<AccountRepositoryResult<AccountCredentialRecord | null>>;
}

export type PasswordVerificationResult = { ok: true } | { ok: false };

export interface PasswordVerifier {
  verify(password: string, passwordHash: string): Promise<PasswordVerificationResult>;
}

export interface AuthenticatedIdentity {
  accountId: string;
  email: string;
}

export type AuthenticationErrorCode = "invalid-credentials" | "credential-verification-failed" | "storage-failure";

export interface AuthenticationError {
  code: AuthenticationErrorCode;
  message: string;
}

export type CredentialVerificationResult =
  | { ok: true; identity: AuthenticatedIdentity }
  | { ok: false; error: AuthenticationError };

export interface AuthenticationDependencies {
  repository: AccountCredentialRepository;
  passwordVerifier: PasswordVerifier;
}
