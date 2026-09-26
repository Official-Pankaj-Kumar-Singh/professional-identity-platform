/**
 * @file config/platform/platform.config.ts
 *
 * Platform Configuration — Layer 1 of the TF-01 resolution hierarchy.
 *
 * This is the lowest-precedence configuration object in the system.
 * Every other layer (Profession Manifest, Profile, Theme, Portfolio,
 * User Overrides, AI Changes) merges on top of this baseline.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Resolution order (lowest → highest precedence)             │
 * │  1. Platform Defaults        ← THIS FILE                    │
 * │  2. Profession Defaults                                      │
 * │  3. Profile Configuration                                    │
 * │  4. Theme Defaults                                           │
 * │  5. Portfolio Configuration                                  │
 * │  6. User Overrides                                           │
 * │  7. AI Changes                                               │
 * │  8. Final Resolved Configuration                             │
 * └─────────────────────────────────────────────────────────────┘
 *
 * WHAT THIS FILE OWNS
 * ───────────────────
 *  • The complete catalog of legally supported section types.
 *  • The set of allowed component variants for each section type.
 *  • Platform-wide security limits (max sections, URL protocols, …).
 *  • Default component mappings (section type → fallback component ID).
 *  • Platform metadata (name, version, schemaVersion).
 *  • The ID of the default theme and the list of all shipped themes.
 *
 * WHAT THIS FILE DOES NOT OWN
 * ────────────────────────────
 *  • User identity data → ProfileConfiguration (future TF task)
 *  • Profession-specific vocabulary or section order → ProfessionManifest
 *  • Visual design tokens (colors, fonts, spacing) → ThemeConfiguration
 *  • Portfolio structure and navigation → PortfolioConfiguration
 *  • User customisations → UserOverrides
 *  • AI-generated mutations → AIChangeProposal
 *
 * CONSTRAINTS (TF-01 / TF-02)
 * ────────────────────────────
 *  • This module is pure declarative data. No executable logic.
 *  • No React, Next.js APIs, or external library imports.
 *  • All values are plain TypeScript literals (strings, numbers, booleans,
 *    arrays, and objects). Nothing computed at runtime.
 *
 * Reference:
 *  TF-01  docs/architecture/configuration-architecture.md
 *  TF-02  docs/architecture/configuration-schema.md §5
 */

import type { PlatformConfiguration } from "./types";

// ---------------------------------------------------------------------------
// Platform Configuration Object
// ---------------------------------------------------------------------------

