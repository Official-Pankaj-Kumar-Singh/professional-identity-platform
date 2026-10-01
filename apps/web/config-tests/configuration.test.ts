import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./account-creation.test";
import "./account-identity-uniqueness.test";
import "./account-persistence.test";
import "./duplicate-identity-races.test";
import "./registration-form-feedback.test";
import "./registration-security.test";
import "./registration-field-rules.test";
import "./server-validation-parity.test";
import "./registration-validation-boundaries.test";
import "./account-management.test";
import "./auth-credential.test";
import "./authorization.test";
import "./password-hashing.test";
import "./recovery.test";
import "./registration-flow.test";
import "./registration-validation.test";
import "./session-lifecycle.test";
import "./sign-in.test";
import "./sign-in-experience.test";
import "./auth-boundary.test";
import "./logout.test";
import type { ConfigurationApiError, ConfigurationApiRequest, ConfigurationApiResponse } from "../config/api";
import type { ConfigurationRepository, ConfigurationUpdate } from "../config/persistence";
import { applyConfigurationDefaults } from "../config/defaults";
import type { DefaultablePortfolioConfiguration } from "../config/defaults";
import { resolvePortfolioConfiguration } from "../config/resolution";
import { validateConfiguration, validatePlatformConfiguration } from "../config/validation";
import type { ConfigurationPersistenceResult } from "../config/persistence";
import { areSchemaVersionsCompatible, createNextConfigurationVersion, getConfigurationVersion, isSupportedSchemaVersion } from "../config/versioning";
import type { PortfolioConfiguration } from "../config/portfolio";
import { platformConfig } from "../config/platform/platform.config";
import { professionManifestCatalog } from "../config/profession";
import { componentRegistry, createValidationInput, profileConfiguration, portfolioConfiguration, themeConfiguration, audit } from "./fixtures";

describe("platform, profession, and declarative configuration contracts", () => {
  it("publishes schema version 1 and consistent platform section/component catalogs", () => {
    assert.equal(platformConfig.schemaVersion, 1);
    assert.equal(platformConfig.supportedProfessions.length, Object.keys(professionManifestCatalog).length);
    for (const [sectionType, componentId] of Object.entries(platformConfig.defaultComponentMappings)) {
      assert.ok(platformConfig.supportedSectionTypes.some((section) => section.type === sectionType));
      assert.equal(componentRegistry[componentId]?.componentId, componentId);
      assert.equal(typeof componentRegistry[componentId]?.propsSchema, "object");
      assert.equal(typeof componentRegistry[componentId]?.defaultProps, "object");
    }
  });

  it("keeps every profession's section order and variants within the platform catalog", () => {
    for (const manifest of Object.values(professionManifestCatalog)) {
      const sectionIds = new Set(manifest.availableSections.map((section) => section.sectionId));
      assert.ok(manifest.defaultSectionOrder.every((id) => sectionIds.has(id)));
      for (const section of manifest.availableSections) {
        const platformSection = platformConfig.supportedSectionTypes.find((item) => item.type === section.type);
        assert.ok(platformSection);
        assert.ok(platformSection.allowedVariants.includes(section.defaultVariant));
        if (section.isRequired) assert.equal(section.defaultEnabled, true);
      }
    }
  });

  it("uses existing profile, portfolio, theme, section, and component contracts", () => {
    assert.equal(profileConfiguration.profileId, portfolioConfiguration.profileId);
    assert.equal(portfolioConfiguration.themeId, themeConfiguration.themeId);
    assert.equal(portfolioConfiguration.sections.hero.componentConfig.componentId, "core:hero-minimal");
    assert.equal(componentRegistry["core:hero-minimal"]?.sectionType, "hero");
    assert.equal(portfolioConfiguration.audit.version, 1);
  });
});

