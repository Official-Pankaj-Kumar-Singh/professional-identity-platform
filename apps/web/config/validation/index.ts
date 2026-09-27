/**
 * Pure validation for the declarative configuration contracts.
 * Validation reports problems and never changes the supplied data.
 */

import type { ComponentRegistry } from "../../registry";
import type { PlatformConfiguration } from "../platform";
import type { ProfessionManifest } from "../profession";
import type { ProfileConfiguration } from "../profile";
import type { PortfolioConfiguration } from "../portfolio";
import type { ThemeConfiguration } from "../theme";
import type { ValidationIssue, ValidationResult } from "./types";

export type { ValidationIssue, ValidationResult, ValidationSeverity } from "./types";

/** All selected source layers and the approved static component catalog. */
export interface ConfigurationValidationInput {
  platform: PlatformConfiguration;
  profession: ProfessionManifest;
  profile: ProfileConfiguration;
  theme: ThemeConfiguration;
  portfolio: PortfolioConfiguration;
  componentRegistry: ComponentRegistry;
}

const ENTITY_ID = /^[a-z0-9_-]{2,64}$/;
// The schema uses EntityId for component references while its examples use a
// namespace separator. Keep that established `core:...` form valid here.
const COMPONENT_ID = /^[a-z0-9_-]{2,64}:[a-z0-9_-]{2,64}$/;
const COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|oklch\([^{};]+\)|hsl\([^{};]+\))$/i;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isInteger = (value: unknown): value is number => Number.isSafeInteger(value);
const isNonEmpty = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const unique = (values: readonly unknown[]) => new Set(values).size === values.length;

class Collector {
  readonly issues: ValidationIssue[] = [];

  error(code: string, path: string, message: string): void {
    this.issues.push({ severity: "error", code, path, message });
  }

  result(): ValidationResult {
    return { valid: !this.issues.some((issue) => issue.severity === "error"), issues: this.issues };
  }
}

function checkRecord(value: unknown, path: string, out: Collector): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  out.error("object.required", path, "Expected an object.");
  return false;
}

function checkKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, out: Collector): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) out.error("schema.key.unexpected", `${path}.${key}`, "Unexpected property is not part of the configuration contract.");
  }
}

function checkId(value: unknown, path: string, out: Collector): void {
  if (!isString(value) || !ENTITY_ID.test(value)) out.error("identifier.format", path, "Expected an identifier matching ^[a-z0-9_-]{2,64}$.");
}

function checkComponentId(value: unknown, path: string, out: Collector): void {
  if (!isString(value) || !COMPONENT_ID.test(value)) out.error("component.identifier.format", path, "Expected a namespaced component identifier such as core:hero-minimal.");
}

function checkVersion(value: unknown, path: string, out: Collector): void {
  if (value !== 1) out.error("schema.version.unsupported", path, "Only schemaVersion 1 is supported.");
}

function checkBoolean(value: unknown, path: string, out: Collector): void {
  if (!isBoolean(value)) out.error("value.boolean", path, "Expected a boolean.");
}

function checkText(value: unknown, path: string, out: Collector): void {
  if (!isNonEmpty(value)) out.error("value.text.required", path, "Expected a non-empty string.");
}

function checkUnique(values: unknown[], path: string, out: Collector): void {
  if (!unique(values)) out.error("array.duplicate", path, "Values must be unique.");
}

function checkAudit(value: unknown, path: string, out: Collector): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["createdAt", "updatedAt", "version", "source"], path, out);
  for (const field of ["createdAt", "updatedAt"]) {
    const stamp = value[field];
    if (!isString(stamp) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(stamp) || Number.isNaN(Date.parse(stamp))) {
      out.error("audit.timestamp.invalid", `${path}.${field}`, "Expected an ISO 8601 UTC timestamp.");
    }
  }
  if (!isInteger(value.version) || (value.version as number) < 1) out.error("audit.version.invalid", `${path}.version`, "Expected a positive safe integer.");
  if (!["system", "user", "ai", "admin"].includes(String(value.source))) out.error("audit.source.invalid", `${path}.source`, "Expected system, user, ai, or admin.");
}

function checkUnsafeKeys(value: unknown, out: Collector, path = "$", ancestors = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      out.error("configuration.cycle", path, "Configuration must be acyclic JSON-compatible data.");
      return;
    }
    ancestors.add(value);
    value.forEach((item, index) => checkUnsafeKeys(item, out, `${path}[${index}]`, ancestors));
    ancestors.delete(value);
    return;
  }
  if (!isRecord(value)) return;
  if (ancestors.has(value)) {
    out.error("configuration.cycle", path, "Configuration must be acyclic JSON-compatible data.");
    return;
  }
  ancestors.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) out.error("security.prototype-key", `${path}.${key}`, "Prototype-related object keys are not permitted.");
    checkUnsafeKeys(child, out, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function checkLayout(value: unknown, path: string, out: Collector): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["containerWidth", "columns", "alignment", "paddingY"], path, out);
  if (!["full", "wide", "standard", "narrow"].includes(String(value.containerWidth))) out.error("layout.container-width.invalid", `${path}.containerWidth`, "Unsupported container width.");
  if (!["left", "center", "right"].includes(String(value.alignment))) out.error("layout.alignment.invalid", `${path}.alignment`, "Unsupported alignment.");
  if (!["compact", "normal", "spacious"].includes(String(value.paddingY))) out.error("layout.padding.invalid", `${path}.paddingY`, "Unsupported vertical padding.");
  const columns = value.columns;
  if (!checkRecord(columns, `${path}.columns`, out)) return;
  checkKeys(columns, ["mobile", "tablet", "desktop"], `${path}.columns`, out);
  if (columns.mobile !== 1) out.error("layout.columns.mobile.invalid", `${path}.columns.mobile`, "Mobile columns must equal 1.");
  if (![1, 2].includes(Number(columns.tablet))) out.error("layout.columns.tablet.invalid", `${path}.columns.tablet`, "Tablet columns must be 1 or 2.");
  if (![1, 2, 3, 4].includes(Number(columns.desktop))) out.error("layout.columns.desktop.invalid", `${path}.columns.desktop`, "Desktop columns must be between 1 and 4.");
}

