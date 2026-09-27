# Portfolio Configuration — Layer 5

Portfolio Configuration describes how one portfolio presents identity data. Its type definitions are in `types.ts`, with public type exports in `index.ts`. The contract follows TF-02 §9–11.

## Relationship to other configuration layers

- **Platform (Layer 1)** defines supported section types, variants, default component mappings, and platform constraints. A portfolio selects from those supported capabilities.
- **Profession (Layer 2)** supplies profession-specific recommended sections, labels, ordering, and default variants. Portfolio choices specialize the presentation for one portfolio.
- **Profile (Layer 3)** links to the identity record and holds profile-level visibility preferences. Portfolio configuration references its `profileId`; it does not contain biography or career records.
- **Theme (Layer 4)** defines reusable design tokens. Portfolio configuration selects a theme with `themeId` and a `colorMode`; it does not duplicate theme tokens.

## Sections and ordering

`sections` is a record keyed by section identifier. Each `SectionConfiguration` describes its type, optional title and subtitle, variant, layout, optional filters, enabled state, and component configuration. `sectionOrder` lists section IDs in display order. The schema expects those IDs to identify sections in the record. An `enabled` value controls whether a section is active; the ordering list defines sequence.

## Layout and component configuration

`ResponsiveLayoutConfig` defines container width, columns, alignment, and vertical padding across supported breakpoints. A section can also specify filters such as tags, featured-only display, item limits, or sort order.

`ComponentConfiguration` identifies a component and variant, structured props, shared style settings, and optional responsive behavior. Its source contract is in `config/component`; the Portfolio Configuration API re-exports it for compatibility. Component IDs and variants must correspond to approved platform capabilities. This configuration describes choices only; it does not implement or load components.

## Theme selection

Each portfolio stores `themeId` and `colorMode`. Theme IDs come from the platform's supported theme catalog, and theme tokens are defined by Layer 4. Theme selection here is a reference, not a copy of theme configuration.

## Scope

This layer defines types for declarative portfolio configuration. It does not implement configuration resolution, rendering, a component registry, persistence, an API, or a database.