describe("configuration resolution (TF-11)", () => {
  it("orders enabled sections by sectionOrder and omits disabled sections", () => {
    const input = createValidationInput();
    const result = resolvePortfolioConfiguration({ ...input, resolvedAt: "2026-02-03T04:05:06Z" });

    assert.deepEqual(result.sections.map((section) => section.sectionId), ["projects", "hero"]);
    assert.equal(result.resolvedAt, "2026-02-03T04:05:06Z");
  });

  it("merges theme styles below explicit section styles and copies nested values", () => {
    const input = createValidationInput();
    const originalBadges = input.portfolio.sections.hero.componentConfig.props.badges;
    const originalTags = input.portfolio.sections.projects.filter?.tagFilter;
    const result = resolvePortfolioConfiguration({ ...input, resolvedAt: "2026-02-03T04:05:06Z" });
    const hero = result.sections.find((section) => section.sectionId === "hero");
    const projects = result.sections.find((section) => section.sectionId === "projects");

    assert.ok(hero);
    assert.deepEqual(hero.styles, {
      density: "compact",
      elevation: "none",
      borderStyle: "none",
      accentHighlight: false,
      customClassModifiers: ["theme-token"],
    });
    assert.notEqual(hero.resolvedProps.badges, originalBadges);
    assert.deepEqual(hero.resolvedProps.badges, ["typescript", "testing"]);
    assert.notEqual(projects?.filter?.tagFilter, originalTags);
    assert.equal(result.navigation.customLinks?.[0]?.label, "Projects");
    assert.notEqual(result.theme.tokens.colors, input.theme.tokens.light.colors);

    const resolvedBadges = hero.resolvedProps.badges;
    assert.ok(Array.isArray(resolvedBadges));
    resolvedBadges.push("resolved-only");
    assert.deepEqual(input.portfolio.sections.hero.componentConfig.props.badges, ["typescript", "testing"]);
  });
});

describe("configuration validation (TF-12)", () => {
  it("accepts a valid selected set of configuration layers", () => {
    const result = validateConfiguration(createValidationInput());
    assert.equal(result.valid, true, JSON.stringify(result.issues));
    assert.deepEqual(result.issues, []);
    assert.equal(validatePlatformConfiguration(platformConfig).valid, true);
  });

  it("reports malformed identifiers and unresolved profile references with structured paths", () => {
    const input = createValidationInput();
    const result = validateConfiguration({ ...input, portfolio: { ...input.portfolio, portfolioId: "Invalid*" } });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.code === "identifier.format" && issue.path === "portfolio.portfolioId"));
    assert.ok(result.issues.every((issue) => issue.severity === "error" && issue.message.length > 0));

    const unresolved = validateConfiguration({ ...input, portfolio: { ...input.portfolio, profileId: "profile-other" } });
    assert.ok(unresolved.issues.some((issue) => issue.code === "portfolio.profile.unresolved"));
  });

  it("rejects unregistered components, mismatched references, and unsupported schema versions", () => {
    const input = createValidationInput();
    const section = input.portfolio.sections.hero;
    const missingComponent = validateConfiguration({
      ...input,
      portfolio: { ...input.portfolio, sections: { ...input.portfolio.sections, hero: { ...section, componentConfig: { ...section.componentConfig, componentId: "core:missing" } } } },
    });
    assert.ok(missingComponent.issues.some((issue) => issue.code === "component.unregistered"));

    const unsupported = validatePlatformConfiguration({ ...input.platform, schemaVersion: 99 });
    assert.ok(unsupported.issues.some((issue) => issue.code === "schema.version.unsupported"));
  });

  it("enforces platform section-count limits", () => {
    const input = createValidationInput();
    const platform = { ...input.platform, securityLimits: { ...input.platform.securityLimits, maxSectionsPerPortfolio: 1 } };
    const result = validateConfiguration({ ...input, platform });
    assert.ok(result.issues.some((issue) => issue.code === "security.section-limit.exceeded"));
  });
});

