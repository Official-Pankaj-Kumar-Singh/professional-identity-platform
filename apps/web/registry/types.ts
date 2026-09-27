/**
 * @file registry/types.ts
 *
 * Declarative metadata contracts for the approved Component Registry,
 * following configuration-schema.md §19 and
 * configuration-architecture.md §6.
 */

import type { EntityId } from "../config/platform";

/** Metadata describing one statically approved component and variant. */
export interface ComponentDescriptor<TProps extends object = Record<string, unknown>> {
  componentId: EntityId;
  sectionType: string;
  variant: string;
  displayName: string;
  propsSchema: unknown;
  allowedSlots?: string[];
  defaultProps: Partial<TProps>;
  isResponsive: boolean;
}

/** Readonly shape for a static catalog indexed by component ID. */
export type ComponentRegistry = Readonly<Record<string, ComponentDescriptor>>;