export const platformConfig: PlatformConfiguration = {
  // ── Schema version ────────────────────────────────────────────────────────
  schemaVersion: 1,

  // ── Platform identity ─────────────────────────────────────────────────────
  platformId: "professional-identity-platform",

  metadata: {
    name: "Professional Identity Platform",
    version: "0.1.0",
  },

  // ── Supported professions ─────────────────────────────────────────────────
  // Profession Manifests (Layer 2) must declare one of these IDs.
  // Adding a new profession never requires modifying this list alone —
  // a corresponding Profession Manifest must also be created.
  supportedProfessions: [
    "software-engineer",
    "product-designer",
    "physician",
    "academic-researcher",
    "lawyer",
    "architect",
  ],

  // ── Section type catalog ──────────────────────────────────────────────────
  //
  // Canonical section types available to any portfolio on the platform.
  // Profession Manifests select from this list; they cannot introduce types
  // not declared here.
  //
  // Component IDs use the form "core:<section-type>-<variant>".
  // These identifiers are placeholders until the Component Registry (future
  // TF task) validates them at build time.
  supportedSectionTypes: [
    // ── Hero ───────────────────────────────────────────────────────────────
    {
      type: "hero",
      label: "Hero / Introduction",
      description:
        "The primary introduction section displayed at the top of every portfolio. Presents the professional's name, headline role, and primary call-to-action.",
      allowedVariants: ["minimal", "centered", "split-portrait", "split-abstract"],
      defaultVariant: "minimal",
      isSingleton: true,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "left",
        paddingY: "spacious",
      },
    },

    // ── Experience ─────────────────────────────────────────────────────────
    {
      type: "experience",
      label: "Work Experience",
      description:
        "Professional work history, clinical appointments, academic positions, or equivalent career milestones. Vocabulary is overridden per profession.",
      allowedVariants: ["timeline", "cards", "compact-list"],
      defaultVariant: "timeline",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Projects ───────────────────────────────────────────────────────────
    {
      type: "projects",
      label: "Projects",
      description:
        "Portfolio-worthy projects, clinical trials, research initiatives, or case studies. Vocabulary is overridden per profession.",
      allowedVariants: ["grid", "featured-list", "case-study-cards", "compact-grid"],
      defaultVariant: "grid",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 2, desktop: 3 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Skills ─────────────────────────────────────────────────────────────
    {
      type: "skills",
      label: "Skills",
      description:
        "Technical, clinical, or domain-specific competencies. May include proficiency levels or category groupings.",
      allowedVariants: ["tag-cloud", "categorised-list", "proficiency-bars"],
      defaultVariant: "tag-cloud",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 2, desktop: 2 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Credentials / Certifications ───────────────────────────────────────
    {
      type: "credentials",
      label: "Credentials & Certifications",
      description:
        "Professional licenses, board certifications, academic degrees, and formal accreditations.",
      allowedVariants: ["badge-grid", "compact-list", "detailed-cards"],
      defaultVariant: "badge-grid",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 2, desktop: 3 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Publications ───────────────────────────────────────────────────────
    {
      type: "publications",
      label: "Publications",
      description:
        "Academic papers, books, articles, blog posts, or other published works. Vocabulary is overridden per profession.",
      allowedVariants: ["citation-list", "featured-cards", "compact-list"],
      defaultVariant: "citation-list",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Education ──────────────────────────────────────────────────────────
    {
      type: "education",
      label: "Education",
      description:
        "Degrees, residencies, fellowships, bootcamps, and other formal education milestones.",
      allowedVariants: ["timeline", "cards", "compact-list"],
      defaultVariant: "timeline",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "left",
        paddingY: "normal",
      },
    },

    // ── Testimonials ───────────────────────────────────────────────────────
    {
      type: "testimonials",
      label: "Testimonials",
      description:
        "Professional recommendations, client testimonials, or peer endorsements.",
      allowedVariants: ["carousel", "grid", "featured-single"],
      defaultVariant: "grid",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 2, desktop: 3 },
        alignment: "center",
        paddingY: "normal",
      },
    },

    // ── Contact ────────────────────────────────────────────────────────────
    {
      type: "contact",
      label: "Contact",
      description:
        "Visitor-facing contact options: email link, social handles, booking link, or a contact form reference.",
      allowedVariants: ["simple-links", "card-with-form", "social-grid"],
      defaultVariant: "simple-links",
      isSingleton: true,
      defaultLayout: {
        containerWidth: "narrow",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "center",
        paddingY: "spacious",
      },
    },

    // ── Custom / Freeform ──────────────────────────────────────────────────
    {
      type: "custom",
      label: "Custom Section",
      description:
        "A generic section for content that does not fit the standard catalog. Structured data only — no arbitrary markup.",
      allowedVariants: ["rich-text", "media-and-text", "stat-grid"],
      defaultVariant: "rich-text",
      isSingleton: false,
      defaultLayout: {
        containerWidth: "standard",
        columns: { mobile: 1, tablet: 1, desktop: 1 },
        alignment: "left",
        paddingY: "normal",
      },
    },
  ],

  // ── Theme registry ────────────────────────────────────────────────────────
  defaultThemeId: "platform-default",
  supportedThemes: [
    "platform-default",    // Neutral, accessible — suits all professions
    "clinical-clarity",    // Clean, authoritative — Healthcare / Legal
    "engineering-minimal", // Dense, data-focused — Engineering / Tech
    "creative-expressive", // Bold, visual-first — Design / Art / Media
    "academic-scholarly",  // Typographic, restrained — Academia / Research
  ],

  // ── Security limits ───────────────────────────────────────────────────────
  // These are hard caps enforced by the validation gate at resolution time.
  // No user or AI layer may exceed them.
  securityLimits: {
    maxSectionsPerPortfolio: 20,
    maxCustomLinks: 10,
    maxPayloadSizeBytes: 512_000, // 512 KB
    allowedUrlProtocols: ["https:", "mailto:", "tel:"] as const,
  },

  // ── Default component mappings ────────────────────────────────────────────
  //
  // Maps each section type to the fallback component ID used when a portfolio
  // or profession layer does not specify a componentId.
  //
  // Format: "<namespace>:<section-type>-<variant>"
  //   • "core" namespace = components shipped with the platform.
  //   • These IDs are forward references: the Component Registry (future TF
  //     task) will validate them at build time. Unknown IDs must not reach
  //     the renderer.
  //
  // Open decision (TF-02 §20): whether the Component Registry validates these
  // at dev-time or only at runtime. Documented; not resolved in TF-03.
  defaultComponentMappings: {
    hero:          "core:hero-minimal",
    experience:    "core:experience-timeline",
    projects:      "core:projects-grid",
    skills:        "core:skills-tag-cloud",
    credentials:   "core:credentials-badge-grid",
    publications:  "core:publications-citation-list",
    education:     "core:education-timeline",
    testimonials:  "core:testimonials-grid",
    contact:       "core:contact-simple-links",
    custom:        "core:custom-rich-text",
  },
} as const;
