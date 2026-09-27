/**
 * Pure deterministic composition of selected configuration layers into the
 * ResolvedPortfolioConfiguration defined by TF-02 §14.
 */

import type { ComponentStyleConfiguration } from "../component";
import type { ThemeTokens } from "../theme";
import type { ConfigurationResolutionInput, ResolvedPortfolioConfiguration, ResolvedSection } from "./types";

function copyThemeTokens(tokens: ThemeTokens): ThemeTokens {
  return {
    colors: { ...tokens.colors },
    typography: {
      fonts: { ...tokens.typography.fonts },
      scale: { ...tokens.typography.scale },
      weights: { ...tokens.typography.weights },
      lineHeights: { ...tokens.typography.lineHeights },
    },
    spacing: { ...tokens.spacing },
    radii: { ...tokens.radii },
    shadows: { ...tokens.shadows },
    transitions: { ...tokens.transitions },
  };
}

function resolveThemeTokens(input: ConfigurationResolutionInput): ThemeTokens {
  const { theme, portfolio } = input;
  const useDarkTokens =
    portfolio.colorMode === "dark" ||
    (portfolio.colorMode === "system" && theme.baseMode === "dark");
  const light = theme.tokens.light;
  const dark = useDarkTokens ? theme.tokens.dark : undefined;

  if (!dark) return copyThemeTokens(light);

  return {
    colors: { ...light.colors, ...dark.colors },
    typography: {
      fonts: { ...light.typography.fonts, ...dark.typography?.fonts },
      scale: { ...light.typography.scale, ...dark.typography?.scale },
      weights: { ...light.typography.weights, ...dark.typography?.weights },
      lineHeights: { ...light.typography.lineHeights, ...dark.typography?.lineHeights },
    },
    spacing: { ...light.spacing, ...dark.spacing },
    radii: { ...light.radii, ...dark.radii },
    shadows: { ...light.shadows, ...dark.shadows },
    transitions: { ...light.transitions, ...dark.transitions },
  };
}

function copyResolvedProps(props: Record<string, boolean | number | string | string[]>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
  );
}

function resolveStyles(
  defaults: Partial<ComponentStyleConfiguration> | undefined,
  sectionStyles: ComponentStyleConfiguration,
): ComponentStyleConfiguration {
  const merged = { ...defaults, ...sectionStyles };
  const customClassModifiers = sectionStyles.customClassModifiers ?? defaults?.customClassModifiers;

  return {
    density: merged.density,
    elevation: merged.elevation,
    borderStyle: merged.borderStyle,
    accentHighlight: merged.accentHighlight,
    ...(customClassModifiers ? { customClassModifiers: [...customClassModifiers] } : {}),
  };
}

function resolveSections(input: ConfigurationResolutionInput): ResolvedSection[] {
  const { platform, profession, portfolio, theme } = input;

  return portfolio.sectionOrder.flatMap((sectionId) => {
    const section = portfolio.sections[sectionId]!;
    if (!section.enabled) return [];

    const professionSection = profession.availableSections.find((item) => item.sectionId === section.sectionId);
    const platformSectionType = platform.supportedSectionTypes.find((item) => item.type === section.type);
    const componentId = section.componentConfig.componentId;
    const sectionTitle =
      section.title ?? professionSection?.titleDefault ?? platformSectionType?.label ?? section.type;

    return [
      {
        sectionId: section.sectionId,
        type: section.type,
        title: sectionTitle,
        ...(section.subtitle === undefined ? {} : { subtitle: section.subtitle }),
        variant: section.variant,
        componentId,
        layout: {
          ...section.layout,
          columns: { ...section.layout.columns },
        },
        styles: resolveStyles(theme.componentDefaults?.[componentId], section.componentConfig.styles),
        ...(section.filter
          ? {
              filter: {
                ...section.filter,
                ...(section.filter.tagFilter ? { tagFilter: [...section.filter.tagFilter] } : {}),
              },
            }
          : {}),
        resolvedProps: copyResolvedProps(section.componentConfig.props),
      },
    ];
  });
}

/**
 * Resolve already selected layer inputs into the schema-defined final shape.
 * Input references are not mutated; resolved nested configuration values are
 * copied so callers can treat the result independently.
 */
export function resolvePortfolioConfiguration(
  input: ConfigurationResolutionInput,
): ResolvedPortfolioConfiguration {
  const { portfolio, profile } = input;

  return {
    schemaVersion: portfolio.schemaVersion,
    portfolioId: portfolio.portfolioId,
    profileId: profile.profileId,
    professionId: profile.primaryProfessionId,
    title: portfolio.title,
    locale: profile.locale,
    colorMode: portfolio.colorMode,
    theme: {
      themeId: portfolio.themeId,
      tokens: resolveThemeTokens(input),
    },
    navigation: {
      ...portfolio.navigation,
      ...(portfolio.navigation.customLinks
        ? { customLinks: portfolio.navigation.customLinks.map((link) => ({ ...link })) }
        : {}),
    },
    sections: resolveSections(input),
    footer: { ...portfolio.footer },
    seo: { ...portfolio.seo },
    resolvedAt: input.resolvedAt,
  };
}
