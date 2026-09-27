/**
 * @file config/profession/manifests/software-engineer.manifest.ts
 *
 * Profession Manifest — Software Engineer (Layer 2)
 *
 * professionId: "software-engineer"
 * Registered in: platformConfig.supportedProfessions
 *
 * All section types, variants, and theme IDs are taken from
 * platformConfig.supportedSectionTypes and platformConfig.supportedThemes.
 * No values are invented outside those catalogs.
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const softwareEngineerManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "software-engineer",
  displayName: "Software Engineer",
  category: "Engineering",
  description:
    "Professionals who design, build, and maintain software systems. Portfolios emphasise technical projects, open-source contributions, technology stack, and engineering experience.",

  // ── Themes ────────────────────────────────────────────────────────────────
  // Ordered: most to least recommended for this profession.
  // IDs are from platformConfig.supportedThemes.
  recommendedThemes: [
    "engineering-minimal",
    "platform-default",
    "academic-scholarly",
  ],
  defaultThemeId: "engineering-minimal",

  // ── Default section order ─────────────────────────────────────────────────
  // Ordered list of sectionIds from availableSections below.
  defaultSectionOrder: [
    "hero",
    "skills",
    "projects",
    "experience",
    "education",
    "credentials",
    "publications",
    "testimonials",
    "contact",
  ],

  // ── Available sections ────────────────────────────────────────────────────
  // Section types and variants must exist in platformConfig.supportedSectionTypes.
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
      sectionId: "skills",
      type: "skills",
      titleDefault: "Technical Skills",
      defaultVariant: "tag-cloud",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "projects",
      type: "projects",
      titleDefault: "Projects",
      defaultVariant: "grid",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Work Experience",
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
      titleDefault: "Articles & Writing",
      defaultVariant: "compact-list",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "testimonials",
      type: "testimonials",
      titleDefault: "Recommendations",
      defaultVariant: "grid",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "contact",
      type: "contact",
      titleDefault: "Get in Touch",
      defaultVariant: "simple-links",
      isRequired: false,
      defaultEnabled: true,
    },
  ],

  // ── Vocabulary ────────────────────────────────────────────────────────────
  vocabulary: {
    experienceSectionTitle: "Work Experience",
    projectsSectionTitle: "Projects",
    credentialsSectionTitle: "Certifications",
    skillsSectionTitle: "Technical Skills",
    publicationsSectionTitle: "Articles & Writing",
    heroRoleLabel: "Software Engineer",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  // Keys reference profile identity attributes, not user data values.
  highlightedAttributes: ["github", "techStack", "openSourceContributions"],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name% | Software Engineer Portfolio",
    defaultKeywords: [
      "software engineer",
      "developer portfolio",
      "full stack",
      "open source",
      "programming",
    ],
  },
} as const;
