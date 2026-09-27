# Configuration Versioning (TF-14)

This module provides deterministic, in-memory revision operations for configuration objects that already carry `schemaVersion` and `AuditMetadata` (Profile, Theme, and Portfolio configurations).

## Version meanings

- `schemaVersion` identifies the structure of the configuration contract. The codebase currently supports schema version `1`.
- `audit.version` identifies a revision of one configuration instance. TF-14 reuses this existing positive safe integer; it does not add another revision field.
- `createdAt`, `updatedAt`, and `source` remain audit metadata. Creating a revision changes `audit.version` and the caller-supplied `audit.updatedAt`; it preserves `createdAt` and `source`.
- `PlatformConfiguration.metadata.version` is the existing semantic version of the platform configuration bundle. Platform Configuration has no `AuditMetadata`, so it is not treated as an individual auditable configuration revision by these operations.

An ordinary configuration edit increments the instance revision without changing `schemaVersion`. Schema compatibility is explicit: both values must be supported and equal. This module does not migrate configurations or claim compatibility for unknown future schemas.

## Operations

- `getConfigurationVersion` reads and minimally checks the supported schema version and positive safe integer audit version.
- `createNextConfigurationVersion` returns a new deep-cloned configuration with the next revision. It requires an explicit ISO 8601 UTC `updatedAt` value, produces no timestamp itself, and leaves the original unchanged. It reports invalid metadata and version overflow as structured results.
- `isSupportedSchemaVersion` and `areSchemaVersionsCompatible` expose the current schema compatibility rule.

These focused checks do not replace TF-12's full configuration validation. Callers should validate complete documents through TF-12.

## Relationships and boundaries

- **TF-11 Resolution:** `resolvedAt` records when resolution ran. Re-resolving the same source revisions does not increment their configuration versions; the resolver is unchanged.
- **TF-12 Validation:** remains responsible for complete configuration validation. Versioning checks only schema support and revision metadata needed by these operations.
- **TF-13 Defaults:** applying defaults does not create a revision or modify audit metadata. Revision creation remains an explicit caller decision after preparing configuration values.
- **TF-15 Persistence:** this module works only on in-memory configuration objects. It defines no storage, history, transaction, or database behavior.
- **TF-16 API:** the operations are domain-level functions, not HTTP endpoints or request/response contracts.

## Scope

TF-14 establishes reusable revision semantics and schema compatibility checks. It does not implement migrations, persistence, APIs, rendering, UI/editor/runtime behavior, AI behavior, a dedicated TF-17 test suite, or the broader TF-18 documentation task. No dependency is introduced.