function checkComponent(value: unknown, path: string, out: Collector): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["componentId", "variant", "props", "styles", "responsive"], path, out);
  checkComponentId(value.componentId, `${path}.componentId`, out);
  checkText(value.variant, `${path}.variant`, out);
  const props = value.props;
  if (!checkRecord(props, `${path}.props`, out)) return;
  for (const [name, prop] of Object.entries(props)) {
    if (!(typeof prop === "string" || typeof prop === "number" && Number.isFinite(prop) || typeof prop === "boolean" || Array.isArray(prop) && prop.every(isString))) {
      out.error("component.prop.type.invalid", `${path}.props.${name}`, "Props must be strings, finite numbers, booleans, or arrays of strings.");
    }
  }
  checkStyles(value.styles, `${path}.styles`, out);
  if (!checkRecord(value.responsive, `${path}.responsive`, out)) return;
  for (const flag of ["hideOnMobile", "collapseOnMobile"]) {
    if (value.responsive[flag] !== undefined) checkBoolean(value.responsive[flag], `${path}.responsive.${flag}`, out);
  }
}

function checkStyles(value: unknown, path: string, out: Collector): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["density", "elevation", "borderStyle", "accentHighlight", "customClassModifiers"], path, out);
  if (!["compact", "comfortable", "spacious"].includes(String(value.density))) out.error("component.style.density.invalid", `${path}.density`, "Unsupported density value.");
  if (!["none", "subtle", "medium", "prominent"].includes(String(value.elevation))) out.error("component.style.elevation.invalid", `${path}.elevation`, "Unsupported elevation value.");
  if (!["none", "subtle", "prominent"].includes(String(value.borderStyle))) out.error("component.style.border.invalid", `${path}.borderStyle`, "Unsupported border style.");
  checkBoolean(value.accentHighlight, `${path}.accentHighlight`, out);
  if (value.customClassModifiers !== undefined) {
    if (!Array.isArray(value.customClassModifiers) || !value.customClassModifiers.every((item) => isString(item) && /^[a-z0-9_-]{1,48}$/.test(item))) {
      out.error("component.style.modifier.invalid", `${path}.customClassModifiers`, "Modifiers must be safe, whitelisted-token-compatible strings.");
    }
  }
}

function checkSection(value: unknown, path: string, out: Collector): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["sectionId", "type", "enabled", "title", "subtitle", "variant", "layout", "filter", "componentConfig"], path, out);
  checkId(value.sectionId, `${path}.sectionId`, out);
  checkText(value.type, `${path}.type`, out);
  checkBoolean(value.enabled, `${path}.enabled`, out);
  if (value.title !== undefined) checkText(value.title, `${path}.title`, out);
  if (value.subtitle !== undefined && !isString(value.subtitle)) out.error("section.subtitle.invalid", `${path}.subtitle`, "Subtitle must be a string.");
  checkText(value.variant, `${path}.variant`, out);
  checkLayout(value.layout, `${path}.layout`, out);
  if (value.filter !== undefined) {
    const filter = value.filter;
    if (!checkRecord(filter, `${path}.filter`, out)) return;
    checkKeys(filter, ["tagFilter", "featuredOnly", "maxItems", "sortBy"], `${path}.filter`, out);
    if (filter.tagFilter !== undefined && (!Array.isArray(filter.tagFilter) || !filter.tagFilter.every(isString))) out.error("section.filter.tags.invalid", `${path}.filter.tagFilter`, "tagFilter must be an array of strings.");
    if (filter.featuredOnly !== undefined) checkBoolean(filter.featuredOnly, `${path}.filter.featuredOnly`, out);
    if (filter.maxItems !== undefined && (!isInteger(filter.maxItems) || (filter.maxItems as number) < 1)) out.error("section.filter.max-items.invalid", `${path}.filter.maxItems`, "maxItems must be a positive safe integer.");
    if (filter.sortBy !== undefined && !["chronological-desc", "chronological-asc", "priority", "manual"].includes(String(filter.sortBy))) out.error("section.filter.sort.invalid", `${path}.filter.sortBy`, "Unsupported section sort order.");
  }
  checkComponent(value.componentConfig, `${path}.componentConfig`, out);
}

function checkColor(value: unknown, path: string, out: Collector): void {
  if (!isString(value) || !COLOR.test(value) || /[;{}]|javascript:/i.test(value)) out.error("theme.color.invalid", path, "Color must be a hexadecimal, OKLCH, or HSL value without executable CSS syntax.");
}

