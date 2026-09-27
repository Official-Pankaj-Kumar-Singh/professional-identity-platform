/** Structured, machine-readable result of configuration validation. */
export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** Stable identifier for the violated validation rule. */
  code: string;
  /** JSON-style path to the value, rooted at the supplied configuration. */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
