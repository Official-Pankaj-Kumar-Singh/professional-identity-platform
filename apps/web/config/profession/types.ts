/**
 * @file config/profession/types.ts
 *
 * TypeScript type definitions for the Profession Manifest layer (Layer 2).
 *
 * These types implement the TF-02 schema contract for Layer 2:
 *   docs/architecture/configuration-schema.md  §6
 *
 * The ProfessionManifest is the authoritative interface for all profession
 * configuration objects. Every profession supported by the platform must
 * provide an object that satisfies this interface.
 *
 * CONSTRAINTS (TF-01 / TF-02):
 * - Pure data-shape types only. No executable logic.
 * - No React, Next.js, or external library imports.
 * - Profession manifests MUST NOT contain individual user data.
 * - All section types, variants, and theme IDs referenced in a manifest
 *   MUST exist in the platform configuration (Layer 1).
 *
 * Reference:
 *   TF-01  docs/architecture/configuration-architecture.md
 *   TF-02  docs/architecture/configuration-schema.md §6
 */

import type { EntityId, SchemaVersion } from "../platform/types";

// Re-export the shared primitives so callers can import from one place.
export type { EntityId, SchemaVersion };

// ---------------------------------------------------------------------------
// Available section descriptor (within a Profession Manifest)
// ---------------------------------------------------------------------------

/**
 * Describes one section that a profession makes available to its portfolios.
 *
 * IMPORTANT: `type` and `defaultVariant` must reference values declared in
 * `platformConfig.supportedSectionTypes`. The resolution engine will reject
 * manifests that reference unknown types or variants.
 */
export interface ProfessionSectionDescriptor {
  /**
   * Stable identifier for this section within the profession's context.
   * Used as the key in `defaultSectionOrder` and later in portfolio configs.
   * Pattern: ^[a-z0-9_-]{2,64}$
   * Example: "experience-main", "publications-peer-reviewed"
   */
  sectionId: string;

  /**
   * Platform-level section type.
   * Must be one of the types in `platformConfig.supportedSectionTypes[].type`.
   */
  type: string;

  /**
   * The default heading label shown for this section in the profession's
   * vocabulary. May be overridden by User Overrides (Layer 6).
   * Example: "Clinical Appointments & Residencies" instead of "Work Experience"
   */
  titleDefault: string;

  /**
   * The component variant to use for this section by default.
   * Must be one of the values in `platformConfig.supportedSectionTypes`
   * allowedVariants for the corresponding type.
   */
  defaultVariant: string;

  /**
   * When true, the resolution engine will enforce that this section is always
   * present in portfolios of this profession. Users cannot disable it.
   */
  isRequired: boolean;

  /**
   * Whether the section appears in the portfolio by default.
   * Required sections always have defaultEnabled: true.
   */
  defaultEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Profession Manifest vocabulary
// ---------------------------------------------------------------------------

/**
 * Domain-specific vocabulary substitutions for a profession.
 *
 * These strings replace the generic section labels used at the platform
 * level with terminology natural to the profession, without altering
 * the underlying data model.
 *
 * All fields are required so that the resolution engine always has a
 * concrete label to fall back to. Use the generic platform label (e.g.
 * "Work Experience") for professions where the generic term fits.
 */
export interface ProfessionVocabulary {
  /** Label for the experience-type section(s). */
  experienceSectionTitle: string;
  /** Label for the projects-type section(s). */
  projectsSectionTitle: string;
  /** Label for the credentials-type section(s). */
  credentialsSectionTitle: string;
  /** Label for the skills-type section(s). */
  skillsSectionTitle: string;
  /** Label for the publications-type section(s). */
  publicationsSectionTitle: string;
  /**
   * Short role/title label used in the Hero section and
   * identity cards (e.g. "Software Engineer", "Attending Physician").
   */
  heroRoleLabel: string;
}

// ---------------------------------------------------------------------------
// Profession Manifest SEO defaults
// ---------------------------------------------------------------------------

export interface ProfessionSeoDefaults {
  /**
   * Page-title template for public portfolio pages.
   * Placeholders: %name% (professional's full name), %role% (primary role).
   * Example: "%name% | %role% | Portfolio"
   */
  titleTemplate: string;

