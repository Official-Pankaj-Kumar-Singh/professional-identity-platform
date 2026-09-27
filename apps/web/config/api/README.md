# Configuration API Contract (TF-16)

This module defines transport-neutral TypeScript request and response shapes for a future application API. It contains no routes, handlers, clients, HTTP types, or orchestration code.

## Operations and requests

`ConfigurationApiRequest<TConfiguration>` is a discriminated union for the supported lifecycle operations:

- `create`: a `ConfigurationApiTarget` and initial versioned configuration document.
- `get`: the existing document target, selected by `kind` (`profile`, `portfolio`, or `theme`) and its existing ID.
- `update`: target, a proposed document at the caller's `expectedVersion`, and an explicit UTC `updatedAt` timestamp.

`ConfigurationApiResponse<T>` returns either `{ ok: true, data }` or `{ ok: false, error }`. The error union distinguishes not found, duplicate identity, validation failure (preserving TF-12 `ValidationIssue[]`), version conflict (expected and actual revisions), unsupported schema version, invalid request, and sanitized internal failure.

The contract covers create/read/update because they form the persisted configuration lifecycle already specified by TF-15. It does not automatically turn each domain helper into a public API operation. Validation and defaults are orchestration steps for create/update; resolution remains a downstream domain operation. A future product API may choose to expose validation previews or resolution separately after defining their use cases.

## Version distinctions

`ConfigurationApiContractVersion` is the literal `1` identifier for this TypeScript contract shape. It is separate from:

- configuration `schemaVersion`, which identifies the configuration structure;
- `AuditMetadata.version`, which identifies a particular configuration revision;
- `PlatformConfiguration.metadata.version`, which versions the platform configuration bundle.

Create stores an explicitly supplied initial revision. Update requires the expected current revision, and the future implementation must map a TF-15 version conflict into the API `version-conflict` error and use TF-14 to produce the next revision. The API contract does not add another revision field or define an HTTP URL/header versioning scheme.

## Domain boundaries

- **TF-12 Validation:** full configuration validation remains there. Validation errors cross this contract as the existing structured issues; the API layer does not duplicate validation rules.
- **TF-13 Defaults:** a future create/update flow may apply defaults where appropriate before validation. Defaults are not silently applied by request decoding or reads.
- **TF-14 Versioning:** owns revision creation and schema compatibility checks.
- **TF-15 Persistence:** owns document storage, stable identity, and atomic expected-version updates. The API maps repository results to its structured errors and does not introduce a storage provider.
- **TF-11 Resolution:** remains a domain operation and is not implicitly run by CRUD requests.

This module defines no HTTP endpoints, API implementation, authentication/authorization, database access, server actions, middleware, client calls, UI, rendering, or dependencies. It is not the broad TF-18 configuration guide.