function checkThemeTokens(value: unknown, path: string, out: Collector, partial = false): void {
  if (!checkRecord(value, path, out)) return;
  checkKeys(value, ["colors", "typography", "spacing", "radii", "shadows", "transitions"], path, out);
  const requiredColors = ["background", "surface", "surfaceSubtle", "surfaceElevated", "textPrimary", "textSecondary", "textMuted", "accent", "accentHover", "accentContrast", "border", "borderSubtle", "success", "warning", "error"];
  const colors = value.colors;
  if (colors !== undefined || !partial) {
    if (checkRecord(colors, `${path}.colors`, out)) {
      checkKeys(colors, requiredColors, `${path}.colors`, out);
      for (const name of requiredColors) if (!(name in colors)) out.error("theme.color.required", `${path}.colors.${name}`, "Required semantic color token is missing.");
      for (const [name, color] of Object.entries(colors)) checkColor(color, `${path}.colors.${name}`, out);
    }
  }
  for (const block of ["typography", "spacing", "radii", "shadows", "transitions"]) {
    if (value[block] === undefined && partial) continue;
    if (!checkRecord(value[block], `${path}.${block}`, out)) continue;
    const required = block === "typography" ? ["fonts", "scale", "weights", "lineHeights"]
      : block === "spacing" ? ["unit", "containerMaxWidth", "sectionPaddingY"]
        : block === "radii" ? ["none", "sm", "md", "lg", "full"]
          : block === "shadows" ? ["none", "subtle", "medium", "prominent"]
            : ["fast", "normal"];
    checkKeys(value[block] as Record<string, unknown>, required, `${path}.${block}`, out);
    for (const name of required) if (!(name in (value[block] as Record<string, unknown>))) out.error("theme.token.required", `${path}.${block}.${name}`, "Required theme token is missing.");
    if (block === "typography") {
      const typography = value.typography as Record<string, unknown>;
      if (checkRecord(typography.fonts, `${path}.typography.fonts`, out)) {
        checkKeys(typography.fonts, ["heading", "body", "mono"], `${path}.typography.fonts`, out);
        for (const name of ["heading", "body"]) if (!isNonEmpty(typography.fonts[name])) out.error("theme.font.required", `${path}.typography.fonts.${name}`, "Required font stack is missing.");
      }
      const tokenKeys: Record<string, readonly string[]> = {
        scale: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"],
        weights: ["regular", "medium", "semibold", "bold"],
        lineHeights: ["tight", "normal", "relaxed"],
      };
      for (const group of Object.keys(tokenKeys)) {
        if (!checkRecord(typography[group], `${path}.typography.${group}`, out)) continue;
        checkKeys(typography[group] as Record<string, unknown>, tokenKeys[group], `${path}.typography.${group}`, out);
        for (const name of tokenKeys[group]) if (!(name in (typography[group] as Record<string, unknown>))) out.error("theme.token.required", `${path}.typography.${group}.${name}`, "Required typography token is missing.");
      }
    }
    const inspectStrings = (item: unknown, itemPath: string): void => {
      if (typeof item === "string") {
        if (!isNonEmpty(item) || /[;{}]|javascript:/i.test(item)) out.error("theme.token.unsafe", itemPath, "Token values must be non-empty and free of executable CSS syntax.");
      } else if (typeof item === "number") {
        if (!Number.isFinite(item)) out.error("theme.token.number.invalid", itemPath, "Token numbers must be finite.");
      } else if (isRecord(item)) Object.entries(item).forEach(([key, child]) => inspectStrings(child, `${itemPath}.${key}`));
    };
    inspectStrings(value[block], `${path}.${block}`);
  }
}

function checkUrl(value: unknown, allowed: readonly string[], path: string, out: Collector): void {
  if (!isString(value) || !isNonEmpty(value)) {
    out.error("url.invalid", path, "Expected a non-empty URL.");
    return;
  }
  try {
    const url = new URL(value);
    if (!allowed.includes(url.protocol)) out.error("url.protocol.disallowed", path, `Protocol ${url.protocol} is not allowed by platform securityLimits.`);
  } catch {
    out.error("url.invalid", path, "Expected a parseable absolute URL.");
  }
}

