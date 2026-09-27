import type {
  ComponentConfiguration,
  PortfolioConfiguration,
  PortfolioFooterConfig,
  PortfolioNavigationConfig,
  PortfolioSeoConfig,
} from "../portfolio";
import type { ComponentStyleConfiguration } from "../component";
import type { ResponsiveLayoutConfig, SectionConfiguration, SectionFilterConfig } from "../section";
import type { AuditMetadata, EntityId, SchemaVersion } from "../platform";
import type { PlatformConfiguration } from "../platform";
import type { ProfessionManifest } from "../profession";
import type { ProfileConfiguration } from "../profile";
import type { ThemeConfiguration } from "../theme";
import type { ComponentRegistry } from "../../registry";

export interface DefaultableComponentConfiguration {
  componentId?: ComponentConfiguration["componentId"];
  variant?: string;
  props?: ComponentConfiguration["props"];
  styles?: Partial<ComponentStyleConfiguration>;
  responsive?: ComponentConfiguration["responsive"];
}

export interface DefaultableSectionConfiguration {
  sectionId?: SectionConfiguration["sectionId"];
  type?: SectionConfiguration["type"];
  enabled?: SectionConfiguration["enabled"];
  title?: SectionConfiguration["title"];
  subtitle?: SectionConfiguration["subtitle"];
  variant?: SectionConfiguration["variant"];
  layout?: Partial<Omit<ResponsiveLayoutConfig, "columns">> & {
    columns?: Partial<ResponsiveLayoutConfig["columns"]>;
  };
  filter?: Partial<SectionFilterConfig>;
  componentConfig?: DefaultableComponentConfiguration;
}

/** A pre-validation portfolio draft; fields without a source may stay absent. */
export interface DefaultablePortfolioConfiguration {
  schemaVersion?: SchemaVersion;
  portfolioId?: EntityId;
  profileId?: EntityId;
  title?: string;
  themeId?: EntityId;
  colorMode?: PortfolioConfiguration["colorMode"];
  navigation?: Partial<PortfolioNavigationConfig>;
  sectionOrder?: string[];
  sections?: Record<string, DefaultableSectionConfiguration>;
  footer?: Partial<PortfolioFooterConfig>;
  seo?: PortfolioSeoConfig;
  audit?: AuditMetadata;
}

export interface ConfigurationDefaultsContext {
  platform: PlatformConfiguration;
  profession: ProfessionManifest;
  profile: ProfileConfiguration;
  /** Theme documents indexed by theme ID; only the selected theme is consulted. */
  themes?: Readonly<Record<string, ThemeConfiguration>>;
  componentRegistry?: ComponentRegistry;
}

export type DefaultSource = "portfolio" | "platform" | "profession" | "profile" | "theme" | "component-registry" | "schema";

export interface AppliedConfigurationDefault {
  path: string;
  source: DefaultSource;
}

export interface ConfigurationDefaultsResult {
  configuration: DefaultablePortfolioConfiguration;
  appliedDefaults: AppliedConfigurationDefault[];
  /** Required schema paths for which none of the selected sources supplied a value. */
  unresolvedPaths: string[];
}