describe("configuration defaults (TF-13)", () => {
  it("fills omitted fields from authoritative sources and reports unresolved required values", () => {
    const input: DefaultablePortfolioConfiguration = { portfolioId: "portfolio-defaults", title: "Defaulted" };
    const before = structuredClone(input);
    const result = applyConfigurationDefaults(input, {
      platform: platformConfig,
      profession: professionManifestCatalog["software-engineer"],
      profile: profileConfiguration,
      themes: { [themeConfiguration.themeId]: themeConfiguration },
      componentRegistry,
    });

    assert.equal(result.configuration.profileId, profileConfiguration.profileId);
    assert.equal(result.configuration.themeId, professionManifestCatalog["software-engineer"].defaultThemeId);
    assert.equal(result.configuration.colorMode, themeConfiguration.baseMode);
    assert.deepEqual(result.configuration.sectionOrder, professionManifestCatalog["software-engineer"].defaultSectionOrder);
    assert.ok(result.appliedDefaults.some((entry) => entry.path === "profileId" && entry.source === "profile"));
    assert.ok(result.appliedDefaults.some((entry) => entry.path === "sections.projects.componentConfig.props.showMetrics" && entry.source === "component-registry"));
    assert.equal(result.configuration.sections?.projects?.componentConfig?.props?.showMetrics, false);
    assert.ok(result.unresolvedPaths.includes("navigation.style"));
    assert.ok(result.unresolvedPaths.includes("footer.showSocials"));
    assert.deepEqual(input, before);
  });

  it("preserves explicit portfolio and nested section values while copying caller data", () => {
    const input: DefaultablePortfolioConfiguration = {
      portfolioId: "portfolio-explicit",
      title: "Explicit title",
      colorMode: "dark",
      sectionOrder: ["hero"],
      sections: { hero: { sectionId: "hero", enabled: false, title: "My heading" } },
      audit: { ...audit },
    };
    const originalOrder = input.sectionOrder;
    const result = applyConfigurationDefaults(input, {
      platform: platformConfig,
      profession: professionManifestCatalog["software-engineer"],
      profile: profileConfiguration,
      themes: { [themeConfiguration.themeId]: themeConfiguration },
      componentRegistry,
    });

    assert.equal(result.configuration.title, "Explicit title");
    assert.equal(result.configuration.colorMode, "dark");
    assert.equal(result.configuration.sections?.hero?.enabled, false);
    assert.equal(result.configuration.sections?.hero?.title, "My heading");
    assert.notEqual(result.configuration.sectionOrder, originalOrder);
    assert.deepEqual(input.sectionOrder, ["hero"]);
    assert.equal(result.configuration.audit?.version, 1);
  });
});

describe("configuration versioning (TF-14)", () => {
  it("reads and increments instance revisions without changing schemaVersion or the original", () => {
    const original = portfolioConfiguration;
    const before = structuredClone(original);
    const current = getConfigurationVersion(original);
    const next = createNextConfigurationVersion(original, "2026-03-04T05:06:07Z");

    assert.deepEqual(current, { ok: true, value: 1 });
    assert.equal(next.ok, true);
    if (!next.ok) return;
    assert.equal(next.value.audit.version, 2);
    assert.equal(next.value.audit.updatedAt, "2026-03-04T05:06:07Z");
    assert.equal(next.value.schemaVersion, original.schemaVersion);
    assert.deepEqual(original, before);
    assert.notEqual(next.value.sections.hero.componentConfig.props, original.sections.hero.componentConfig.props);
  });

  it("rejects invalid revision metadata and checks only supported schema compatibility", () => {
    assert.equal(isSupportedSchemaVersion(1), true);
    assert.equal(isSupportedSchemaVersion(2), false);
    assert.equal(areSchemaVersionsCompatible(1, 1), true);
    assert.equal(areSchemaVersionsCompatible(1, 2), false);
    assert.equal(areSchemaVersionsCompatible(2, 2), false);
    assert.deepEqual(getConfigurationVersion({ schemaVersion: 1, audit: { version: 0 } }), {
      ok: false,
      issue: { code: "audit-version.invalid", path: "audit.version", message: "Expected a positive safe integer configuration version." },
    });
    const invalidTimestamp = createNextConfigurationVersion(portfolioConfiguration, "not-a-timestamp");
    assert.equal(invalidTimestamp.ok, false);
    if (!invalidTimestamp.ok) assert.equal(invalidTimestamp.issue.code, "audit-updated-at.invalid");
  });
});

