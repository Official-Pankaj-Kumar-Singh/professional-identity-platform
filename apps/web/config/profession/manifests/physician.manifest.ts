/**
 * @file config/profession/manifests/physician.manifest.ts
 *
 * Profession Manifest — Physician (Layer 2)
 *
 * professionId: "physician"
 * Registered in: platformConfig.supportedProfessions
 *
 * Reference:
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { ProfessionManifest } from "../types";

export const physicianManifest: ProfessionManifest = {
  schemaVersion: 1,
  professionId: "physician",
  displayName: "Physician",
  category: "Healthcare",
  description:
    "Licensed medical doctors and clinical specialists. Portfolios foreground board certifications, clinical experience, hospital affiliations, research, and publications.",

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
    "publications",
    "projects",
    "skills",
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
      sectionId: "credentials",
      type: "credentials",
      titleDefault: "Board Certifications & Licensure",
      defaultVariant: "detailed-cards",
      isRequired: true,
      defaultEnabled: true,
    },
    {
      sectionId: "experience",
      type: "experience",
      titleDefault: "Clinical Appointments",
      defaultVariant: "timeline",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "education",
      type: "education",
      titleDefault: "Medical Education & Residency",
      defaultVariant: "timeline",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "publications",
      type: "publications",
      titleDefault: "Research & Publications",
      defaultVariant: "citation-list",
      isRequired: false,
      defaultEnabled: true,
    },
    {
      sectionId: "projects",
      type: "projects",
      titleDefault: "Clinical Research & Trials",
      defaultVariant: "featured-list",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "skills",
      type: "skills",
      titleDefault: "Clinical Competencies",
      defaultVariant: "categorised-list",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "testimonials",
      type: "testimonials",
      titleDefault: "Peer Endorsements",
      defaultVariant: "grid",
      isRequired: false,
      defaultEnabled: false,
    },
    {
      sectionId: "contact",
      type: "contact",
      titleDefault: "Contact & Referrals",
      defaultVariant: "simple-links",
      isRequired: false,
      defaultEnabled: true,
    },
  ],

  // ── Vocabulary ────────────────────────────────────────────────────────────
  vocabulary: {
    experienceSectionTitle: "Clinical Appointments",
    projectsSectionTitle: "Clinical Research & Trials",
    credentialsSectionTitle: "Board Certifications & Licensure",
    skillsSectionTitle: "Clinical Competencies",
    publicationsSectionTitle: "Research & Publications",
    heroRoleLabel: "Physician",
  },

  // ── Highlighted attributes ────────────────────────────────────────────────
  highlightedAttributes: [
    "npiNumber",
    "boardCertifications",
    "hospitalAffiliations",
    "medicalSpecialty",
  ],

  // ── SEO defaults ──────────────────────────────────────────────────────────
  seoDefaults: {
    titleTemplate: "%name%, MD | %role% | Clinical Portfolio",
    defaultKeywords: [
      "physician",
      "medical doctor",
      "clinical specialist",
      "board certified",
      "medical research",
    ],
  },
} as const;
