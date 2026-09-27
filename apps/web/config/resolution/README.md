# Configuration Resolution — TF-11

This module composes explicitly selected Platform, Profession, Profile, Theme, and Portfolio configuration into the authoritative `ResolvedPortfolioConfiguration` shape from configuration-schema.md §14. The public API is exported from `index.ts`; source layer selection remains the caller's responsibility.

## Resolution behavior

- Portfolio `sectionOrder` determines the output sequence. Sections with `enabled: false` are omitted.
- A required section title uses the first available value from the portfolio section title, matching profession section's `titleDefault`, matching platform section type's label, then the section type.
- Per-section component styles override matching Theme `componentDefaults` values.
- Light theme tokens are the base; partial dark tokens overlay them in dark mode. For `system`, the theme's `baseMode` selects the token set while the resolved `colorMode` remains `system`.
- Profile supplies `profileId`, primary `professionId`, and `locale`; Portfolio supplies portfolio identity, title, theme selection, navigation, footer, SEO, section order, and section settings.
- `resolvedAt` is an explicit input, so identical input values produce identical output. Nested output data is copied rather than mutating source configurations.

## Contract boundary

`ResolvedPortfolioConfiguration` and `ResolvedSection` follow the fields in TF-02 §14. The resolver assumes the supplied layer objects and their references are coherent; it does not validate them. Callers provide the matching profession and theme objects for the profile and portfolio. User Overrides and AI Change layers are not accepted because those runtime input types are not implemented in the existing configuration modules.

Validation (TF-12), a defaults system (TF-13), migrations, persistence, APIs, editor behavior, rendering, CSS generation, and AI modification logic are outside this module's scope.
