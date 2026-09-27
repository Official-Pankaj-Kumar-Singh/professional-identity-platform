/**
 * @file config/portfolio/types.ts
 *
 * TypeScript definitions for Portfolio Configuration (Layer 5), following
 * docs/architecture/configuration-schema.md §§9–11.
 */

import type { AuditMetadata, EntityId, SchemaVersion } from "../platform";
import type { ColorMode, ComponentStyleConfiguration } from "../theme";
import type { SectionConfiguration } from "../section";

export type { ResponsiveLayoutConfig, SectionConfiguration, SectionFilterConfig } from "../section";

export interface NavigationLinkConfig {
  label: string;
  targetSectionId: string;
  visible: boolean;
}

export interface PortfolioNavigationConfig {
  style: "top-bar" | "floating" | "sidebar" | "minimal" | "none";
  sticky: boolean;
  showContactAction: boolean;
  customLinks?: NavigationLinkConfig[];
}

export interface PortfolioFooterConfig {
  showSocials: boolean;
  showBackToTop: boolean;
  customCopyrightNotice?: string;
  showPoweredBy: boolean;
}

export interface PortfolioSeoConfig {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export interface ComponentConfiguration {
  componentId: EntityId;
  variant: string;
  props: Record<string, boolean | number | string | string[]>;
  styles: ComponentStyleConfiguration;
  responsive: {
    hideOnMobile?: boolean;
    collapseOnMobile?: boolean;
  };
}

export interface PortfolioConfiguration {
  schemaVersion: SchemaVersion;
  portfolioId: EntityId;
  profileId: EntityId;
  title: string;
  themeId: EntityId;
  colorMode: ColorMode;
  navigation: PortfolioNavigationConfig;
  sectionOrder: string[];
  sections: Record<string, SectionConfiguration>;
  footer: PortfolioFooterConfig;
  seo: PortfolioSeoConfig;
  audit: AuditMetadata;
}
