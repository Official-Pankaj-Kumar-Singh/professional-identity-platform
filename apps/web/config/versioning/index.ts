import type { SchemaVersion } from "../platform";
import type { VersionedConfiguration, VersioningIssue, VersioningResult } from "./types";

export type { VersionedConfiguration, VersioningIssue, VersioningIssueCode, VersioningResult } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure<T>(code: VersioningIssue["code"], path: string, message: string): VersioningResult<T> {
  return { ok: false, issue: { code, path, message } };
}

function inspectVersionMetadata(configuration: unknown): VersioningResult<number> {
  if (!isRecord(configuration)) {
    return failure("configuration.invalid", "$", "Expected a configuration object.");
  }
  if (!isSupportedSchemaVersion(configuration.schemaVersion)) {
    return failure("schema-version.unsupported", "schemaVersion", "The configuration schema version is not supported.");
  }
  if (!isRecord(configuration.audit) || typeof configuration.audit.version !== "number" || !Number.isSafeInteger(configuration.audit.version) || configuration.audit.version < 1) {
    return failure("audit-version.invalid", "audit.version", "Expected a positive safe integer configuration version.");
  }
  return { ok: true, value: configuration.audit.version };
}

/** True only for schema versions this codebase currently understands. */
export function isSupportedSchemaVersion(value: unknown): value is SchemaVersion {
  return value === 1;
}

/** Two documents are compatible when both use the same supported schema. */
export function areSchemaVersionsCompatible(left: unknown, right: unknown): boolean {
  return isSupportedSchemaVersion(left) && isSupportedSchemaVersion(right) && left === right;
}

/** Read the instance revision stored in AuditMetadata.version. */
export function getConfigurationVersion(configuration: unknown): VersioningResult<number> {
  return inspectVersionMetadata(configuration);
}

/**
 * Create an independent next revision of an auditable configuration.
 * The supplied UTC timestamp makes the operation deterministic; it is never
 * generated internally. The schema version and all other data are preserved.
 */
export function createNextConfigurationVersion<T extends VersionedConfiguration>(
  configuration: T,
  updatedAt: string,
): VersioningResult<T> {
  const current = inspectVersionMetadata(configuration);
  if (!current.ok) return current;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(updatedAt) || Number.isNaN(Date.parse(updatedAt))) {
    return failure("audit-updated-at.invalid", "audit.updatedAt", "Expected an ISO 8601 UTC timestamp supplied by the caller.");
  }

  const currentVersion = current.value;
  if (currentVersion === Number.MAX_SAFE_INTEGER) {
    return failure("audit-version.exhausted", "audit.version", "The configuration version cannot be incremented safely.");
  }

  try {
    const next = structuredClone(configuration);
    next.audit = { ...next.audit, version: currentVersion + 1, updatedAt };
    return { ok: true, value: next };
  } catch {
    return failure("configuration.not-cloneable", "$", "Configuration data must be structured-cloneable declarative data.");
  }
}