class TestPortfolioRepository implements ConfigurationRepository<PortfolioConfiguration> {
  private readonly documents = new Map<string, PortfolioConfiguration>();

  async create(identity: string, configuration: PortfolioConfiguration): Promise<ConfigurationPersistenceResult<PortfolioConfiguration>> {
    if (identity !== configuration.portfolioId) return { ok: false, issue: { code: "identity-mismatch", message: "ID mismatch." } };
    if (this.documents.has(identity)) return { ok: false, issue: { code: "already-exists", message: "Already exists." } };
    this.documents.set(identity, structuredClone(configuration));
    return { ok: true, value: structuredClone(configuration) };
  }

  async get(identity: string): Promise<ConfigurationPersistenceResult<PortfolioConfiguration>> {
    const configuration = this.documents.get(identity);
    return configuration === undefined
      ? { ok: false, issue: { code: "not-found", message: "Not found." } }
      : { ok: true, value: structuredClone(configuration) };
  }

  async exists(identity: string): Promise<ConfigurationPersistenceResult<boolean>> {
    return { ok: true, value: this.documents.has(identity) };
  }

  async update(identity: string, update: ConfigurationUpdate<PortfolioConfiguration>): Promise<ConfigurationPersistenceResult<PortfolioConfiguration>> {
    const stored = this.documents.get(identity);
    if (stored === undefined) return { ok: false, issue: { code: "not-found", message: "Not found." } };
    if (identity !== update.configuration.portfolioId) return { ok: false, issue: { code: "identity-mismatch", message: "ID mismatch." } };
    if (stored.audit.version !== update.expectedVersion) {
      return { ok: false, issue: { code: "version-conflict", message: "Stale version.", expectedVersion: update.expectedVersion, actualVersion: stored.audit.version } };
    }
    if (update.configuration.audit.version !== update.expectedVersion) return { ok: false, issue: { code: "invalid-version", message: "Proposed version must match expectedVersion." } };
    const next = createNextConfigurationVersion(update.configuration, update.updatedAt);
    if (!next.ok) return { ok: false, issue: { code: "invalid-version", message: next.issue.message } };
    this.documents.set(identity, structuredClone(next.value));
    return { ok: true, value: structuredClone(next.value) };
  }
}

describe("configuration persistence contract (TF-15)", () => {
  it("supports create, read, exists, and an optimistic update using TF-14", async () => {
    const repository = new TestPortfolioRepository();
    assert.deepEqual(await repository.exists(portfolioConfiguration.portfolioId), { ok: true, value: false });
    const missing = await repository.get(portfolioConfiguration.portfolioId);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.issue.code, "not-found");
    assert.equal((await repository.create(portfolioConfiguration.portfolioId, portfolioConfiguration)).ok, true);
    assert.deepEqual(await repository.exists(portfolioConfiguration.portfolioId), { ok: true, value: true });
    const read = await repository.get(portfolioConfiguration.portfolioId);
    assert.equal(read.ok, true);
    if (!read.ok) return;
    assert.equal(read.value.audit.version, 1);
    assert.equal(read.value.profileId, profileConfiguration.profileId);

    const updatedConfiguration = { ...read.value, title: "Updated portfolio" };
    const updated = await repository.update(read.value.portfolioId, {
      expectedVersion: 1,
      updatedAt: "2026-04-05T06:07:08Z",
      configuration: updatedConfiguration,
    });
    assert.equal(updated.ok, true);
    if (updated.ok) assert.equal(updated.value.audit.version, 2);
  });

  it("rejects duplicate and stale writes without replacing the newer revision", async () => {
    const repository = new TestPortfolioRepository();
    await repository.create(portfolioConfiguration.portfolioId, portfolioConfiguration);
    const duplicate = await repository.create(portfolioConfiguration.portfolioId, portfolioConfiguration);
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.issue.code, "already-exists");

    await repository.update(portfolioConfiguration.portfolioId, {
      expectedVersion: 1,
      updatedAt: "2026-04-05T06:07:08Z",
      configuration: { ...portfolioConfiguration, title: "Newer" },
    });
    const stale = await repository.update(portfolioConfiguration.portfolioId, {
      expectedVersion: 1,
      updatedAt: "2026-04-05T06:07:09Z",
      configuration: { ...portfolioConfiguration, title: "Stale overwrite" },
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.issue.code, "version-conflict");
      assert.equal(stale.issue.actualVersion, 2);
    }
    const stored = await repository.get(portfolioConfiguration.portfolioId);
    assert.equal(stored.ok, true);
    if (stored.ok) assert.equal(stored.value.title, "Newer");
  });
});

