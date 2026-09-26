# Platform Configuration — Layer 1 (`config/platform/`)

**TF Task**: TF-03  
**Architecture reference**: [`docs/architecture/configuration-architecture.md`](../../../docs/architecture/configuration-architecture.md)  
**Schema reference**: [`docs/architecture/configuration-schema.md`](../../../docs/architecture/configuration-schema.md) §5

---

## What lives here

| File | Purpose |
| :--- | :--- |
| `types.ts` | TypeScript type definitions aligned to TF-02 schema §5 |
| `platform.config.ts` | Concrete platform configuration object (Layer 1 defaults) |
| `index.ts` | Public barrel — import from `@/config/platform` |

---

## What this layer owns

- The complete **section-type catalog** (what section types are legal across the platform).
- The set of **allowed component variants** for each section type.
- **Default component mappings** (section type → fallback component registry ID).
- Platform-wide **security limits** (max sections, max links, payload caps, URL protocol allowlist).
- Platform **metadata** (name, version, schemaVersion).
- The **default theme ID** and the list of all shipped theme IDs.

## What this layer does NOT own

| Concern | Correct layer |
| :--- | :--- |
| Profession-specific section ordering or vocabulary | Profession Manifest (Layer 2) |
| User identity data (name, job title, social links) | Profile Configuration (Layer 3) |
| Visual design tokens (colors, fonts, spacing) | Theme Configuration (Layer 4) |
| Per-portfolio section selections or navigation | Portfolio Configuration (Layer 5) |
| Manual user customisations | User Overrides (Layer 6) |
| AI-generated configuration proposals | AI Change Proposal (Layer 7) |

---

## Resolution hierarchy position

```
Platform Defaults  ← this folder
        ↓
Profession Defaults
        ↓
Profile Configuration
        ↓
Theme Defaults
        ↓
Portfolio Configuration
        ↓
User Overrides
        ↓
AI Changes
        ↓
Final Resolved Configuration
```

Platform Defaults are the **lowest-precedence** layer. Every other layer merges on top.

---

## Import path

```ts
import { platformConfig } from "@/config/platform";
import type { PlatformConfiguration } from "@/config/platform";
```

---

## Adding a new section type

1. Add a `PlatformSectionTypeDescriptor` entry to `supportedSectionTypes` in `platform.config.ts`.
2. Add a `defaultComponentMappings` entry pointing to the future component registry ID.
3. Create and register the React component in the Component Registry (future TF task).
4. If the new type needs a new variant key, document it in `allowedVariants`.

## Adding a new profession

1. Add the `professionId` to `supportedProfessions` in `platform.config.ts`.
2. Create a matching Profession Manifest (Layer 2 — future TF task).
3. Zero changes to the renderer or Next.js routing are needed.

---

## Open decisions carried from TF-02

- **Component Registry validation timing** (TF-02 §20 Open Decision): whether `defaultComponentMappings` IDs are validated at dev-time (build) or only at runtime. Not resolved in TF-03.
- **Shared package migration**: once `packages/config` is established as a proper workspace package, these types should move there so they are importable by the API layer without depending on `apps/web`.
