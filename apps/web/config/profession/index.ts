/**
 * Public catalog for the Profession Configuration layer (TF-04).
 *
 * Import profession defaults from this module rather than individual files.
 */

import type { platformConfig } from "../platform/platform.config";
import type { ProfessionManifest } from "./types";
import { academicResearcherManifest } from "./manifests/academic-researcher.manifest";
import { architectManifest } from "./manifests/architect.manifest";
import { lawyerManifest } from "./manifests/lawyer.manifest";
import { physicianManifest } from "./manifests/physician.manifest";
import { productDesignerManifest } from "./manifests/product-designer.manifest";
import { softwareEngineerManifest } from "./manifests/software-engineer.manifest";

type SupportedProfessionId = (typeof platformConfig.supportedProfessions)[number];

/** Manifest lookup keyed by every profession currently supported in Layer 1. */
export const professionManifestCatalog = {
  "software-engineer": softwareEngineerManifest,
  "product-designer": productDesignerManifest,
  physician: physicianManifest,
  "academic-researcher": academicResearcherManifest,
  lawyer: lawyerManifest,
  architect: architectManifest,
} satisfies Record<SupportedProfessionId, ProfessionManifest>;

export type { ProfessionManifest, ProfessionSectionDescriptor, ProfessionVocabulary, ProfessionSeoDefaults } from "./types";
