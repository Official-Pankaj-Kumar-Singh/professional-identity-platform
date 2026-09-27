import type { ComponentStyleConfiguration } from "../component";
import type { PlatformDefaultLayout } from "../platform";
import type { ProfessionSectionDescriptor } from "../profession";
import type { ThemeConfiguration } from "../theme";
import type {
  AppliedConfigurationDefault,
  ConfigurationDefaultsContext,
  ConfigurationDefaultsResult,
  DefaultableComponentConfiguration,
  DefaultablePortfolioConfiguration,
  DefaultableSectionConfiguration,
  DefaultSource,
} from "./types";

export type {
  AppliedConfigurationDefault,
  ConfigurationDefaultsContext,
  ConfigurationDefaultsResult,
  DefaultableComponentConfiguration,
  DefaultablePortfolioConfiguration,
  DefaultableSectionConfiguration,
  DefaultSource,
} from "./types";

type MutableDefaults = AppliedConfigurationDefault[];

function ownValue<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return record !== undefined && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function recordDefault(applied: MutableDefaults, path: string, source: DefaultSource): void {
  applied.push({ path, source });
}

function cloneStyle(style: Partial<ComponentStyleConfiguration>): Partial<ComponentStyleConfiguration> {
  return {
    ...style,
    ...(style.customClassModifiers === undefined ? {} : { customClassModifiers: [...style.customClassModifiers] }),
  };
}

function cloneComponent(component: DefaultableComponentConfiguration): DefaultableComponentConfiguration {
  return {
    ...component,
    ...(component.props === undefined
      ? {}
      : { props: Object.fromEntries(Object.entries(component.props).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])) }),
    ...(component.styles === undefined ? {} : { styles: cloneStyle(component.styles) }),
    ...(component.responsive === undefined ? {} : { responsive: { ...component.responsive } }),
  };
}

function cloneSection(section: DefaultableSectionConfiguration): DefaultableSectionConfiguration {
  return {
    ...section,
    ...(section.layout === undefined
      ? {}
      : {
          layout: {
            ...section.layout,
            ...(section.layout.columns === undefined ? {} : { columns: { ...section.layout.columns } }),
          },
        }),
    ...(section.filter === undefined
      ? {}
      : { filter: { ...section.filter, ...(section.filter.tagFilter === undefined ? {} : { tagFilter: [...section.filter.tagFilter] }) } }),
    ...(section.componentConfig === undefined ? {} : { componentConfig: cloneComponent(section.componentConfig) }),
  };
}

function clonePortfolio(portfolio: DefaultablePortfolioConfiguration): DefaultablePortfolioConfiguration {
  return {
    ...portfolio,
    ...(portfolio.navigation === undefined
      ? {}
      : { navigation: { ...portfolio.navigation, ...(portfolio.navigation.customLinks === undefined ? {} : { customLinks: portfolio.navigation.customLinks.map((link) => ({ ...link })) }) } }),
    ...(portfolio.sectionOrder === undefined ? {} : { sectionOrder: [...portfolio.sectionOrder] }),
    ...(portfolio.sections === undefined
      ? {}
      : { sections: Object.fromEntries(Object.entries(portfolio.sections).map(([id, section]) => [id, cloneSection(section)])) }),
    ...(portfolio.footer === undefined ? {} : { footer: { ...portfolio.footer } }),
    ...(portfolio.seo === undefined ? {} : { seo: { ...portfolio.seo } }),
    ...(portfolio.audit === undefined ? {} : { audit: { ...portfolio.audit } }),
  };
}

