/**
 * @file config/profession/manifests/lawyer.manifest.ts
 *
 * Profession Manifest — Lawyer (Layer 2)
 *
 * professionId: "lawyer"
 * Registered in: platformConfig.supportedProfessions
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const lawyerManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "lawyer",
  displayName: "Lawyer",
  category: "Legal",
  description:
    "Legal professionals present their practice experience, credentials, education, selected matters, publications, and professional expertise.",

  // ── Themes ────────────────────────────────────────────────────────────────
  recommendedThemes: [
    "clinical-clarity",
    "academic-scholarly",
    "platform-default",
  ],
  defaultThemeId: "clinical-clarity",

  // ── Default section order ─────────────────────────────────────────────────
  defaultSectionOrder: [
    "hero",
    "credentials",
    "experience",
    "education",
    "projects",
    "publications",
    "skills",
    "testimonials",
    "contact",
  ],

  // ── Available sections ────────────────────────────────────────────────────
  availableSections: [
    {
      sectionId: "hero",
      type: "hero",
      titleDefault: "Introduction",
      defaultVariant: "minimal",
      isRequired: true,
      defaultEnabled: true,
    },
    {
      sectionId: "credentials",
      type: "credentials",
      titleDefault: "Admissions & Credentials",
      defaultVariant: "detailed-cards",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Legal Experience",
      defaultVariant: "timeline",
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
      sectionId: "projects",
      type: "projects",
      titleDefault: "Selected Matters",
      defaultVariant: "featured-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "publications",
      type: "publications",
      titleDefault: "Publications & Commentary",
      defaultVariant: "citation-list",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "skills",
      type: "skills",
      titleDefault: "Practice Areas",
      defaultVariant: "categorised-list",
      isRequired: false,
      defaultEnabled: true,
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
    experienceSectionTitle: "Legal Experience",
    projectsSectionTitle: "Selected Matters",
    credentialsSectionTitle: "Admissions & Credentials",
    skillsSectionTitle: "Practice Areas",
    publicationsSectionTitle: "Publications & Commentary",
    heroRoleLabel: "Lawyer",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  highlightedAttributes: [
    "barAdmissions",
    "practiceAreas",
    "jurisdictions",
    "representativeMatters",
  ],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name% | Lawyer Portfolio",
    defaultKeywords: [
      "lawyer",
      "attorney portfolio",
      "legal experience",
      "practice areas",
      "legal professional",
    ],
  },
} as const;
