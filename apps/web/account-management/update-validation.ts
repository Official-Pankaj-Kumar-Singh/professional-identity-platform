/**
 * @file account-management/update-validation.ts
 *
 * Update-patch validation (Task #130).
 *
 * A patch arrives as untrusted JSON, so it is validated against the mutable-field
 * allowlist before anything is persisted. Three distinct rejections are made
 * distinguishable on purpose:
 *
 * - An unknown or protected field is `forbidden`, not merely "invalid". Silently
 *   ignoring `passwordHash` or `id` would tell a caller the write succeeded while
 *   their value was discarded, which is the kind of ambiguity that hides a bug.
 * - A malformed permitted field is `invalid` with field-level detail, matching
 *   the convention registration already uses.
 * - An empty patch is rejected rather than treated as a no-op success.
 *
 * Normalization is deliberately *not* performed here. The repository already
 * normalizes and enforces identity uniqueness atomically under the account write
 * lock; doing it again at the edge would duplicate that rule and risk the two
 * disagreeing.
 */

import { MUTABLE_ACCOUNT_FIELDS, PROTECTED_ACCOUNT_FIELDS, type AccountUpdatePatch } from "./types";

/** The same email shape registration already enforces. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERMITTED = new Set<string>(MUTABLE_ACCOUNT_FIELDS);
const PROTECTED = new Set<string>(PROTECTED_ACCOUNT_FIELDS);

export type PatchValidation =
  | { readonly ok: true; readonly patch: AccountUpdatePatch }
  | { readonly ok: false; readonly forbidden: readonly string[] }
  | { readonly ok: false; readonly fields: Record<string, string> };

export function validateAccountPatch(input: unknown): PatchValidation {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, fields: { _form: "Provide the account details to update." } };
  }

  const entries = Object.entries(input as Record<string, unknown>);

  const forbidden = entries.filter(([key]) => PROTECTED.has(key)).map(([key]) => key);
  const unknown = entries.filter(([key]) => !PERMITTED.has(key) && !PROTECTED.has(key)).map(([key]) => key);

  if (forbidden.length > 0 || unknown.length > 0) {
    // Both classes are refused together: the caller learns which keys are not
    // acceptable, and nothing about any other account.
    return { ok: false, forbidden: [...forbidden, ...unknown] };
  }

  if (entries.length === 0) {
    return { ok: false, fields: { _form: "Provide at least one field to update." } };
  }

  const patch: Record<string, string> = {};
  const fields: Record<string, string> = {};

  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      fields[key] = "Enter a value.";
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      fields[key] = "Enter a value.";
      continue;
    }
    if (key === "email" && !EMAIL_SHAPE.test(trimmed)) {
      fields[key] = "Enter a valid email address.";
      continue;
    }
    patch[key] = trimmed;
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, patch: patch as AccountUpdatePatch };
}