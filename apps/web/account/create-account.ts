import type {
  Account,
  AccountCreationDependencies,
  AccountCreationError,
  AccountCreationResult,
  RegistrationInput,
} from "./types";
import { validateRegistration } from "./registration-validation";

const invalidInput = (): AccountCreationError => ({
  code: "invalid-input",
  message: "Provide an email address and password.",
});

const alreadyExists = (): AccountCreationError => ({
  code: "already-exists",
  message: "An account could not be created with these details.",
});

const credentialFailure = (): AccountCreationError => ({
  code: "credential-processing-failed",
  message: "The account could not be created.",
});

const storageFailure = (): AccountCreationError => ({
  code: "storage-failure",
  message: "The account could not be created.",
});

function isRegistrationInput(value: unknown): value is RegistrationInput {
  if (typeof value !== "object" || value === null) return false;
  return "email" in value && typeof value.email === "string" && "password" in value && typeof value.password === "string";
}

/**
 * Creates the application service for registration. Email format and password
 * policy validation remain the responsibility of the registration validator.
 */
export function createAccountService(dependencies: AccountCreationDependencies): {
  create(input: RegistrationInput): Promise<AccountCreationResult>;
} {
  return {
    async create(input: RegistrationInput): Promise<AccountCreationResult> {
      if (!isRegistrationInput(input)) return { ok: false, error: invalidInput() };

      if (!validateRegistration(input).ok) {
        return { ok: false, error: { code: "invalid-input", message: "Check the registration details and try again." } };
      }

      const email = input.email.trim().toLowerCase();

      try {
        const existing = await dependencies.repository.existsByEmail(email);
        if (!existing.ok) return { ok: false, error: storageFailure() };
        if (existing.value) return { ok: false, error: alreadyExists() };
      } catch {
        return { ok: false, error: storageFailure() };
      }

      let passwordHash: string;
      try {
        const hashed = await dependencies.passwordHasher.hash(input.password);
        if (!hashed.ok || typeof hashed.passwordHash !== "string" || hashed.passwordHash.length === 0 || hashed.passwordHash === input.password) {
          return { ok: false, error: credentialFailure() };
        }
        passwordHash = hashed.passwordHash;
      } catch {
        return { ok: false, error: credentialFailure() };
      }

      let account: Account;
      try {
        const timestamp = dependencies.now();
        account = {
          id: dependencies.createAccountId(),
          email,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      } catch {
        return { ok: false, error: storageFailure() };
      }

      try {
        const created = await dependencies.repository.create({
          account,
          credential: { accountId: account.id, passwordHash },
        });
        if (!created.ok) {
          return {
            ok: false,
            error: created.issue.code === "already-exists" ? alreadyExists() : storageFailure(),
          };
        }
        return {
          ok: true,
          account: {
            id: created.value.id,
            email: created.value.email,
            createdAt: created.value.createdAt,
            updatedAt: created.value.updatedAt,
          },
        };
      } catch {
        return { ok: false, error: storageFailure() };
      }
    },
  };
}
