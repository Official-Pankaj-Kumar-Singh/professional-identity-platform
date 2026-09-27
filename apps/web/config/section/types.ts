/**
 * @file config/section/types.ts
 *
 * Declarative type definitions for an individual portfolio section (Layer 5),
 * following docs/architecture/configuration-schema.md §10.
 */

import type { EntityId } from "../platform";
import type { ComponentConfiguration } from "../portfolio/types";

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
