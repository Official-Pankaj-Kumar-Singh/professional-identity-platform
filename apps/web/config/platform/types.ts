/**
 * @file config/platform/types.ts
 *
 * TypeScript type definitions for the Platform Configuration layer.
 *
 * These types represent Layer 1 (Platform Defaults) of the TF-01 resolution
 * hierarchy and are derived directly from the TF-02 schema specification:
 *   docs/architecture/configuration-schema.md
 *
 * CONSTRAINTS (from TF-01 / TF-02):
 * - These are pure data-shape types — no executable logic.
 * - Platform config MUST NOT contain user-specific data, profession-specific
 *   opinions, or presentation configuration (those belong to higher layers).
 * - All values flowing through the resolution pipeline must eventually conform
 *   to these types or be rejected at the validation gate.
 *
 * DO NOT import application code (React, Next.js APIs, etc.) from this file.
 */

// ---------------------------------------------------------------------------
// Shared primitive types (subset of TF-02 §4 "Common Identifiers")
// ---------------------------------------------------------------------------

/**
 * Integer schema revision. Increment when breaking changes are introduced.
 * A schema migration function must accompany every increment.
 */
export type SchemaVersion = 1;

/**
 * Stable lowercase entity identifier.
 * Pattern: ^[a-z0-9_-]{2,64}$
 */
export type EntityId = string;

/** Provenance and audit metadata shared across configuration layers (TF-02 §4). */
export interface AuditMetadata {
  createdAt: string;
  updatedAt: string;
  version: number;
  source: "system" | "user" | "ai" | "admin";
}

// ---------------------------------------------------------------------------
// Supported section type descriptor
// ---------------------------------------------------------------------------

/**
 * Describes a section type supported at the platform level.
 * Each section type defines the variants the renderer may legally select.
 *
 * Profession Manifests (Layer 2) choose from these types; they cannot
 * introduce new types not registered here.
 */
export interface PlatformSectionTypeDescriptor {
  /** Stable machine identifier, e.g. "hero", "experience", "projects" */
  type: EntityId;

  /** Human-readable display name shown in builder UI */
  label: string;

  /** Brief description of what the section communicates */
  description: string;

  /**
   * All component variant keys the renderer is permitted to use for this
   * section type. Must match entries in the future Component Registry.
   * Example: ["minimal", "split-portrait"] for "hero".
   */
  allowedVariants: string[];

  /**
   * The variant used when no higher-precedence layer specifies one.
   * Must be a member of allowedVariants.
   */
  defaultVariant: string;

  /**
   * When true, only one instance of this section type may appear per
   * portfolio. The resolution engine enforces this at validation time.
   */
  isSingleton: boolean;

  /**
   * Default responsive layout applied when no layer overrides it.
   * These are the narrowest possible defaults — profession/portfolio
   * layers are expected to refine them.
   */
  defaultLayout: PlatformDefaultLayout;
}

// ---------------------------------------------------------------------------
// Default responsive layout (platform baseline)
// ---------------------------------------------------------------------------

/**
 * Platform-level responsive layout baseline.
 * Aligned to TF-02 §10 ResponsiveLayoutConfig.
 */
export interface PlatformDefaultLayout {
  containerWidth: "full" | "wide" | "standard" | "narrow";
  columns: {
    mobile: 1;
    tablet: 1 | 2;
    desktop: 1 | 2 | 3 | 4;
  };
  alignment: "left" | "center" | "right";
  paddingY: "compact" | "normal" | "spacious";
}

// ---------------------------------------------------------------------------
// Security limits
// ---------------------------------------------------------------------------

/**
 * Hard limits enforced by the platform that no user, profession, or AI layer
 * may override. Validated at the resolution gate.
 */
export interface PlatformSecurityLimits {
  /** Maximum number of sections per portfolio (prevents abuse). */
  maxSectionsPerPortfolio: number;

  /** Maximum number of custom navigation links. */
  maxCustomLinks: number;

  /** Maximum resolved configuration payload in bytes (pre-renderer). */
  maxPayloadSizeBytes: number;

  /**
   * Protocols permitted in URL fields (socialLinks, customDomain, ogImage…).
   * Any other protocol causes the field to be rejected during validation.
   */
  allowedUrlProtocols: readonly ("http:" | "https:" | "mailto:" | "tel:")[];
}

// ---------------------------------------------------------------------------
// Platform Configuration (Layer 1)
// ---------------------------------------------------------------------------

/**
 * Root type for the platform-level configuration layer.
 *
 * This is the lowest-precedence layer in the TF-01 resolution hierarchy.
 * All subsequent layers (Profession Manifest, Profile, Theme, Portfolio,
 * User Overrides, AI Changes) merge on top of this baseline.
 *
 * What this type OWNS:
 *   - Global section-type catalog (what sections are legal)
 *   - Allowed variants per section type
 *   - Default component mappings (section type → component ID)
 *   - Platform-wide security limits
 *   - Platform metadata (name, version, schemaVersion)
 *   - Pointers to the default theme and the set of shipped themes
 *
 * What this type DOES NOT OWN:
 *   - User identity data (→ ProfileConfiguration)
 *   - Profession-specific section ordering or vocabulary (→ ProfessionManifest)
 *   - Visual design tokens such as colors, fonts, spacing (→ ThemeConfiguration)
 *   - Portfolio-specific section selections or layout choices (→ PortfolioConfiguration)
 *   - User customizations (→ UserOverrides)
 *   - AI-generated changes (→ AIChangeProposal)
 */
export interface PlatformConfiguration {
  /** Must equal 1 until a breaking schema change increments it. */
  schemaVersion: SchemaVersion;

  /** Stable machine ID for this platform instance. */
  platformId: EntityId;

  metadata: {
    /** Human-readable platform product name. */
    name: string;
    /** Semantic version string for the platform configuration bundle. */
    version: string;
  };

  /**
   * IDs of professions the platform officially supports.
   * Profession Manifests (Layer 2) must declare a professionId present here.
   */
  supportedProfessions: EntityId[];

  /**
   * Complete catalog of section types the platform permits.
   * The Component Registry (future TF task) will map these to React components.
   */
  supportedSectionTypes: PlatformSectionTypeDescriptor[];

  /**
   * ID of the theme used when no other layer selects one.
   * Must be present in supportedThemes.
   */
  defaultThemeId: EntityId;

  /**
   * IDs of all themes shipped with the platform.
   * Theme configurations (Layer 4) are loaded separately by ID.
   */
  supportedThemes: EntityId[];

  /**
   * Platform security limits that the validation gate enforces.
   * These are non-negotiable across all resolution layers.
   */
  securityLimits: PlatformSecurityLimits;

  /**
   * Fallback component ID for each section type when a portfolio or
   * profession layer does not specify a componentId.
   *
   * Key:   section type (e.g. "hero")
   * Value: component registry ID (e.g. "core:hero-minimal")
   *
   * Populated now as human-readable placeholders; the Component Registry
   * (future task) will validate these references at build time.
   */
  defaultComponentMappings: Record<string, string>;
}
