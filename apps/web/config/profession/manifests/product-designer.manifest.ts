/**
 * @file config/profession/manifests/product-designer.manifest.ts
 *
 * Profession Manifest — Product Designer (Layer 2)
 *
 * professionId: "product-designer"
 * Registered in: platformConfig.supportedProfessions
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const productDesignerManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "product-designer",
  displayName: "Product Designer",
  category: "Creative Arts",
  description:
    "Professionals who shape digital products through user research, interaction design, and visual craft. Portfolios centre on case studies, visual work, and design philosophy.",

  // ── Themes ────────────────────────────────────────────────────────────────
  recommendedThemes: [
    "creative-expressive",
    "platform-default",
    "engineering-minimal",
  ],
  defaultThemeId: "creative-expressive",

  // ── Default section order ─────────────────────────────────────────────────
  defaultSectionOrder: [
    "hero",
    "projects",
    "skills",
    "experience",
    "education",
    "testimonials",
    "contact",
  ],

  // ── Available sections ────────────────────────────────────────────────────
  availableSections: [
    {
      sectionId: "hero",
      type: "hero",
      titleDefault: "Introduction",
      defaultVariant: "split-portrait",
      isRequired: true,
      defaultEnabled: true,
    },
    {
      sectionId: "projects",
      type: "projects",
      titleDefault: "Selected Works",
      defaultVariant: "case-study-cards",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "skills",
      type: "skills",
      titleDefault: "Design Skills",
      defaultVariant: "categorised-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Experience",
      defaultVariant: "timeline",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "education",
      type: "education",
      titleDefault: "Education",
      defaultVariant: "compact-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "credentials",
      type: "credentials",
      titleDefault: "Certifications",
      defaultVariant: "badge-grid",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "publications",
      type: "publications",
      titleDefault: "Articles & Talks",
      defaultVariant: "compact-list",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "testimonials",
      type: "testimonials",
      titleDefault: "Client Testimonials",
      defaultVariant: "grid",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "contact",
      type: "contact",
      titleDefault: "Let's Work Together",
      defaultVariant: "simple-links",
      isRequired: false,
      defaultEnabled: true,
    },
  ],

  // ── Vocabulary ────────────────────────────────────────────────────────────
  vocabulary: {
    experienceSectionTitle: "Experience",
    projectsSectionTitle: "Selected Works",
    credentialsSectionTitle: "Certifications",
    skillsSectionTitle: "Design Skills",
    publicationsSectionTitle: "Articles & Talks",
    heroRoleLabel: "Product Designer",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  highlightedAttributes: ["dribbble", "figmaProfile", "designTools", "caseStudyCount"],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name% | Product Designer Portfolio",
    defaultKeywords: [
      "product designer",
      "UX designer",
      "UI designer",
      "interaction design",
      "design portfolio",
    ],
  },
} as const;
