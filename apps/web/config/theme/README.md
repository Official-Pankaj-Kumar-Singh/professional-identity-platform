# Theme Configuration — Layer 4

## Layer position and structure

Theme configuration is Layer 4 in the TF-01 hierarchy, after platform, profession, and profile configuration and before portfolio configuration. The TF-02 §8 types live in `types.ts` and are exported from `index.ts`.

`ThemeConfiguration` identifies a reusable theme, its author and base color mode, light tokens, optional partial dark tokens, optional component styling defaults, and audit metadata. `ThemeTokens` defines semantic colors, typography, spacing, radii, shadows, and transitions. `ComponentStyleConfiguration` follows the shared TF-02 shape defined in `config/component`; Theme Configuration continues to re-export it for compatibility.

## Relationships to other configuration layers

- **Platform:** `platformConfig.defaultThemeId` and `supportedThemes` identify platform defaults and supported theme IDs. This folder defines the theme document shape; it does not add a second theme registry.
- **Profession:** profession manifests may recommend supported theme IDs and choose a default ID. They reference themes rather than copying theme token definitions.
- **Profile and portfolio:** profile configuration carries profile linkage and visibility preferences. Portfolio configuration has a `themeId` and `colorMode` to select presentation preferences for a portfolio. Theme documents provide reusable tokens for those references.

Themes are reusable across professions and portfolios. This task defines types only; TF-02 does not provide authoritative token values or complete theme documents for the IDs in platform configuration, so no sample theme catalog is added.

## Scope and open decisions

Theme resolution, mode switching, rendering, and CSS generation are outside TF-07. TF-01 leaves open whether theme tokens map directly to CSS variables/Tailwind or remain abstract semantic tokens. TF-02 also does not define how `baseMode` interacts with the required `tokens.light` and optional partial `tokens.dark`, or how `componentDefaults` keys are checked against the future component registry. Common configuration types currently live in the platform type module; whether they should eventually move to a shared package remains a broader architecture task.
