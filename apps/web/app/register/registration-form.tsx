"use client";

import { useState } from "react";

export interface RegistrationFormValues { email: string; password: string }
export type RegistrationSubmitResult = { ok: true } | { ok: false; message: string; fieldErrors?: Partial<Record<"email" | "password", string>> };

export function RegistrationForm({ onSubmit }: { onSubmit: (values: RegistrationFormValues) => Promise<RegistrationSubmitResult> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter a password.";
    else if (password.length < 12) next.password = "Use at least 12 characters.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const result = await onSubmit({ email: email.trim(), password });
      if (result.ok) setMessage("Your account was created successfully.");
      else { setErrors(result.fieldErrors ?? {}); setMessage(result.message); }
    } catch { setMessage("We could not create your account. Please try again."); }
    finally { setPending(false); setPassword(""); }
  }
  return <form onSubmit={submit} noValidate className="mt-8 space-y-5" aria-busy={pending}>
    <div>
      <label htmlFor="registration-email" className="mb-1 block text-sm font-medium">Email address</label>
      <input id="registration-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "registration-email-error" : undefined} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      {errors.email && <p id="registration-email-error" className="mt-1 text-sm text-red-700">{errors.email}</p>}
    </div>
    <div>
      <label htmlFor="registration-password" className="mb-1 block text-sm font-medium">Password</label>
      <input id="registration-password" name="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "registration-password-error" : "registration-password-hint"} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      {errors.password ? <p id="registration-password-error" className="mt-1 text-sm text-red-700">{errors.password}</p> : <p id="registration-password-hint" className="mt-1 text-sm text-slate-600">Use at least 12 characters.</p>}
    </div>
    <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
  </form>;
}
