"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RESET_GENERIC_ERROR,
  RESET_SUCCESS_MESSAGE,
  toFieldErrors,
  toResetFeedback,
} from "./reset-rules";

/**
 * Task #126 — the password-reset form.
 *
 * The recovery token arrives in the body rather than the URL: a token in a query
 * string ends up in browser history, server logs, and `Referer` headers, all of
 * which would leak a live credential.
 */
export function ResetForm({ token = "" }: { token?: string }) {
  const [value, setValue] = useState(token);
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch("/api/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value.trim(), password }),
      });
      const payload = await response.json().catch(() => null);
      const feedback = toResetFeedback(payload);
      if (feedback.ok) {
        setDone(true);
        setMessage(RESET_SUCCESS_MESSAGE);
      } else {
        setFields(toFieldErrors(payload));
        setMessage(feedback.message);
      }
    } catch {
      setMessage(RESET_GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium underline">Sign in with your new password</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate aria-busy={pending}>
      <div>
        <label htmlFor="reset-token" className="mb-1 block text-sm font-medium">Recovery code</label>
        <input
          id="reset-token"
          name="token"
          type="text"
          autoComplete="one-time-code"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(fields.token)}
          aria-describedby={fields.token ? "reset-token-error" : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {fields.token && <p id="reset-token-error" className="mt-1 text-sm text-red-700">{fields.token}</p>}
      </div>
      <div>
        <label htmlFor="reset-password" className="mb-1 block text-sm font-medium">New password</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fields.password)}
          aria-describedby={fields.password ? "reset-password-error" : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {fields.password && <p id="reset-password-error" className="mt-1 text-sm text-red-700">{fields.password}</p>}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}