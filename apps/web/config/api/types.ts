import type { PortfolioConfiguration } from "../portfolio";
import type { ProfileConfiguration } from "../profile";
import type { SchemaVersion } from "../platform";
import type { ThemeConfiguration } from "../theme";
import type { ValidationIssue } from "../validation";
import type { VersionedConfiguration } from "../versioning";

/** Revision of this TypeScript API contract, independent of config versions. */
export type ConfigurationApiContractVersion = 1;

/** Selects an existing configuration ID; it adds no ID to stored documents. */
export type ConfigurationApiTarget =
  | { kind: "profile"; id: ProfileConfiguration["profileId"] }
  | { kind: "portfolio"; id: PortfolioConfiguration["portfolioId"] }
  | { kind: "theme"; id: ThemeConfiguration["themeId"] };

/** Transport-neutral request descriptions for create, read, and update. */
export type ConfigurationApiRequest<TConfiguration extends VersionedConfiguration = VersionedConfiguration> =
  | {
      contractVersion: ConfigurationApiContractVersion;
      operation: "create";
      target: ConfigurationApiTarget;
      configuration: TConfiguration;
    }
  | {
      contractVersion: ConfigurationApiContractVersion;
      operation: "get";
      target: ConfigurationApiTarget;
    }
  | {
      contractVersion: ConfigurationApiContractVersion;
      operation: "update";
      target: ConfigurationApiTarget;
      expectedVersion: number;
      updatedAt: string;
      /** Proposed configuration must still carry expectedVersion. */
      configuration: TConfiguration;
    };

export type ConfigurationApiError =
  | { code: "not-found"; message: string }
  | { code: "already-exists"; message: string }
  | { code: "validation-failed"; message: string; issues: ValidationIssue[] }
  | { code: "version-conflict"; message: string; expectedVersion: number; actualVersion: number }
  | { code: "unsupported-schema-version"; message: string; received: unknown; supported: SchemaVersion[] }
  | { code: "invalid-request"; message: string; path?: string }
  | { code: "internal"; message: string; requestId?: string };

/** Structured success/failure envelope for a future API implementation. */
export type ConfigurationApiResponse<T> =
  | {
      contractVersion: ConfigurationApiContractVersion;
      ok: true;
      data: T;
    }
  | {
      contractVersion: ConfigurationApiContractVersion;
      ok: false;
      error: ConfigurationApiError;
    };
