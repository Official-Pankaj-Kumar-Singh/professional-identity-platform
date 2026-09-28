import type {
  AccountRepositoryResult,
  AuthenticationDependencies,
  AuthenticationError,
  CredentialInput,
  CredentialVerificationResult,
  PasswordVerificationResult,
} from "./types";

const invalidCredentials = (): AuthenticationError => ({
  code: "invalid-credentials",
  message: "The email or password is incorrect.",
});

const storageFailure = (): AuthenticationError => ({
  code: "storage-failure",
  message: "We could not sign you in right now.",
});

const verificationFailure = (): AuthenticationError => ({
  code: "credential-verification-failed",
  message: "The email or password is incorrect.",
});

function isCredentialInput(value: unknown): value is CredentialInput {
  if (typeof value !== "object" || value === null) return false;
  return "email" in value && typeof value.email === "string" && "password" in value && typeof value.password === "string";
}

export function verifyCredentials(dependencies: AuthenticationDependencies): {
  verify(input: CredentialInput): Promise<CredentialVerificationResult>;
} {
  return {
    async verify(input: CredentialInput): Promise<CredentialVerificationResult> {
      if (!isCredentialInput(input)) return { ok: false, error: invalidCredentials() };

      const email = input.email.trim().toLowerCase();
      if (!email || !input.password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: invalidCredentials() };
      }

      let existing: AccountRepositoryResult<import("./types").AccountCredentialRecord | null>;
      try {
        existing = await dependencies.repository.findByEmail(email);
      } catch {
        return { ok: false, error: storageFailure() };
      }

      if (!existing.ok) {
        if (existing.issue.code === "not-found") return { ok: false, error: invalidCredentials() };
        return { ok: false, error: storageFailure() };
      }

      if (!existing.value) return { ok: false, error: invalidCredentials() };

      let verified: PasswordVerificationResult;
      try {
        verified = await dependencies.passwordVerifier.verify(input.password, existing.value.passwordHash);
      } catch {
        return { ok: false, error: verificationFailure() };
      }

      if (!verified.ok) return { ok: false, error: invalidCredentials() };

      return {
        ok: true,
        identity: {
          accountId: existing.value.accountId,
          email: existing.value.email,
        },
      };
    },
  };
}
