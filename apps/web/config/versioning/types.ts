import type { AuditMetadata, SchemaVersion } from "../platform";

/** Common revision metadata carried by auditable configuration instances. */
export interface VersionedConfiguration {
  schemaVersion: SchemaVersion;
  audit: AuditMetadata;
}

export type VersioningIssueCode =
  | "configuration.invalid"
  | "schema-version.unsupported"
  | "audit-version.invalid"
  | "audit-version.exhausted"
  | "audit-updated-at.invalid"
  | "configuration.not-cloneable";

/** A focused versioning error; full document validation remains TF-12's role. */
export interface VersioningIssue {
  code: VersioningIssueCode;
  path: string;
  message: string;
}

/** Result returned by versioning operations without throwing for bad metadata. */
export type VersioningResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: VersioningIssue };
