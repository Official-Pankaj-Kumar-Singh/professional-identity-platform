import type { EntityId } from "../platform";
import type { VersionedConfiguration } from "../versioning";

/** Persistence failures relevant to the configuration lifecycle. */
export type ConfigurationPersistenceErrorCode =
  | "not-found"
  | "already-exists"
  | "identity-mismatch"
  | "version-conflict"
  | "invalid-version"
  | "storage-failure";

export interface ConfigurationPersistenceIssue {
  code: ConfigurationPersistenceErrorCode;
  message: string;
  expectedVersion?: number;
  actualVersion?: number;
}

/** Explicit success or failure; missing records are reported as `not-found`. */
export type ConfigurationPersistenceResult<T> =
  | { ok: true; value: T }
  | { ok: false; issue: ConfigurationPersistenceIssue };

/** Proposed document and optimistic-concurrency token for a replacement. */
export interface ConfigurationUpdate<TConfiguration extends VersionedConfiguration> {
  /** Current stored revision the caller read and based this update on. */
  expectedVersion: number;
  /** Proposed document; its audit.version must equal expectedVersion. */
  configuration: TConfiguration;
  /** Explicit UTC timestamp for the new revision's audit.updatedAt. */
  updatedAt: string;
}

/**
 * Storage-agnostic contract for one configuration document type.
 * Identity must be the document's existing stable ID (for example profileId,
 * portfolioId, or themeId), not a second ID stored in the configuration.
 */
export interface ConfigurationRepository<TConfiguration extends VersionedConfiguration> {
  /** Store an initial document; duplicate identities must not overwrite data. */
  create(
    identity: EntityId,
    configuration: TConfiguration,
  ): Promise<ConfigurationPersistenceResult<TConfiguration>>;

  /** Load the current document by its existing stable identity. */
  get(identity: EntityId): Promise<ConfigurationPersistenceResult<TConfiguration>>;

  /** Check whether a document with this identity exists. */
  exists(identity: EntityId): Promise<ConfigurationPersistenceResult<boolean>>;

  /**
   * Atomically replace a document only when its stored revision matches
   * expectedVersion, returning the next TF-14 revision on success.
   */
  update(
    identity: EntityId,
    update: ConfigurationUpdate<TConfiguration>,
  ): Promise<ConfigurationPersistenceResult<TConfiguration>>;
}