describe("configuration API contract (TF-16)", () => {
  it("represents typed create/get/update requests and success responses", () => {
    const createRequest: ConfigurationApiRequest<PortfolioConfiguration> = {
      contractVersion: 1,
      operation: "create",
      target: { kind: "portfolio", id: portfolioConfiguration.portfolioId },
      configuration: portfolioConfiguration,
    };
    const getRequest: ConfigurationApiRequest<PortfolioConfiguration> = {
      contractVersion: 1,
      operation: "get",
      target: { kind: "portfolio", id: portfolioConfiguration.portfolioId },
    };
    const updateRequest: ConfigurationApiRequest<PortfolioConfiguration> = {
      contractVersion: 1,
      operation: "update",
      target: { kind: "portfolio", id: portfolioConfiguration.portfolioId },
      expectedVersion: 1,
      updatedAt: "2026-05-06T07:08:09Z",
      configuration: portfolioConfiguration,
    };
    const success: ConfigurationApiResponse<PortfolioConfiguration> = {
      contractVersion: 1,
      ok: true,
      data: portfolioConfiguration,
    };

    assert.equal(createRequest.operation, "create");
    assert.equal(getRequest.operation, "get");
    assert.equal(updateRequest.expectedVersion, 1);
    assert.equal(success.ok, true);
  });

  it("preserves structured validation details and distinguishes conflict and schema errors", () => {
    const notFound: ConfigurationApiResponse<PortfolioConfiguration> = {
      contractVersion: 1,
      ok: false,
      error: { code: "not-found", message: "No portfolio was found." },
    };
    const validationFailure: ConfigurationApiResponse<PortfolioConfiguration> = {
      contractVersion: 1,
      ok: false,
      error: { code: "validation-failed", message: "Invalid portfolio.", issues: [{ severity: "error", code: "identifier.format", path: "portfolio.portfolioId", message: "Invalid ID." }] },
    };
    const conflict: ConfigurationApiResponse<PortfolioConfiguration> = {
      contractVersion: 1,
      ok: false,
      error: { code: "version-conflict", message: "Stale revision.", expectedVersion: 1, actualVersion: 2 },
    };
    const unsupported: ConfigurationApiResponse<PortfolioConfiguration> = {
      contractVersion: 1,
      ok: false,
      error: { code: "unsupported-schema-version", message: "Unsupported.", received: 2, supported: [1] },
    };
    const additionalErrors: ConfigurationApiError[] = [
      { code: "already-exists", message: "Already exists." },
      { code: "invalid-request", message: "Malformed request.", path: "configuration" },
      { code: "internal", message: "Unexpected failure." },
    ];

    assert.equal(validationFailure.ok, false);
    assert.equal(notFound.ok, false);
    if (!validationFailure.ok && validationFailure.error.code === "validation-failed") assert.equal(validationFailure.error.issues[0]?.code, "identifier.format");
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.error.code, "version-conflict");
    assert.equal(unsupported.ok, false);
    if (!unsupported.ok) assert.equal(unsupported.error.code, "unsupported-schema-version");
    assert.deepEqual(additionalErrors.map((error) => error.code), ["already-exists", "invalid-request", "internal"]);
  });
});
