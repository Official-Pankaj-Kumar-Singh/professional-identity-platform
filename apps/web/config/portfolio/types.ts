/**
 * @file config/portfolio/types.ts
 *
 * TypeScript definitions for Portfolio Configuration (Layer 5), following
 * docs/architecture/configuration-schema.md §§9–11.
 */

import type { AuditMetadata, EntityId, SchemaVersion } from "../platform";
import type { ColorMode, ComponentStyleConfiguration } from "../theme";

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

export interface ResponsiveLayoutConfig {
  containerWidth: "full" | "wide" | "standard" | "narrow";
  columns: {
    mobile: 1;
    tablet: 1 | 2;
    desktop: 1 | 2 | 3 | 4;
  };
  alignment: "left" | "center" | "right";
  paddingY: "compact" | "normal" | "spacious";
}

export interface SectionFilterConfig {
  tagFilter?: string[];
  featuredOnly?: boolean;
  maxItems?: number;
  sortBy?: "chronological-desc" | "chronological-asc" | "priority" | "manual";
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

export interface SectionConfiguration {
  sectionId: EntityId;
  type: string;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  variant: string;
  layout: ResponsiveLayoutConfig;
  filter?: SectionFilterConfig;
  componentConfig: ComponentConfiguration;
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
