export type RegistrationField = "email" | "password";

export interface RegistrationValidationIssue {
  field: RegistrationField;
  code: "required" | "invalid-email" | "weak-password";
  message: string;
}

export interface RegistrationValidationResult {
  ok: boolean;
  issues: RegistrationValidationIssue[];
}

/** Shared server-side registration policy; clients may mirror these rules. */
export function validateRegistration(input: unknown): RegistrationValidationResult {
  const issues: RegistrationValidationIssue[] = [];
  const value = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  if (!email) issues.push({ field: "email", code: "required", message: "Enter your email address." });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ field: "email", code: "invalid-email", message: "Enter a valid email address." });
  if (!password) issues.push({ field: "password", code: "required", message: "Enter a password." });
  else if (password.length < 12) issues.push({ field: "password", code: "weak-password", message: "Use at least 12 characters." });
  return { ok: issues.length === 0, issues };
}