function fillLayout(
  existing: DefaultableSectionConfiguration["layout"],
  defaults: PlatformDefaultLayout,
  path: string,
  applied: MutableDefaults,
): DefaultableSectionConfiguration["layout"] {
  if (existing?.containerWidth === undefined) recordDefault(applied, `${path}.containerWidth`, "platform");
  if (existing?.alignment === undefined) recordDefault(applied, `${path}.alignment`, "platform");
  if (existing?.paddingY === undefined) recordDefault(applied, `${path}.paddingY`, "platform");
  if (existing?.columns?.mobile === undefined) recordDefault(applied, `${path}.columns.mobile`, "platform");
  if (existing?.columns?.tablet === undefined) recordDefault(applied, `${path}.columns.tablet`, "platform");
  if (existing?.columns?.desktop === undefined) recordDefault(applied, `${path}.columns.desktop`, "platform");
  return {
    ...existing,
    containerWidth: existing?.containerWidth === undefined ? defaults.containerWidth : existing.containerWidth,
    alignment: existing?.alignment === undefined ? defaults.alignment : existing.alignment,
    paddingY: existing?.paddingY === undefined ? defaults.paddingY : existing.paddingY,
    columns: {
      ...existing?.columns,
      mobile: existing?.columns?.mobile === undefined ? defaults.columns.mobile : existing.columns.mobile,
      tablet: existing?.columns?.tablet === undefined ? defaults.columns.tablet : existing.columns.tablet,
      desktop: existing?.columns?.desktop === undefined ? defaults.columns.desktop : existing.columns.desktop,
    },
  };
}

function styleDefaultsFor(theme: ThemeConfiguration | undefined, componentId: string | undefined): Partial<ComponentStyleConfiguration> | undefined {
  if (theme === undefined || componentId === undefined) return undefined;
  return ownValue(theme.componentDefaults, componentId);
}

function applyStyleDefaults(
  existing: Partial<ComponentStyleConfiguration> | undefined,
  defaults: Partial<ComponentStyleConfiguration> | undefined,
  path: string,
  applied: MutableDefaults,
): Partial<ComponentStyleConfiguration> | undefined {
  if (defaults === undefined) return existing === undefined ? undefined : cloneStyle(existing);
  const result = existing === undefined ? {} : cloneStyle(existing);
  const sourceFields = ["density", "elevation", "borderStyle", "accentHighlight", "customClassModifiers"] as const;
  for (const field of sourceFields) {
    if (result[field] === undefined && defaults[field] !== undefined) {
      if (field === "customClassModifiers") result.customClassModifiers = [...(defaults.customClassModifiers ?? [])];
      else if (field === "density") result.density = defaults.density;
      else if (field === "elevation") result.elevation = defaults.elevation;
      else if (field === "borderStyle") result.borderStyle = defaults.borderStyle;
      else result.accentHighlight = defaults.accentHighlight;
      recordDefault(applied, `${path}.${field}`, "theme");
    }
  }
  return result;
}

function componentVariant(
  componentId: string | undefined,
  sectionVariant: string | undefined,
  context: ConfigurationDefaultsContext,
): string | undefined {
  if (componentId !== undefined) {
    const descriptor = ownValue(context.componentRegistry, componentId);
    if (descriptor !== undefined) return descriptor.variant;
  }
  return sectionVariant;
}