function checkPlatform(value: unknown, out: Collector): boolean {
  if (!checkRecord(value, "platform", out)) return false;
  const issueStart = out.issues.length;
  checkKeys(value, ["schemaVersion", "platformId", "metadata", "supportedProfessions", "supportedSectionTypes", "defaultThemeId", "supportedThemes", "securityLimits", "defaultComponentMappings"], "platform", out);
  checkVersion(value.schemaVersion, "platform.schemaVersion", out);
  checkId(value.platformId, "platform.platformId", out);
  if (!checkRecord(value.metadata, "platform.metadata", out)) return false;
  checkKeys(value.metadata, ["name", "version"], "platform.metadata", out);
  checkText(value.metadata.name, "platform.metadata.name", out);
  checkText(value.metadata.version, "platform.metadata.version", out);
  for (const listKey of ["supportedProfessions", "supportedThemes"] as const) {
    const list = value[listKey];
    if (!Array.isArray(list)) out.error("platform.catalog.invalid", `platform.${listKey}`, "Expected an array of identifiers.");
    else {
      list.forEach((id, index) => checkId(id, `platform.${listKey}[${index}]`, out));
      checkUnique(list, `platform.${listKey}`, out);
    }
  }
  checkId(value.defaultThemeId, "platform.defaultThemeId", out);
  if (Array.isArray(value.supportedThemes) && !value.supportedThemes.includes(value.defaultThemeId)) out.error("platform.default-theme.unsupported", "platform.defaultThemeId", "The default theme must be listed in supportedThemes.");
  if (!Array.isArray(value.supportedSectionTypes) || value.supportedSectionTypes.length === 0) out.error("platform.section-types.empty", "platform.supportedSectionTypes", "At least one section type is required.");
  else {
    const seen = new Set<string>();
    value.supportedSectionTypes.forEach((raw, index) => {
      const path = `platform.supportedSectionTypes[${index}]`;
      if (!checkRecord(raw, path, out)) return;
      checkKeys(raw, ["type", "label", "description", "allowedVariants", "defaultVariant", "isSingleton", "defaultLayout"], path, out);
      checkId(raw.type, `${path}.type`, out);
      checkText(raw.label, `${path}.label`, out);
      checkText(raw.description, `${path}.description`, out);
      if (isString(raw.type)) {
        if (seen.has(raw.type)) out.error("platform.section-type.duplicate", `${path}.type`, "Section type names must be unique.");
        seen.add(raw.type);
      }
      if (!Array.isArray(raw.allowedVariants) || raw.allowedVariants.length === 0) out.error("platform.variants.empty", `${path}.allowedVariants`, "At least one variant is required.");
      else {
        raw.allowedVariants.forEach((variant, variantIndex) => checkText(variant, `${path}.allowedVariants[${variantIndex}]`, out));
        checkUnique(raw.allowedVariants, `${path}.allowedVariants`, out);
        if (!raw.allowedVariants.includes(raw.defaultVariant)) out.error("platform.default-variant.unsupported", `${path}.defaultVariant`, "The default variant must be in allowedVariants.");
      }
      checkBoolean(raw.isSingleton, `${path}.isSingleton`, out);
      checkLayout(raw.defaultLayout, `${path}.defaultLayout`, out);
    });
  }
  if (!checkRecord(value.securityLimits, "platform.securityLimits", out)) return false;
  checkKeys(value.securityLimits, ["maxSectionsPerPortfolio", "maxCustomLinks", "maxPayloadSizeBytes", "allowedUrlProtocols"], "platform.securityLimits", out);
  for (const limit of ["maxSectionsPerPortfolio", "maxCustomLinks", "maxPayloadSizeBytes"]) {
    const number = value.securityLimits[limit];
    if (!isInteger(number) || (number as number) < 1) out.error("platform.security-limit.invalid", `platform.securityLimits.${limit}`, "Security limits must be positive safe integers.");
  }
  const protocols = value.securityLimits.allowedUrlProtocols;
  const accepted = ["http:", "https:", "mailto:", "tel:"];
  if (!Array.isArray(protocols) || protocols.length === 0 || protocols.some((protocol) => !accepted.includes(String(protocol)))) out.error("platform.security-protocol.invalid", "platform.securityLimits.allowedUrlProtocols", "Allowed URL protocols must be a non-empty subset of http:, https:, mailto:, and tel:.");
  else checkUnique(protocols, "platform.securityLimits.allowedUrlProtocols", out);
  if (!checkRecord(value.defaultComponentMappings, "platform.defaultComponentMappings", out)) return false;
  for (const [type, componentId] of Object.entries(value.defaultComponentMappings)) {
    checkId(type, `platform.defaultComponentMappings.${type}`, out);
    checkComponentId(componentId, `platform.defaultComponentMappings.${type}`, out);
    if (Array.isArray(value.supportedSectionTypes) && !value.supportedSectionTypes.some((section) => isRecord(section) && section.type === type)) out.error("platform.mapping.unknown-section", `platform.defaultComponentMappings.${type}`, "Mapping key must reference a supported section type.");
  }
  return !out.issues.slice(issueStart).some((issue) => issue.severity === "error");
}

