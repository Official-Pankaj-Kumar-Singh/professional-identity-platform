# Profile Configuration — Layer 3

## Location and structure

Profile configuration types live in `types.ts` and are exported from `index.ts`. The `ProfileConfiguration` interface follows TF-02 §7 exactly: profile and user identifiers, profession linkage, slug/domain and locale, status, visibility settings, social-link settings, and audit metadata. No profile instances or personal data are stored in this configuration module.

## Relationship to other layers

Profile configuration follows platform defaults and profession defaults in the TF-01 hierarchy. Platform configuration defines the supported profession IDs. The TF-04 profession catalog exposes the matching manifests. A profile's `primaryProfessionId` selects its primary profession; optional `secondaryProfessionIds` lists additional supported professions. Profile configuration stores these links only and does not duplicate profession defaults.

Profile configuration contains privacy/display choices and references. Names, biography, experience, education, skills, credentials, and other factual career records belong to identity data, not this layer.

## Adding profile configuration

When a future application or persistence layer creates a profile document, use `ProfileConfiguration` and import the type from `@/config/profile`. Keep identifiers and profession links aligned with the platform and profession catalogs. TF-02 does not define repository storage for profile instances or a default profile, so this layer adds no sample instance.

## Unresolved decisions

- TF-02 defines audit fields but does not specify which service assigns timestamps, version increments, or source values.
- Slug uniqueness, custom-domain verification, and rules relating publication status to visibility flags are not defined by this layer's schema.
- Configuration resolution location and array merge semantics remain open in TF-01. This layer does not implement resolution.
- The shared configuration package migration and validation timing remain open in the existing platform/profession documentation.
