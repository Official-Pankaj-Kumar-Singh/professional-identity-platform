import type { ComponentConfiguration, ComponentStyleConfiguration } from "../config/component";
import type { ConfigurationValidationInput } from "../config/validation";
import type { PortfolioConfiguration } from "../config/portfolio";
import type { ProfileConfiguration } from "../config/profile";
import type { ComponentDescriptor, ComponentRegistry } from "../registry";
import type { ThemeConfiguration, ThemeTokens } from "../config/theme";
import { platformConfig } from "../config/platform/platform.config";
import { professionManifestCatalog } from "../config/profession";

export const audit = {
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
  source: "user",
} as const;

const baseStyles: ComponentStyleConfiguration = {
  density: "comfortable",
  elevation: "none",
  borderStyle: "none",
  accentHighlight: false,
};

export const themeTokens: ThemeTokens = {
  colors: {
    background: "#ffffff",
    surface: "#ffffff",
    surfaceSubtle: "#f8f8f8",
    surfaceElevated: "#ffffff",
    textPrimary: "#111111",
    textSecondary: "#333333",
    textMuted: "#666666",
    accent: "#3366ff",
    accentHover: "#2244cc",
    accentContrast: "#ffffff",
    border: "#dddddd",
    borderSubtle: "#eeeeee",
    success: "#118833",
    warning: "#aa7700",
    error: "#bb2222",
  },
  typography: {
    fonts: { heading: "Inter, sans-serif", body: "Inter, sans-serif" },
    scale: { xs: "12px", sm: "14px", base: "16px", lg: "18px", xl: "20px", "2xl": "24px", "3xl": "30px", "4xl": "36px" },
    weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    lineHeights: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
  },
  spacing: { unit: "4px", containerMaxWidth: "1120px", sectionPaddingY: "48px" },
  radii: { none: "0px", sm: "4px", md: "8px", lg: "12px", full: "9999px" },
  shadows: { none: "none", subtle: "0 1px 2px #000000", medium: "0 3px 8px #000000", prominent: "0 8px 20px #000000" },
  transitions: { fast: "150ms ease-out", normal: "250ms ease-out" },
};

export const themeConfiguration: ThemeConfiguration = {
  schemaVersion: 1,
  themeId: "engineering-minimal",
  displayName: "Engineering Minimal",
  author: "platform",
  baseMode: "light",
  tokens: { light: themeTokens },
  componentDefaults: {
    "core:hero-minimal": {
      density: "spacious",
      elevation: "medium",
      borderStyle: "subtle",
      accentHighlight: true,
      customClassModifiers: ["theme-token"],
    },
    "core:projects-grid": {
      density: "comfortable",
      elevation: "subtle",
      borderStyle: "subtle",
      accentHighlight: true,
    },
  },
  audit: { ...audit },
};

export const profileConfiguration: ProfileConfiguration = {
  schemaVersion: 1,
  profileId: "profile-test",
  userId: "user-test",
  primaryProfessionId: "software-engineer",
  slug: "engineer-test",
  locale: "en-US",
  status: "draft",
  visibility: {
    isPublic: false,
    showContactEmail: false,
    showPhoneNumber: false,
    showLocation: false,
    allowSearchIndexing: false,
  },
  socialLinks: [],
  audit: { ...audit },
};

function componentConfiguration(
  componentId: string,
  variant: string,
  props: ComponentConfiguration["props"] = {},
  styles: ComponentStyleConfiguration = { ...baseStyles },
): ComponentConfiguration {
  return { componentId, variant, props, styles, responsive: {} };
}

export const portfolioConfiguration: PortfolioConfiguration = {
  schemaVersion: 1,
  portfolioId: "portfolio-test",
  profileId: profileConfiguration.profileId,
  title: "Test Portfolio",
  themeId: themeConfiguration.themeId,
  colorMode: "light",
  navigation: {
    style: "top-bar",
    sticky: false,
    showContactAction: false,
    customLinks: [{ label: "Projects", targetSectionId: "projects", visible: true }],
  },
  sectionOrder: ["projects", "hero", "skills"],
  sections: {
    hero: {
      sectionId: "hero",
      type: "hero",
      enabled: true,
      variant: "minimal",
      layout: { containerWidth: "standard", columns: { mobile: 1, tablet: 1, desktop: 1 }, alignment: "left", paddingY: "normal" },
      componentConfig: componentConfiguration("core:hero-minimal", "minimal", { badges: ["typescript", "testing"] }, {
        density: "compact",
        elevation: "none",
        borderStyle: "none",
        accentHighlight: false,
      }),
    },
    projects: {
      sectionId: "projects",
      type: "projects",
      enabled: true,
      variant: "grid",
      layout: { containerWidth: "wide", columns: { mobile: 1, tablet: 2, desktop: 3 }, alignment: "left", paddingY: "spacious" },
      filter: { featuredOnly: true, tagFilter: ["open-source"] },
      componentConfig: componentConfiguration("core:projects-grid", "grid", { showMetrics: true }),
    },
    skills: {
      sectionId: "skills",
      type: "skills",
      enabled: false,
      variant: "tag-cloud",
      layout: { containerWidth: "standard", columns: { mobile: 1, tablet: 2, desktop: 2 }, alignment: "left", paddingY: "normal" },
      componentConfig: componentConfiguration("core:skills-tag-cloud", "tag-cloud"),
    },
  },
  footer: { showSocials: true, showBackToTop: true, showPoweredBy: false },
  seo: { metaTitle: "Test engineer portfolio", noIndex: true },
  audit: { ...audit },
};

const registryVariants: Record<string, string> = {
  hero: "minimal",
  experience: "timeline",
  projects: "grid",
  skills: "tag-cloud",
  credentials: "badge-grid",
  publications: "citation-list",
  education: "timeline",
  testimonials: "grid",
  contact: "simple-links",
  custom: "rich-text",
};

const registry: Record<string, ComponentDescriptor> = {};
for (const [sectionType, componentId] of Object.entries(platformConfig.defaultComponentMappings)) {
  registry[componentId] = {
    componentId,
    sectionType,
    variant: registryVariants[sectionType],
    displayName: `${sectionType} default`,
    propsSchema: { type: "object" },
    defaultProps: sectionType === "projects" ? { showMetrics: false } : {},
    isResponsive: true,
  };
}

export const componentRegistry: ComponentRegistry = registry;

export function createValidationInput(): ConfigurationValidationInput {
  return {
    platform: platformConfig,
    profession: professionManifestCatalog["software-engineer"],
    profile: profileConfiguration,
    theme: themeConfiguration,
    portfolio: portfolioConfiguration,
    componentRegistry,
  };
}
