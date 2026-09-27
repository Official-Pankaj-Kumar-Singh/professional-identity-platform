# Component Configuration

Component Configuration describes the declarative settings that bind a section to an approved component identifier and variant. Its type definitions are in `types.ts` and public type exports are in `index.ts`. The contract follows TF-02 §11.

## Relationship to Section Configuration

Each `SectionConfiguration` references one `ComponentConfiguration` through `componentConfig`. The section owns its identity, presentation text, layout, and optional content filter; the component configuration owns the component identifier, variant, structured props, styles, and responsive behavior.

## Relationship to Theme Configuration

`ComponentStyleConfiguration` defines the shared style shape for a component. Theme Configuration can provide partial component style defaults using this type. Theme defaults and per-section component settings refer to the same contract.

## Scope

This package defines only the declarative `ComponentConfiguration` and `ComponentStyleConfiguration` contracts from the authoritative schema. Existing imports from the Portfolio and Theme config packages remain supported for compatibility.

## Out of scope

This package does not implement or define a component registry, renderer, runtime mapping, resolution, validation engine, persistence, API, or editor. It does not contain component implementations or executable code.