function applySectionDefaults(
  sectionId: string,
  current: DefaultableSectionConfiguration | undefined,
  professionSection: ProfessionSectionDescriptor | undefined,
  context: ConfigurationDefaultsContext,
  theme: ThemeConfiguration | undefined,
  applied: MutableDefaults,
  unresolved: string[],
): DefaultableSectionConfiguration {
  const section = current === undefined ? {} : cloneSection(current);
  const path = `sections.${sectionId}`;
  if (section.sectionId === undefined) {
    section.sectionId = professionSection?.sectionId ?? sectionId;
    recordDefault(applied, `${path}.sectionId`, current === undefined ? professionSection === undefined ? "schema" : "profession" : "portfolio");
  }
  if (section.type === undefined && professionSection !== undefined) {
    section.type = professionSection.type;
    recordDefault(applied, `${path}.type`, "profession");
  }

  const platformSection = section.type === undefined
    ? undefined
    : context.platform.supportedSectionTypes.find((candidate) => candidate.type === section.type);
  if (section.enabled === undefined && professionSection !== undefined) {
    section.enabled = professionSection.defaultEnabled;
    recordDefault(applied, `${path}.enabled`, "profession");
  }
  if (section.title === undefined) {
    const title = professionSection?.titleDefault ?? platformSection?.label;
    if (title !== undefined) {
      section.title = title;
      recordDefault(applied, `${path}.title`, professionSection === undefined ? "platform" : "profession");
    }
  }
  let variantSource: DefaultSource | undefined = section.variant === undefined ? undefined : "portfolio";
  if (section.variant === undefined) {
    const variant = professionSection?.defaultVariant ?? platformSection?.defaultVariant;
    if (variant !== undefined) {
      section.variant = variant;
      variantSource = professionSection === undefined ? "platform" : "profession";
      recordDefault(applied, `${path}.variant`, variantSource);
    }
  }
  if (platformSection !== undefined) {
    section.layout = fillLayout(section.layout, platformSection.defaultLayout, `${path}.layout`, applied);
  }

  const currentComponent = section.componentConfig;
  const componentId = currentComponent?.componentId !== undefined
    ? currentComponent.componentId
    : section.type === undefined ? undefined : ownValue(context.platform.defaultComponentMappings, section.type);
  if (componentId !== undefined || currentComponent !== undefined) {
    const componentPath = `${path}.componentConfig`;
    const component = currentComponent === undefined ? {} : cloneComponent(currentComponent);
    if (component.componentId === undefined && componentId !== undefined) {
      component.componentId = componentId;
      if (currentComponent === undefined || ownValue(context.platform.defaultComponentMappings, section.type ?? "") === componentId) {
        recordDefault(applied, `${componentPath}.componentId`, "platform");
      }
    }
    if (component.variant === undefined) {
      const variant = componentVariant(componentId, section.variant, context);
      if (variant !== undefined) {
        component.variant = variant;
        const descriptor = componentId === undefined ? undefined : ownValue(context.componentRegistry, componentId);
        recordDefault(applied, `${componentPath}.variant`, descriptor === undefined ? variantSource ?? "schema" : "component-registry");
      }
    }
    const registryDefaults = componentId === undefined ? undefined : ownValue(context.componentRegistry, componentId)?.defaultProps;
    const parsedDefaults = registryDefaults === undefined ? { props: {}, unsupportedKeys: [] } : structuredProps(registryDefaults);
    const explicitProps = component.props === undefined ? {} : component.props;
    const mergedProps = { ...parsedDefaults.props, ...explicitProps };
    for (const key of Object.keys(parsedDefaults.props)) {
      if (explicitProps[key] === undefined) recordDefault(applied, `${componentPath}.props.${key}`, "component-registry");
    }
    parsedDefaults.unsupportedKeys.forEach((key) => unresolved.push(`${componentPath}.props.${key}`));
    if (component.props === undefined) recordDefault(applied, `${componentPath}.props`, registryDefaults === undefined ? "schema" : "component-registry");
    component.props = mergedProps;
    if (component.responsive === undefined) {
      component.responsive = {};
      recordDefault(applied, `${componentPath}.responsive`, "schema");
    }
    const styles = applyStyleDefaults(component.styles, styleDefaultsFor(theme, componentId), `${componentPath}.styles`, applied);
    if (styles !== undefined) component.styles = styles;
    section.componentConfig = component;
  }
  return section;
}

function structuredProps(value: object): { props: Record<string, boolean | number | string | string[]>; unsupportedKeys: string[] } {
  const props: Record<string, boolean | number | string | string[]> = {};
  const unsupportedKeys: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) props[key] = item;
    else if (Array.isArray(item) && item.every((entry): entry is string => typeof entry === "string")) props[key] = [...item];
    else unsupportedKeys.push(key);
  }
  return { props, unsupportedKeys };
}

