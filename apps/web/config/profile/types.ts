/**
 * @file config/profile/types.ts
 *
 * TypeScript type definitions for Profile Configuration (Layer 3), following
 * docs/architecture/configuration-schema.md §7.
 *
 * Profile configuration contains profile linkage and display/visibility
 * preferences only. Biographical and career records belong to identity data.
 */

import type { AuditMetadata, EntityId, SchemaVersion } from "../platform/types";
import type { professionManifestCatalog } from "../profession";

export type { AuditMetadata };

type SupportedProfessionId = keyof typeof professionManifestCatalog;

/** ISO 8601 UTC timestamp string, as specified by TF-02 §4. */
export type ISOTimestamp = string;

/**
 * Layer 3 profile linkage and display configuration (TF-02 §7).
 * Profession IDs are narrowed to IDs exposed by the TF-04 catalog, which is
 * itself checked against platformConfig.supportedProfessions.
 */
export interface ProfileConfiguration {
  schemaVersion: SchemaVersion;
  profileId: EntityId;
  userId: EntityId;
  primaryProfessionId: SupportedProfessionId;
  secondaryProfessionIds?: SupportedProfessionId[];
  slug: string;
  customDomain?: string;
  locale: string;
  status: "draft" | "published" | "archived";

  visibility: {
    isPublic: boolean;
    showContactEmail: boolean;
    showPhoneNumber: boolean;
    showLocation: boolean;
    allowSearchIndexing: boolean;
  };

  socialLinks: Array<{
    platform: "github" | "linkedin" | "x" | "orcid" | "dribbble" | "website" | "other";
    url: string;
    label: string;
    visible: boolean;
  }>;

  audit: AuditMetadata;
}
