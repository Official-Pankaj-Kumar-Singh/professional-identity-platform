"use client";

import { useState } from "react";
import {
  SIGN_IN_GENERIC_ERROR,
  SIGN_IN_SUCCESS_MESSAGE,
  validateSignInFields,
  type SignInFeedback,
  type SignInFieldErrors,
  type SignInFormValues,
} from "./sign-in-form-rules";

export type { SignInFormValues };
export type SignInSubmitResult = SignInFeedback;

/**
 * Task #105 — the sign-in form.
 *
 * The component owns only presentation state: what has been typed, whether a
 * submission is in flight, and what is currently on screen. Every decision about
 * whether submitting is allowed and how a response becomes feedback lives in
 * `sign-in-form-rules.ts`, which is pure and therefore testable.
 */
export function SignInForm({ onSubmit }: { onSubmit: (values: SignInFormValues) => Promise<SignInSubmitResult> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInFieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // Nothing leaves the browser while a required field is empty. These are
    // presence checks only; whether the credential is correct is the server's
    // call, and answering it here would risk telling the user whether their
    // account exists.
    const next = validateSignInFields({ email, password });
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      const result = await onSubmit({ email: email.trim(), password });
      if (result.ok) setMessage(SIGN_IN_SUCCESS_MESSAGE);
      else setMessage(result.message);
    } catch {
      // A network or parsing failure must not surface as an unhandled rejection,
      // and must not claim the credentials were wrong when that is unknown.
      setMessage(SIGN_IN_GENERIC_ERROR);
    } finally {
      setPending(false);
      // The password is not kept in component state after the attempt.
      setPassword("");
    }
  }

  return <form onSubmit={submit} noValidate className="mt-8 space-y-5" aria-busy={pending}>
    <div>
      <label htmlFor="sign-in-email" className="mb-1 block text-sm font-medium">Email address</label>
      <input
        id="sign-in-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={event => setEmail(event.target.value)}
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "sign-in-email-error" : undefined}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {errors.email && <p id="sign-in-email-error" className="mt-1 text-sm text-red-700">{errors.email}</p>}
    </div>
    <div>
      <label htmlFor="sign-in-password" className="mb-1 block text-sm font-medium">Password</label>
      <input
        id="sign-in-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={event => setPassword(event.target.value)}
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? "sign-in-password-error" : undefined}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {errors.password && <p id="sign-in-password-error" className="mt-1 text-sm text-red-700">{errors.password}</p>}
    </div>
    <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-60">
      {pending ? "Signing in…" : "Sign in"}
    </button>
  </form>;
}
