# Section Configuration — Layer 5

Section Configuration describes one presentation block in a portfolio, such as a hero, experience, or projects section. Its declarative type definitions are in `types.ts` and its public type exports are in `index.ts`. The contracts follow TF-02 §10.

## Relationship to Portfolio Configuration

A portfolio is the Layer 5 configuration for a specific profile. Its `sections` record contains `SectionConfiguration` entries, while `sectionOrder` defines their order. Each section carries its own enabled state, optional heading and subtitle, variant, responsive layout, optional content filters, and component settings. Section configuration describes choices; it does not contain identity records.

## Component Configuration dependency

`SectionConfiguration.componentConfig` uses the existing `ComponentConfiguration` contract from `config/portfolio/types.ts`. This keeps the section contract dependent on the established component identifier, variant, structured props, styles, and responsive settings without redefining or relocating that type.

## Scope

This package defines only declarative TypeScript contracts for responsive section layout, section filtering, and section configuration. It has no runtime behavior.

## Out of scope

Rendering, configuration resolution, a component registry, persistence, APIs, editors, and runtime logic are outside this package's scope. Component Configuration redesign or relocation is also outside this task (TF-09).
