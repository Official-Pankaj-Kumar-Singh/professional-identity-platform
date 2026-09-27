/**
 * @file config/profession/manifests/architect.manifest.ts
 *
 * Profession Manifest — Architect (Layer 2)
 *
 * professionId: "architect"
 * Registered in: platformConfig.supportedProfessions
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const architectManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "architect",
  displayName: "Architect",
  category: "Architecture & Design",
  description:
    "Architects present selected projects, design experience, education, professional credentials, and areas of architectural expertise.",

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
    "experience",
    "skills",
    "education",
    "credentials",
    "publications",
    "testimonials",
    "contact",
  ],

  // ── Available sections ────────────────────────────────────────────────────
  availableSections: [
    {
      sectionId: "hero",
      type: "hero",
      titleDefault: "Introduction",
      defaultVariant: "split-abstract",
      isRequired: true,
      defaultEnabled: true,
    },
    {
      sectionId: "projects",
      type: "projects",
      titleDefault: "Selected Projects",
      defaultVariant: "case-study-cards",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Professional Experience",
      defaultVariant: "cards",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "skills",
      type: "skills",
      titleDefault: "Areas of Expertise",
      defaultVariant: "categorised-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "education",
      type: "education",
      titleDefault: "Education",
      defaultVariant: "timeline",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "credentials",
      type: "credentials",
      titleDefault: "Credentials & Licensure",
      defaultVariant: "badge-grid",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "publications",
      type: "publications",
      titleDefault: "Publications",
      defaultVariant: "featured-cards",
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
      titleDefault: "Contact",
      defaultVariant: "simple-links",
      isRequired: false,
      defaultEnabled: true,
    },
  ],

  // ── Vocabulary ────────────────────────────────────────────────────────────
  vocabulary: {
    experienceSectionTitle: "Professional Experience",
    projectsSectionTitle: "Selected Projects",
    credentialsSectionTitle: "Credentials & Licensure",
    skillsSectionTitle: "Areas of Expertise",
    publicationsSectionTitle: "Publications",
    heroRoleLabel: "Architect",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  highlightedAttributes: [
    "architecturalProjects",
    "designSpecialties",
    "professionalLicensure",
    "softwareTools",
  ],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name% | Architect Portfolio",
    defaultKeywords: [
      "architect portfolio",
      "architectural design",
      "architecture projects",
      "architectural experience",
      "licensed architect",
    ],
  },
} as const;