function checkProfession(value: unknown, platform: PlatformConfiguration, out: Collector): boolean {
  if (!checkRecord(value, "profession", out)) return false;
  const issueStart = out.issues.length;
  checkKeys(value, ["schemaVersion", "professionId", "displayName", "category", "description", "recommendedThemes", "defaultThemeId", "defaultSectionOrder", "availableSections", "vocabulary", "highlightedAttributes", "seoDefaults"], "profession", out);
  checkVersion(value.schemaVersion, "profession.schemaVersion", out);
  checkId(value.professionId, "profession.professionId", out);
  if (!platform.supportedProfessions.includes(value.professionId as string)) out.error("profession.unsupported", "profession.professionId", "Profession ID is not in platform.supportedProfessions.");
  for (const name of ["displayName", "category", "description"]) checkText(value[name], `profession.${name}`, out);
  if (!Array.isArray(value.recommendedThemes)) out.error("profession.themes.invalid", "profession.recommendedThemes", "Expected an array of theme IDs.");
  else {
    value.recommendedThemes.forEach((id, i) => {
      checkId(id, `profession.recommendedThemes[${i}]`, out);
      if (!platform.supportedThemes.includes(id as string)) out.error("profession.theme.unsupported", `profession.recommendedThemes[${i}]`, "Theme is not supported by the platform.");
    });
    checkUnique(value.recommendedThemes, "profession.recommendedThemes", out);
  }
  checkId(value.defaultThemeId, "profession.defaultThemeId", out);
  if (!platform.supportedThemes.includes(value.defaultThemeId as string)) out.error("profession.default-theme.unsupported", "profession.defaultThemeId", "Default theme is not supported by the platform.");
  if (Array.isArray(value.recommendedThemes) && !value.recommendedThemes.includes(value.defaultThemeId)) out.error("profession.default-theme.not-recommended", "profession.defaultThemeId", "Default theme must also be recommended.");
  if (!Array.isArray(value.availableSections)) out.error("profession.sections.invalid", "profession.availableSections", "Expected available section descriptors.");
  else {
    const ids: unknown[] = [];
    value.availableSections.forEach((section, i) => {
      const path = `profession.availableSections[${i}]`;
      if (!checkRecord(section, path, out)) return;
      checkId(section.sectionId, `${path}.sectionId`, out);
      ids.push(section.sectionId);
      checkText(section.titleDefault, `${path}.titleDefault`, out);
      checkBoolean(section.isRequired, `${path}.isRequired`, out);
      checkBoolean(section.defaultEnabled, `${path}.defaultEnabled`, out);
      if (section.isRequired === true && section.defaultEnabled !== true) out.error("profession.required-section.disabled", `${path}.defaultEnabled`, "Required sections must be enabled by default.");
      const descriptor = platform.supportedSectionTypes.find((candidate) => candidate.type === section.type);
      if (!descriptor) out.error("profession.section-type.unsupported", `${path}.type`, "Section type is not supported by the platform.");
      else if (!descriptor.allowedVariants.includes(section.defaultVariant as string)) out.error("profession.section-variant.unsupported", `${path}.defaultVariant`, "Default variant is not allowed for this section type.");
    });
    checkUnique(ids, "profession.availableSections", out);
    if (!Array.isArray(value.defaultSectionOrder)) out.error("profession.section-order.invalid", "profession.defaultSectionOrder", "Expected an array of available section IDs.");
    else {
      checkUnique(value.defaultSectionOrder, "profession.defaultSectionOrder", out);
      const defaultSectionOrder = value.defaultSectionOrder;
      defaultSectionOrder.forEach((id, i) => {
        if (!ids.includes(id)) out.error("profession.section-order.unresolved", `profession.defaultSectionOrder[${i}]`, "Default order entry must reference an available section.");
      });
      if (Array.isArray(value.availableSections)) value.availableSections.forEach((section, i) => {
        if (isRecord(section) && section.isRequired === true && !defaultSectionOrder.includes(section.sectionId)) out.error("profession.required-section.omitted", `profession.availableSections[${i}].sectionId`, "Required sections must be included in the default order.");
      });
    }
  }
  if (!checkRecord(value.vocabulary, "profession.vocabulary", out)) return false;
  for (const field of ["experienceSectionTitle", "projectsSectionTitle", "credentialsSectionTitle", "skillsSectionTitle", "publicationsSectionTitle", "heroRoleLabel"]) checkText(value.vocabulary[field], `profession.vocabulary.${field}`, out);
  if (!Array.isArray(value.highlightedAttributes) || !value.highlightedAttributes.every(isNonEmpty)) out.error("profession.attributes.invalid", "profession.highlightedAttributes", "Expected an array of non-empty attribute names.");
  if (!checkRecord(value.seoDefaults, "profession.seoDefaults", out)) return false;
  checkText(value.seoDefaults.titleTemplate, "profession.seoDefaults.titleTemplate", out);
  if (!Array.isArray(value.seoDefaults.defaultKeywords) || !value.seoDefaults.defaultKeywords.every(isNonEmpty)) out.error("profession.seo.keywords.invalid", "profession.seoDefaults.defaultKeywords", "Expected an array of non-empty keywords.");
  return !out.issues.slice(issueStart).some((issue) => issue.severity === "error");
}

function checkProfile(value: unknown, platform: PlatformConfiguration, out: Collector): boolean {
  if (!checkRecord(value, "profile", out)) return false;
  const issueStart = out.issues.length;
  checkKeys(value, ["schemaVersion", "profileId", "userId", "primaryProfessionId", "secondaryProfessionIds", "slug", "customDomain", "locale", "status", "visibility", "socialLinks", "audit"], "profile", out);
  checkVersion(value.schemaVersion, "profile.schemaVersion", out);
  for (const id of ["profileId", "userId", "primaryProfessionId"]) checkId(value[id], `profile.${id}`, out);
  if (!platform.supportedProfessions.includes(value.primaryProfessionId as string)) out.error("profile.profession.unresolved", "profile.primaryProfessionId", "Primary profession is not supported by the platform.");
  if (value.secondaryProfessionIds !== undefined) {
    if (!Array.isArray(value.secondaryProfessionIds)) out.error("profile.secondary-professions.invalid", "profile.secondaryProfessionIds", "Expected an array of profession IDs.");
    else {
      value.secondaryProfessionIds.forEach((id, i) => {
        checkId(id, `profile.secondaryProfessionIds[${i}]`, out);
        if (!platform.supportedProfessions.includes(id as string)) out.error("profile.profession.unresolved", `profile.secondaryProfessionIds[${i}]`, "Secondary profession is not supported by the platform.");
      });
      checkUnique(value.secondaryProfessionIds, "profile.secondaryProfessionIds", out);
      if (value.secondaryProfessionIds.includes(value.primaryProfessionId)) out.error("profile.profession.duplicate", "profile.secondaryProfessionIds", "Primary profession must not be repeated as a secondary profession.");
    }
  }
  checkText(value.slug, "profile.slug", out);
  checkText(value.locale, "profile.locale", out);
  if (!["draft", "published", "archived"].includes(String(value.status))) out.error("profile.status.invalid", "profile.status", "Unsupported profile status.");
  if (value.customDomain !== undefined && (!isString(value.customDomain) || /[\s/:]/.test(value.customDomain))) out.error("profile.domain.invalid", "profile.customDomain", "Custom domain must be a hostname, not a URL.");
  if (!checkRecord(value.visibility, "profile.visibility", out)) return false;
  checkKeys(value.visibility, ["isPublic", "showContactEmail", "showPhoneNumber", "showLocation", "allowSearchIndexing"], "profile.visibility", out);
  for (const flag of ["isPublic", "showContactEmail", "showPhoneNumber", "showLocation", "allowSearchIndexing"]) checkBoolean(value.visibility[flag], `profile.visibility.${flag}`, out);
  if (value.visibility.allowSearchIndexing === true && value.visibility.isPublic !== true) out.error("profile.visibility.incoherent", "profile.visibility.allowSearchIndexing", "Search indexing requires a public profile.");
  if (!Array.isArray(value.socialLinks)) out.error("profile.social-links.invalid", "profile.socialLinks", "Expected an array of social links.");
  else value.socialLinks.forEach((link, i) => {
    const path = `profile.socialLinks[${i}]`;
    if (!checkRecord(link, path, out)) return;
    checkKeys(link, ["platform", "url", "label", "visible"], path, out);
    if (!["github", "linkedin", "x", "orcid", "dribbble", "website", "other"].includes(String(link.platform))) out.error("profile.social-platform.invalid", `${path}.platform`, "Unsupported social-link platform.");
    checkUrl(link.url, platform.securityLimits.allowedUrlProtocols, `${path}.url`, out);
    checkText(link.label, `${path}.label`, out);
    checkBoolean(link.visible, `${path}.visible`, out);
  });
  checkAudit(value.audit, "profile.audit", out);
  return !out.issues.slice(issueStart).some((issue) => issue.severity === "error");
}

