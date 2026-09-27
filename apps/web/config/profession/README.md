# Profession Configuration — Layer 2

Profession defaults live in `manifests/`, with one declarative TypeScript object per supported profession. The public catalog in `index.ts` exposes those manifests by `professionId`.

Each manifest follows TF-02 §6 (`ProfessionManifest`): schema and profession identifiers, display metadata, recommended/default themes, default section order, available section descriptors, vocabulary, highlighted attribute keys, and SEO defaults. The shared type is in `types.ts`.

Profession manifests specialize platform defaults. Their profession IDs, themes, section types, and variants must come from `platformConfig` in `../platform/`; manifests choose domain-specific defaults and labels while platform configuration remains the reusable catalog of supported values. Manifest data contains no user-specific values, and this layer does not resolve configuration.

## Adding a profession

1. Add its ID to `supportedProfessions` in `../platform/platform.config.ts` and ensure its themes, section types, and variants already exist there.
2. Add a manifest under `manifests/` that satisfies `ProfessionManifest` and uses only those platform IDs.
3. Add the manifest to `professionManifestCatalog` in `index.ts`.

## Open decisions

- The component registry's validation timing remains unresolved (TF-02 §20; also recorded in the platform README).
- The future shared configuration package and migration of these types from `apps/web` remain unresolved.
- The schema treats highlighted attributes as string keys, but the repository has no shared attribute-key catalog or cross-layer validation for them.
- Array merge semantics and resolution location (server/client) remain architecture decisions documented in TF-01; resolution is outside this layer's scope.