  /**
   * Keywords relevant to the profession, used as a baseline for SEO.
   * Portfolio Configuration (Layer 5) and User Overrides (Layer 6) may
   * extend or replace these.
   */
  defaultKeywords: string[];
}

// ---------------------------------------------------------------------------
// Profession Manifest (Layer 2) — TF-02 §6
// ---------------------------------------------------------------------------

/**
 * A Profession Manifest establishes domain-tailored defaults for a specific
 * professional domain, enabling multi-profession support without creating
 * separate applications.
 *
 * Each manifest:
 *   - selects from the section types declared in platformConfig (Layer 1)
 *   - assigns a default section order and visibility for that profession
 *   - provides profession-specific vocabulary to relabel generic sections
 *   - recommends appropriate theme IDs from the platform theme catalog
 *   - declares highlighted attributes relevant to the profession
 *
 * What a manifest OWNS:
 *   - Profession-specific section selection and ordering
 *   - Domain vocabulary overrides
 *   - Recommended and default theme IDs
 *   - Highlighted attributes (used by identity cards / Hero)
 *   - SEO keyword defaults
 *
 * What a manifest DOES NOT OWN:
 *   - Individual user data → ProfileConfiguration (Layer 3)
 *   - Design tokens → ThemeConfiguration (Layer 4)
 *   - Per-portfolio layout choices → PortfolioConfiguration (Layer 5)
 *   - Manual user customisations → UserOverrides (Layer 6)
 *   - AI change proposals → AIChangeProposal (Layer 7)
 */
export interface ProfessionManifest {
  /** Must equal 1 until a breaking schema change increments it. */
  schemaVersion: SchemaVersion;

  /**
   * Stable machine identifier matching an entry in
   * `platformConfig.supportedProfessions`.
   */
  professionId: EntityId;

  /** Human-readable profession name for display in UI. */
  displayName: string;

  /**
   * Broad category grouping for navigation and filtering.
   * Example: "Engineering", "Healthcare", "Creative Arts", "Legal"
   */
  category: string;

  /** One- or two-sentence description of the profession's domain. */
  description: string;

  /**
   * Ordered list of theme IDs this profession works well with.
   * All IDs must exist in `platformConfig.supportedThemes`.
   * The first entry is shown as the recommended pick in the theme chooser.
   */
  recommendedThemes: EntityId[];

  /**
   * Theme applied to new portfolios for this profession before the user
   * makes an explicit choice.
   * Must exist in `platformConfig.supportedThemes`.
   */
  defaultThemeId: EntityId;

  /**
   * Ordered list of sectionIds defining the default portfolio layout.
   * Every ID must correspond to a `sectionId` in `availableSections`.
   * The resolution engine uses this as the starting sectionOrder before
   * PortfolioConfiguration (Layer 5) or UserOverrides (Layer 6) adjust it.
   */
  defaultSectionOrder: string[];

  /**
   * All sections the profession exposes to its portfolios.
   * Profession layers cannot introduce section types not declared in the
   * platform catalog (`platformConfig.supportedSectionTypes`).
   */
  availableSections: ProfessionSectionDescriptor[];

  /** Domain-specific vocabulary substitutions for generic section labels. */
  vocabulary: ProfessionVocabulary;

  /**
   * Identity attributes that should be visually foregrounded in Hero and
   * identity card components for this profession.
   * Example: ["github", "techStack"] for engineers,
   *          ["npiNumber", "boardCertifications"] for physicians.
   * These are attribute key names; the Profile layer provides the values.
   */
  highlightedAttributes: string[];

  /** SEO baseline for public portfolio pages in this profession. */
  seoDefaults: ProfessionSeoDefaults;
}
