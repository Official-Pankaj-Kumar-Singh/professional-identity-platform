/**
 * @file auth/sign-in.ts
 *
 * Sign-in service (Tasks #104–#105).
 *
 * Wraps the existing `verifyCredentials` contract with the production
 * credential repository and password verifier. On success it returns the
 * authenticated identity; the caller (the login route) is responsible for
 * creating the session.
 *
 * Failures collapse to a single generic message so the response never
 * reveals whether the email or the password was wrong.
 */

import { verifyCredentials } from "./verify-credential";
import { InMemoryAccountCredentialRepository } from "./credential-repository";
import { ScryptPasswordVerifier } from "./password-hasher";
import type {
  AuthenticationDependencies,
  AuthenticationError,
  CredentialInput,
  CredentialVerificationResult,
} from "./types";

export interface SignInDependencies {
  repository: InMemoryAccountCredentialRepository;
}

export function createSignInService(dependencies: SignInDependencies): {
  verify(input: CredentialInput): Promise<CredentialVerificationResult>;
} {
  const service = verifyCredentials({
    repository: dependencies.repository,
    passwordVerifier: new ScryptPasswordVerifier(),
  });
  return { verify: (input) => service.verify(input) };
}

export type { AuthenticationError, CredentialInput, CredentialVerificationResult };