function checkTheme(value: unknown, platform: PlatformConfiguration, out: Collector): boolean {
  if (!checkRecord(value, "theme", out)) return false;
  const issueStart = out.issues.length;
  checkKeys(value, ["schemaVersion", "themeId", "displayName", "author", "baseMode", "tokens", "componentDefaults", "audit"], "theme", out);
  checkVersion(value.schemaVersion, "theme.schemaVersion", out);
  checkId(value.themeId, "theme.themeId", out);
  if (!platform.supportedThemes.includes(value.themeId as string)) out.error("theme.unsupported", "theme.themeId", "Theme ID is not listed in platform.supportedThemes.");
  checkText(value.displayName, "theme.displayName", out);
  if (!["platform", "profession", "user"].includes(String(value.author))) out.error("theme.author.invalid", "theme.author", "Unsupported theme author.");
  if (!["light", "dark", "system"].includes(String(value.baseMode))) out.error("theme.mode.invalid", "theme.baseMode", "Unsupported theme base mode.");
  if (!checkRecord(value.tokens, "theme.tokens", out)) return false;
  checkThemeTokens(value.tokens.light, "theme.tokens.light", out);
  if (value.tokens.dark !== undefined) checkThemeTokens(value.tokens.dark, "theme.tokens.dark", out, true);
  if (value.componentDefaults !== undefined) {
    if (!checkRecord(value.componentDefaults, "theme.componentDefaults", out)) return false;
    for (const [id, style] of Object.entries(value.componentDefaults)) {
      checkComponentId(id, `theme.componentDefaults.${id}`, out);
      if (!isRecord(style)) out.error("theme.component-default.invalid", `theme.componentDefaults.${id}`, "Expected partial component style settings.");
      else checkStyles({ density: "comfortable", elevation: "none", borderStyle: "none", accentHighlight: false, ...style }, `theme.componentDefaults.${id}`, out);
    }
  }
  checkAudit(value.audit, "theme.audit", out);
  return !out.issues.slice(issueStart).some((issue) => issue.severity === "error");
}