function findUnresolvedPaths(configuration: DefaultablePortfolioConfiguration): string[] {
  const unresolved: string[] = [];
  for (const path of ["portfolioId", "title", "colorMode"] as const) {
    if (configuration[path] === undefined) unresolved.push(path);
  }
  for (const path of ["style", "sticky", "showContactAction"] as const) {
    if (configuration.navigation?.[path] === undefined) unresolved.push(`navigation.${path}`);
  }
  for (const path of ["showSocials", "showBackToTop", "showPoweredBy"] as const) {
    if (configuration.footer?.[path] === undefined) unresolved.push(`footer.${path}`);
  }
  for (const path of ["createdAt", "updatedAt", "version", "source"] as const) {
    if (configuration.audit?.[path] === undefined) unresolved.push(`audit.${path}`);
  }
  for (const sectionId of configuration.sectionOrder ?? []) {
    if (ownValue(configuration.sections, sectionId) === undefined) unresolved.push(`sections.${sectionId}`);
  }
  for (const [id, section] of Object.entries(configuration.sections ?? {})) {
    const path = `sections.${id}`;
    for (const field of ["sectionId", "type", "enabled", "variant"] as const) {
      if (section[field] === undefined) unresolved.push(`${path}.${field}`);
    }
    for (const field of ["containerWidth", "alignment", "paddingY"] as const) {
      if (section.layout?.[field] === undefined) unresolved.push(`${path}.layout.${field}`);
    }
    for (const field of ["mobile", "tablet", "desktop"] as const) {
      if (section.layout?.columns?.[field] === undefined) unresolved.push(`${path}.layout.columns.${field}`);
    }
    const component = section.componentConfig;
    if (component === undefined) {
      unresolved.push(`${path}.componentConfig`);
      continue;
    }
    for (const field of ["componentId", "variant", "props", "responsive"] as const) {
      if (component[field] === undefined) unresolved.push(`${path}.componentConfig.${field}`);
    }
    for (const field of ["density", "elevation", "borderStyle", "accentHighlight"] as const) {
      if (component.styles?.[field] === undefined) unresolved.push(`${path}.componentConfig.styles.${field}`);
    }
  }
  return unresolved;
}

/**
 * Fill omitted portfolio values from selected configuration layers.
 * Explicitly supplied values are preserved, even when invalid; run TF-12
 * validation afterwards to report invalid configuration.
 */
export function applyConfigurationDefaults(
  portfolio: DefaultablePortfolioConfiguration,
  context: ConfigurationDefaultsContext,
): ConfigurationDefaultsResult {
  const configuration = clonePortfolio(portfolio);
  const appliedDefaults: MutableDefaults = [];
  const unresolvedDefaultSources: string[] = [];

  if (configuration.schemaVersion === undefined) {
    configuration.schemaVersion = context.platform.schemaVersion;
    recordDefault(appliedDefaults, "schemaVersion", "platform");
  }
  if (configuration.profileId === undefined) {
    configuration.profileId = context.profile.profileId;
    recordDefault(appliedDefaults, "profileId", "profile");
  }
  if (configuration.themeId === undefined) {
    const defaultThemeId = context.profession.defaultThemeId !== undefined
      ? context.profession.defaultThemeId
      : context.platform.defaultThemeId;
    configuration.themeId = defaultThemeId;
    recordDefault(appliedDefaults, "themeId", context.profession.defaultThemeId === undefined ? "platform" : "profession");
  }
  const candidateTheme = configuration.themeId === undefined ? undefined : ownValue(context.themes, configuration.themeId);
  const theme = candidateTheme?.themeId === configuration.themeId ? candidateTheme : undefined;
  if (configuration.colorMode === undefined && theme !== undefined) {
    configuration.colorMode = theme.baseMode;
    recordDefault(appliedDefaults, "colorMode", "theme");
  }
  if (configuration.sectionOrder === undefined) {
    configuration.sectionOrder = [...context.profession.defaultSectionOrder];
    recordDefault(appliedDefaults, "sectionOrder", "profession");
  }
  if (configuration.sections === undefined) {
    configuration.sections = {};
    recordDefault(appliedDefaults, "sections", "profession");
  }
  if (configuration.seo === undefined) {
    configuration.seo = {};
    recordDefault(appliedDefaults, "seo", "schema");
  }

  const sectionIds = [...new Set([...configuration.sectionOrder, ...Object.keys(configuration.sections)])];
  for (const sectionId of sectionIds) {
    const professionSection = context.profession.availableSections.find((candidate) => candidate.sectionId === sectionId);
    const existing = ownValue(configuration.sections, sectionId);
    if (existing === undefined && professionSection === undefined) continue;
    configuration.sections[sectionId] = applySectionDefaults(sectionId, existing, professionSection, context, theme, appliedDefaults, unresolvedDefaultSources);
  }

  return {
    configuration,
    appliedDefaults,
    unresolvedPaths: [...unresolvedDefaultSources, ...findUnresolvedPaths(configuration)],
  };
}
