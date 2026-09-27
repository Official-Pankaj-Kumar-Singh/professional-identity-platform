/**
 * @file config/profession/manifests/academic-researcher.manifest.ts
 *
 * Profession Manifest — Academic Researcher (Layer 2)
 *
 * professionId: "academic-researcher"
 * Registered in: platformConfig.supportedProfessions
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const academicResearcherManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "academic-researcher",
  displayName: "Academic Researcher",
  category: "Academia & Research",
  description:
    "Researchers and scholars present their academic appointments, education, publications, research projects, and areas of expertise.",

  // ── Themes ────────────────────────────────────────────────────────────────
  recommendedThemes: [
    "academic-scholarly",
    "platform-default",
    "clinical-clarity",
  ],
  defaultThemeId: "academic-scholarly",

  // ── Default section order ─────────────────────────────────────────────────
  defaultSectionOrder: [
    "hero",
    "publications",
    "experience",
    "projects",
    "education",
    "skills",
    "credentials",
    "testimonials",
    "contact",
  ],

  // ── Available sections ────────────────────────────────────────────────────
  availableSections: [
    {
      sectionId: "hero",
      type: "hero",
      titleDefault: "Introduction",
      defaultVariant: "centered",
      isRequired: true,
      defaultEnabled: true,
    },
    {
      sectionId: "publications",
      type: "publications",
      titleDefault: "Publications",
      defaultVariant: "citation-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Academic Appointments",
      defaultVariant: "timeline",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "projects",
      type: "projects",
      titleDefault: "Research Projects",
      defaultVariant: "featured-list",
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
      sectionId: "skills",
      type: "skills",
      titleDefault: "Research Expertise",
      defaultVariant: "categorised-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "credentials",
      type: "credentials",
      titleDefault: "Credentials",
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
      titleDefault: "Contact",
      defaultVariant: "simple-links",
      isRequired: false,
      defaultEnabled: true,
    },
  ],

  // ── Vocabulary ────────────────────────────────────────────────────────────
  vocabulary: {
    experienceSectionTitle: "Academic Appointments",
    projectsSectionTitle: "Research Projects",
    credentialsSectionTitle: "Credentials",
    skillsSectionTitle: "Research Expertise",
    publicationsSectionTitle: "Publications",
    heroRoleLabel: "Academic Researcher",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  highlightedAttributes: [
    "researchInterests",
    "orcid",
    "academicAffiliations",
    "citationCount",
  ],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name% | Academic Researcher Portfolio",
    defaultKeywords: [
      "academic researcher",
      "research portfolio",
      "academic publications",
      "research interests",
      "scholar portfolio",
    ],
  },
} as const;
