/**
 * @file config/theme/types.ts
 *
 * TypeScript type definitions for Theme Configuration (Layer 4), following
 * docs/architecture/configuration-schema.md §8 and §11.
 *
 * These are declarative data shapes only. Theme resolution, rendering, and
 * CSS generation are outside this layer.
 */

import type { AuditMetadata, EntityId, SchemaVersion } from "../platform";

/** Visual display mode shared by theme and portfolio configuration. */
export type ColorMode = "light" | "dark" | "system";

/** Complete semantic design-token set for a theme mode. */
export interface ThemeTokens {
  colors: {
    background: string;
    surface: string;
    surfaceSubtle: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentContrast: string;
    border: string;
    borderSubtle: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fonts: {
      heading: string;
      body: string;
      mono?: string;
    };
    scale: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      "2xl": string;
      "3xl": string;
      "4xl": string;
    };
    weights: {
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeights: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    unit: string;
    containerMaxWidth: string;
    sectionPaddingY: string;
  };
  radii: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    none: string;
    subtle: string;
    medium: string;
    prominent: string;
  };
  transitions: {
    fast: string;
    normal: string;
  };
}

/** Declarative component styling defaults supported by the TF-02 schema. */
export interface ComponentStyleConfiguration {
  density: "compact" | "comfortable" | "spacious";
  elevation: "none" | "subtle" | "medium" | "prominent";
  borderStyle: "none" | "subtle" | "prominent";
  accentHighlight: boolean;
  customClassModifiers?: string[];
}

/** Reusable Layer 4 theme document (TF-02 §8). */
export interface ThemeConfiguration {
  schemaVersion: SchemaVersion;
  themeId: EntityId;
  displayName: string;
  author: "platform" | "profession" | "user";
  baseMode: ColorMode;
  tokens: {
    light: ThemeTokens;
    dark?: Partial<ThemeTokens>;
  };
  componentDefaults?: Record<string, Partial<ComponentStyleConfiguration>>;
  audit: AuditMetadata;
}
