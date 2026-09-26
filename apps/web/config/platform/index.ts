/**
 * @file config/platform/index.ts
 *
 * Public barrel for the Platform Configuration layer (TF-03).
 *
 * Import from this path rather than importing the individual files directly,
 * so that the internal file layout can change without breaking callers.
 *
 * Usage (within apps/web):
 *   import { platformConfig } from "@/config/platform";
 *   import type { PlatformConfiguration } from "@/config/platform";
 */

export { platformConfig } from "./platform.config";
export type {
  PlatformConfiguration,
  PlatformSectionTypeDescriptor,
  PlatformDefaultLayout,
  PlatformSecurityLimits,
  SchemaVersion,
  EntityId,
} from "./types";