function checkPortfolio(value: unknown, input: ConfigurationValidationInput, out: Collector): value is PortfolioConfiguration {
  const { platform, profession, profile, theme, componentRegistry } = input;
  if (!checkRecord(value, "portfolio", out)) return false;
  const issueStart = out.issues.length;
  checkKeys(value, ["schemaVersion", "portfolioId", "profileId", "title", "themeId", "colorMode", "navigation", "sectionOrder", "sections", "footer", "seo", "audit"], "portfolio", out);
  checkVersion(value.schemaVersion, "portfolio.schemaVersion", out);
  checkId(value.portfolioId, "portfolio.portfolioId", out);
  checkId(value.profileId, "portfolio.profileId", out);
  if (value.profileId !== profile.profileId) out.error("portfolio.profile.unresolved", "portfolio.profileId", "Portfolio profileId must match the selected profile.");
  checkText(value.title, "portfolio.title", out);
  checkId(value.themeId, "portfolio.themeId", out);
  if (!platform.supportedThemes.includes(value.themeId as string)) out.error("portfolio.theme.unsupported", "portfolio.themeId", "Theme ID is not supported by the platform.");
  if (value.themeId !== theme.themeId) out.error("portfolio.theme.unresolved", "portfolio.themeId", "Portfolio themeId must match the supplied theme configuration.");
  if (!["light", "dark", "system"].includes(String(value.colorMode))) out.error("portfolio.color-mode.invalid", "portfolio.colorMode", "Unsupported color mode.");
  if (!checkRecord(value.navigation, "portfolio.navigation", out)) return false;
  checkKeys(value.navigation, ["style", "sticky", "showContactAction", "customLinks"], "portfolio.navigation", out);
  if (!["top-bar", "floating", "sidebar", "minimal", "none"].includes(String(value.navigation.style))) out.error("portfolio.navigation.style.invalid", "portfolio.navigation.style", "Unsupported navigation style.");
  checkBoolean(value.navigation.sticky, "portfolio.navigation.sticky", out);
  checkBoolean(value.navigation.showContactAction, "portfolio.navigation.showContactAction", out);
  if (value.navigation.customLinks !== undefined) {
    if (!Array.isArray(value.navigation.customLinks)) out.error("portfolio.navigation.links.invalid", "portfolio.navigation.customLinks", "Expected an array of custom links.");
    else {
      if (value.navigation.customLinks.length > platform.securityLimits.maxCustomLinks) out.error("security.custom-link-limit.exceeded", "portfolio.navigation.customLinks", "Custom-link count exceeds the platform limit.");
      value.navigation.customLinks.forEach((link, i) => {
        const path = `portfolio.navigation.customLinks[${i}]`;
        if (!checkRecord(link, path, out)) return;
        checkKeys(link, ["label", "targetSectionId", "visible"], path, out);
        checkText(link.label, `${path}.label`, out);
        checkId(link.targetSectionId, `${path}.targetSectionId`, out);
        checkBoolean(link.visible, `${path}.visible`, out);
        if (!isRecord(value.sections) || !Object.values(value.sections).some((section) => isRecord(section) && section.sectionId === link.targetSectionId)) {
          out.error("portfolio.navigation.target.unresolved", `${path}.targetSectionId`, "Navigation target must reference a configured section.");
        }
      });
    }
  }
  if (!checkRecord(value.sections, "portfolio.sections", out)) return false;
  const sectionEntries = Object.entries(value.sections);
  if (sectionEntries.length > platform.securityLimits.maxSectionsPerPortfolio) out.error("security.section-limit.exceeded", "portfolio.sections", "Section count exceeds the platform limit.");
  const ids = new Set<string>();
  const singletonTypes = new Set<string>();
  for (const [key, raw] of sectionEntries) {
    const path = `portfolio.sections.${key}`;
    checkSection(raw, path, out);
    if (!isRecord(raw)) continue;
    if (key !== raw.sectionId) out.error("portfolio.section-key.mismatch", `${path}.sectionId`, "Section record key must equal sectionId.");
    if (isString(raw.sectionId)) {
      if (ids.has(raw.sectionId)) out.error("portfolio.section.duplicate", `${path}.sectionId`, "Section IDs must be unique.");
      ids.add(raw.sectionId);
    }
    const descriptor = platform.supportedSectionTypes.find((item) => item.type === raw.type);
    if (!descriptor) out.error("portfolio.section-type.unsupported", `${path}.type`, "Section type is not supported by the platform.");
    else {
      if (!descriptor.allowedVariants.includes(raw.variant as string)) out.error("portfolio.section-variant.unsupported", `${path}.variant`, "Variant is not allowed for this section type.");
      if (descriptor.isSingleton && singletonTypes.has(descriptor.type)) out.error("portfolio.section.singleton-duplicate", `${path}.type`, "A singleton section type may only appear once.");
      if (descriptor.isSingleton) singletonTypes.add(descriptor.type);
    }
    if (isRecord(raw.componentConfig)) {
      const componentId = raw.componentConfig.componentId;
      const registered = isString(componentId) ? componentRegistry[componentId] : undefined;
      if (!registered) out.error("component.unregistered", `${path}.componentConfig.componentId`, "Component ID is not present in the supplied approved registry.");
      else {
        if (registered.componentId !== componentId) out.error("component.registry-key.mismatch", `${path}.componentConfig.componentId`, "Registry entry key and componentId must match.");
        if (registered.sectionType !== raw.type) out.error("component.section-type.mismatch", `${path}.componentConfig.componentId`, "Registered component section type does not match the section.");
        if (registered.variant !== raw.componentConfig.variant || registered.variant !== raw.variant) out.error("component.variant.mismatch", `${path}.componentConfig.variant`, "Section and registered component variants must match.");
      }
    }
  }
  if (!Array.isArray(value.sectionOrder)) out.error("portfolio.section-order.invalid", "portfolio.sectionOrder", "Expected an array of section IDs.");
  else {
    checkUnique(value.sectionOrder, "portfolio.sectionOrder", out);
    value.sectionOrder.forEach((id, i) => {
      if (!ids.has(String(id))) out.error("portfolio.section-order.unresolved", `portfolio.sectionOrder[${i}]`, "Section order entry must reference a section in sections.");
    });
    for (const id of ids) if (!value.sectionOrder.includes(id)) out.error("portfolio.section-order.omitted", "portfolio.sectionOrder", `Section ${id} is missing from sectionOrder.`);
  }
  for (const required of profession.availableSections.filter((section) => section.isRequired)) {
    const configured = sectionEntries.map(([, section]) => section).find((section) => isRecord(section) && section.sectionId === required.sectionId);
    if (!configured) out.error("portfolio.required-section.missing", "portfolio.sections", `Required profession section ${required.sectionId} is missing.`);
    else if (isRecord(configured) && configured.enabled !== true) out.error("portfolio.required-section.disabled", `portfolio.sections.${required.sectionId}.enabled`, "Required profession sections must remain enabled.");
  }
  if (!checkRecord(value.footer, "portfolio.footer", out)) return false;
  checkKeys(value.footer, ["showSocials", "showBackToTop", "customCopyrightNotice", "showPoweredBy"], "portfolio.footer", out);
  for (const flag of ["showSocials", "showBackToTop", "showPoweredBy"]) checkBoolean(value.footer[flag], `portfolio.footer.${flag}`, out);
  if (value.footer.customCopyrightNotice !== undefined && !isString(value.footer.customCopyrightNotice)) out.error("portfolio.footer.copyright.invalid", "portfolio.footer.customCopyrightNotice", "Copyright notice must be a string.");
  if (!checkRecord(value.seo, "portfolio.seo", out)) return false;
  checkKeys(value.seo, ["metaTitle", "metaDescription", "ogImage", "noIndex"], "portfolio.seo", out);
  for (const field of ["metaTitle", "metaDescription"]) if (value.seo[field] !== undefined && !isString(value.seo[field])) out.error("portfolio.seo.text.invalid", `portfolio.seo.${field}`, "SEO text must be a string.");
  if (value.seo.ogImage !== undefined) checkUrl(value.seo.ogImage, platform.securityLimits.allowedUrlProtocols, "portfolio.seo.ogImage", out);
  if (value.seo.noIndex !== undefined) checkBoolean(value.seo.noIndex, "portfolio.seo.noIndex", out);
  checkAudit(value.audit, "portfolio.audit", out);
  return !out.issues.slice(issueStart).some((issue) => issue.severity === "error");
}

