/**
 * @file config/resolution/types.ts
 *
 * Configuration resolution contracts following
 * docs/architecture/configuration-schema.md §14.
 */

import type { ComponentStyleConfiguration } from "../component";
import type { EntityId, SchemaVersion } from "../platform";
import type { PortfolioConfiguration, PortfolioFooterConfig, PortfolioNavigationConfig, PortfolioSeoConfig } from "../portfolio";
import type { ProfessionManifest } from "../profession";
import type { ProfileConfiguration, ISOTimestamp } from "../profile";
import type { ResponsiveLayoutConfig, SectionFilterConfig } from "../section";
import type { ColorMode, ThemeTokens, ThemeConfiguration } from "../theme";
import type { PlatformConfiguration } from "../platform";

/** Flattened section shape consumed by later rendering stages. */
export interface ResolvedSection {
  sectionId: string;
  type: string;
  title: string;
  subtitle?: string;
  variant: string;
  componentId: string;
  layout: ResponsiveLayoutConfig;
  styles: ComponentStyleConfiguration;
  filter?: SectionFilterConfig;
  resolvedProps: Record<string, unknown>;
}

/** Final resolved contract from configuration-schema.md §14. */
export interface ResolvedPortfolioConfiguration {
  schemaVersion: SchemaVersion;
  portfolioId: EntityId;
  profileId: EntityId;
  professionId: EntityId;
  title: string;
  locale: string;
  colorMode: ColorMode;
  theme: {
    themeId: EntityId;
    tokens: ThemeTokens;
  };
  navigation: PortfolioNavigationConfig;
  sections: ResolvedSection[];
  footer: PortfolioFooterConfig;
  seo: PortfolioSeoConfig;
  resolvedAt: ISOTimestamp;
}

/** Explicit, already selected source configurations for one portfolio. */
export interface ConfigurationResolutionInput {
  platform: PlatformConfiguration;
  profession: ProfessionManifest;
  profile: ProfileConfiguration;
  theme: ThemeConfiguration;
  portfolio: PortfolioConfiguration;
  resolvedAt: ISOTimestamp;
}
