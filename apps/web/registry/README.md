# Component Registry Foundation

The Component Registry is the compile-time catalog boundary between declarative configuration and approved component implementations. This TF-10 foundation defines the typed metadata for a descriptor and the readonly shape of a catalog indexed by component ID. The contracts follow configuration-architecture.md §6 and configuration-schema.md §19.

## Descriptor metadata

Each `ComponentDescriptor` records its component ID, section type, variant, display name, props schema, optional slots, default props, and responsive capability. `ComponentRegistry` describes a readonly record of descriptors. `propsSchema` is opaque metadata here; this module does not execute or validate it.

## Relationship to configuration contracts

`ComponentConfiguration` in `config/component` describes a section's requested component, variant, props, styles, and responsive behavior. `SectionConfiguration` in `config/section` owns the section-level association to that configuration. Registry descriptors describe the approved component metadata that future registry entries can associate with those identifiers. They do not redefine either configuration contract.

## Scope and boundaries

This module defines types only. The repository does not yet contain approved portfolio component implementations to register, so no placeholder descriptors or runtime catalog entries are added. The contracts establish the catalog shape for entries to be introduced with approved components.

Rendering, React component lookup or execution, configuration resolution (TF-11), configuration validation (TF-12), persistence, APIs, editors, and AI modification logic are out of scope. The registry metadata does not carry arbitrary executable component code.
