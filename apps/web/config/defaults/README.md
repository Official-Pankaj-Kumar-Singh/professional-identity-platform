# Configuration Defaults (TF-13)

`applyConfigurationDefaults` returns a new, partially defaulted portfolio draft and an ordered list of applied paths and their source. It is a pure, deterministic preparation step for the existing Layer 5 Portfolio Configuration; it does not mutate the supplied portfolio or its platform, profession, profile, theme, or registry sources.

## Sources and precedence

Defaults apply only where a field is `undefined`. Explicit portfolio values take precedence and are copied as supplied, including invalid values that TF-12 must report.

- Portfolio values are the highest precedence.
- The selected Profession Manifest supplies its default theme, section order, enabled state, title, and variant.
- Platform Configuration supplies the theme fallback when no profession theme default is present, section layout and variant/label fallbacks, component ID mappings, and schema version.
- The selected Profile supplies `profileId` when the portfolio omits it.
- The selected Theme supplies `baseMode` as the color-mode default and per-component style defaults. Explicit section styles override those defaults, matching TF-11's existing style merge.
- The supplied Component Registry supplies the selected component variant and default props where available.
- Schema-neutral empty objects are used for omitted `seo`, component `props`, and component `responsive` because their members are optional or empty by contract. No product behavior is selected by these values.

For an individual section field, precedence is explicit portfolio section value → profession default → platform default. For theme selection, it is explicit portfolio `themeId` → profession `defaultThemeId` → platform `defaultThemeId`. Theme and registry sources only fill their corresponding lower-level component fields.

## Unresolved values

The result lists required schema paths still missing an authoritative source in `unresolvedPaths`. For example, no current source chooses a portfolio title, navigation style/flags, footer flags, audit timestamps, or the required base component style values when the selected theme has no component default. Profession SEO templates and keywords do not map to the current Portfolio SEO contract, so they are not transformed into portfolio metadata. TF-13 leaves those values absent for the caller to supply; it does not invent them.

Explicit section content, order, navigation, footer, SEO values, filters, component props/styles/responsive settings, and all other provided values are preserved. Defaulted sections are created only for IDs in the effective order that the profession manifest describes; an explicit empty order remains empty.

## Validation and resolution relationship

Defaults and validation have separate responsibilities. Apply TF-13 to omitted values, then call the existing TF-12 validator to determine whether the result is valid. TF-13 never repairs invalid explicit values and does not invoke or modify TF-12. Its result is a draft and may remain incomplete, as indicated by `unresolvedPaths`.

TF-11 remains an independent resolution function and is not modified or automatically called. Callers may later pass a complete, validated configuration into TF-11.

## Out of scope

No rendering, persistence, network/API access, editor behavior, database lookup, migrations/versioning, authentication, AI behavior, or dedicated TF-17 test suite is added. This is not the broader TF-18 documentation task.