function checkPayloadSize(input: ConfigurationValidationInput, out: Collector): void {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify({
      profession: input.profession,
      profile: input.profile,
      theme: input.theme,
      portfolio: input.portfolio,
    })).byteLength;
    if (bytes > input.platform.securityLimits.maxPayloadSizeBytes) out.error("security.payload-limit.exceeded", "$", `Selected source configuration is ${bytes} bytes and exceeds maxPayloadSizeBytes.`);
  } catch {
    out.error("security.payload.not-serializable", "$", "Selected source configuration must be serializable JSON data.");
  }
}

/** Validate one selected platform configuration. */
export function validatePlatformConfiguration(value: unknown): ValidationResult {
  const out = new Collector();
  checkUnsafeKeys(value, out, "platform");
  checkPlatform(value, out);
  return out.result();
}

/** Validate one complete, selected set of configuration layers and references. */
export function validateConfiguration(input: ConfigurationValidationInput): ValidationResult {
  const out = new Collector();
  checkUnsafeKeys(input, out);
  if (!isRecord(input)) {
    out.error("configuration.input.invalid", "$", "Expected a configuration validation input object.");
    return out.result();
  }
  const validPlatform = checkPlatform(input.platform, out);
  if (!validPlatform) return out.result();
  const platform = input.platform;
  const validProfession = checkProfession(input.profession, platform, out);
  const validProfile = checkProfile(input.profile, platform, out);
  const validTheme = checkTheme(input.theme, platform, out);
  if (validProfession && validProfile && input.profile.primaryProfessionId !== input.profession.professionId) out.error("configuration.profession.mismatch", "profile.primaryProfessionId", "Selected profession must match the profile primary profession.");
  if (validProfession && validProfile && validTheme && isRecord(input.portfolio) && isRecord(input.componentRegistry)) {
    checkPortfolio(input.portfolio, { platform, profession: input.profession, profile: input.profile, theme: input.theme, portfolio: input.portfolio as PortfolioConfiguration, componentRegistry: input.componentRegistry }, out);
    checkPayloadSize({ platform, profession: input.profession, profile: input.profile, theme: input.theme, portfolio: input.portfolio as PortfolioConfiguration, componentRegistry: input.componentRegistry }, out);
  }
  if (!isRecord(input.componentRegistry)) {
    out.error("component.registry.invalid", "componentRegistry", "Expected the approved component registry object.");
  } else {
    for (const [registryKey, descriptor] of Object.entries(input.componentRegistry)) {
      const path = `componentRegistry.${registryKey}`;
      checkComponentId(registryKey, path, out);
      if (!isRecord(descriptor)) {
        out.error("component.registry.descriptor.invalid", path, "Registry entries must be descriptor objects.");
        continue;
      }
      if (descriptor.componentId !== registryKey) out.error("component.registry-key.mismatch", `${path}.componentId`, "Registry entry key and componentId must match.");
      checkText(descriptor.sectionType, `${path}.sectionType`, out);
      checkText(descriptor.variant, `${path}.variant`, out);
      checkText(descriptor.displayName, `${path}.displayName`, out);
      checkBoolean(descriptor.isResponsive, `${path}.isResponsive`, out);
      if (!isRecord(descriptor.propsSchema)) out.error("component.registry.props-schema.invalid", `${path}.propsSchema`, "Expected declarative props schema metadata.");
      if (!isRecord(descriptor.defaultProps)) out.error("component.registry.defaults.invalid", `${path}.defaultProps`, "Expected a structured default-props object.");
      if (descriptor.allowedSlots !== undefined && (!Array.isArray(descriptor.allowedSlots) || !descriptor.allowedSlots.every(isNonEmpty))) out.error("component.registry.slots.invalid", `${path}.allowedSlots`, "Allowed slots must be an array of non-empty strings.");
    }
    for (const [sectionType, componentId] of Object.entries(platform.defaultComponentMappings)) {
      if (!input.componentRegistry[componentId]) out.error("platform.mapping.component-unregistered", `platform.defaultComponentMappings.${sectionType}`, "Default component mapping is absent from the supplied approved registry.");
    }
  }
  return out.result();
}
