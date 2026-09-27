# Configuration Persistence (TF-15)

This module defines a storage-agnostic repository contract for configuration documents. Repository inspection found no application database, ORM, data-access/repository layer, storage adapter, API routes, or serialization boundary. The only application package dependencies are Next.js, React, and their existing UI/build tooling. TF-15 therefore establishes the persistence boundary but does not introduce a storage provider.

## Contract

`ConfigurationRepository<TConfiguration>` describes the operations a future adapter must provide for one versioned document type:

- `create(identity, configuration)` stores an initial document and reports duplicates instead of overwriting.
- `get(identity)` loads the current document or reports `not-found`.
- `exists(identity)` checks for a document by its stable identity.
- `update(identity, update)` atomically compares the stored revision to `expectedVersion` and replaces the current document on a match. The proposed document's `audit.version` must equal the expected version. On success, the adapter must use TF-14 `createNextConfigurationVersion` with the explicit `updatedAt`, store the resulting `N + 1` revision, and return it. A stale expected version returns `version-conflict`; it must not overwrite a newer revision.

Operations return explicit `ConfigurationPersistenceResult` values. Adapter failures, missing documents, duplicate identities, identity mismatches, invalid revision inputs, and revision conflicts have distinct error codes. The contract describes the atomic behavior future adapters must guarantee; it does not provide an implementation or a transaction mechanism itself.

## Identity and documents

The repository key is the existing document identifier, not an added configuration field: use `profileId` for `ProfileConfiguration`, `portfolioId` for `PortfolioConfiguration`, and `themeId` for a persisted `ThemeConfiguration`. An adapter must reject a key that does not match the document's own identifier. A portfolio retains its existing `profileId` reference; TF-15 introduces no ownership or profile relationship model.

The generic contract applies to existing auditable configuration types. It is intended for configuration documents such as profiles, portfolios, and user-authored themes. Static Platform Configuration, Profession Manifests, the component registry, and derived `ResolvedPortfolioConfiguration` are not user configuration records covered by this repository contract. Persisting the current state does not imply storing revision history.

## Validation, serialization, and immutability

This contract accepts and returns typed configuration objects; it defines no storage format. A future adapter must encode and decode data explicitly and must reject malformed/non-serializable input rather than silently repair it. Once a complete set of layers is available, callers use TF-12 `validateConfiguration` for full cross-layer validation; this contract does not duplicate those rules or validate a portfolio in isolation as if that were sufficient. Reads and writes must not mutate caller-owned configuration objects or return mutable aliases to adapter-owned state.

- **TF-12 Validation:** owns complete document and cross-layer validation. Persistence adapters do not copy those checks.
- **TF-13 Defaults:** defaults remain an explicit preparation step; repository reads and writes never fill missing values.
- **TF-14 Versioning:** `AuditMetadata.version` is the only instance revision. Create preserves the supplied initial revision; update performs an optimistic compare-and-replace and uses TF-14 to create the next revision. `schemaVersion` is unchanged by ordinary updates. Only the current document is retained; no historical revision log is specified.
- **TF-16 API:** this is an application data/domain boundary, not an HTTP API, route, server action, or request/response contract.

## Scope and future work

TF-15 adds the repository contract and documents the integration requirements for a future data-layer implementation. That future work must select the application's storage provider, implement atomic compare-and-replace, choose an explicit serialization format, invoke validation at the appropriate application boundary, and apply authorization in the owning application layer. TF-15 introduces no database, ORM, schema, migrations, filesystem/cloud storage, credentials, authentication, API, rendering/editor/runtime behavior, AI logic, or dedicated TF-17 test suite. No dependency is added.
