# Configuration Validation (TF-12)

This module provides a reusable validation gate for the declarative configuration contracts defined by TF-02 and implemented in TF-03 through TF-11. It checks selected platform, profession, profile, theme, portfolio, section, and component data before downstream use.

`validateConfiguration` accepts the selected configuration layers and the approved static `ComponentRegistry`. It returns `{ valid, issues }`; every issue includes a severity, stable rule code, JSON-style path, and explanation. Ordinary invalid input is reported as errors. Validation is read-only: it never mutates, repairs, or fills in configuration values.

The checks cover schema version 1, identifier and audit formats, platform and profession catalog coherence, profile/profession and portfolio/profile/theme relationships, profession defaults, section order and singleton constraints, component and responsive layout shapes, component references against the supplied registry, URL protocols, CSS-safe theme colors/tokens, prototype-related keys, navigation and section limits, and the serialized size of the selected source configuration (profession, profile, theme, and portfolio).

Section configuration belongs to Layer 5 within `PortfolioConfiguration`. A selected portfolio is validated against its profile, profession, platform, and theme. Each section's `componentConfig` uses the existing TF-09 `ComponentConfiguration` contract and is checked against the supplied TF-10 registry catalog; this module does not define or construct component types or registry entries.

TF-12 establishes a capability before TF-11 resolution; it does not modify or automatically invoke the resolver. Callers can validate and then pass accepted input to TF-11. TF-13 may later add defaults, but this validator does not provide them.

## Scope

Included: pure declarative validation and structured validation results for existing schema contracts.

Out of scope: rendering, resolution, registry construction, persistence, APIs, editor/runtime behavior, defaults, migrations/versioning, and the dedicated TF-17 test suite. No schema fields or third-party validation dependencies are introduced.
