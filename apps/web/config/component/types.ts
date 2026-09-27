/**
 * @file config/component/types.ts
 *
 * Declarative component configuration types following
 * docs/architecture/configuration-schema.md §11.
 */

import type { EntityId } from "../platform";

export interface ComponentStyleConfiguration {
  density: "compact" | "comfortable" | "spacious";
  elevation: "none" | "subtle" | "medium" | "prominent";
  borderStyle: "none" | "subtle" | "prominent";
  accentHighlight: boolean;
  customClassModifiers?: string[];
}

export interface ComponentConfiguration {
  componentId: EntityId;
  variant: string;
  props: Record<string, boolean | number | string | string[]>;
  styles: ComponentStyleConfiguration;
  responsive: {
    hideOnMobile?: boolean;
    collapseOnMobile?: boolean;
  };
}
