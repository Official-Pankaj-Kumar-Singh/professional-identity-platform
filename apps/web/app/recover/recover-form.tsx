"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RECOVERY_GENERIC_ERROR,
  RECOVERY_REQUEST_SENT_MESSAGE,
  toFieldErrors,
  toRecoverFeedback,
} from "./recover-rules";

/**
 * Task #122 — the recovery-request form.
 *
 * The form is deliberately not told whether the account exists, because the
 * endpoint will not say. After any accepted submission it renders the neutral
 * confirmation, so nothing about the submitted address can be inferred from this
 * screen — not from the wording, and not from whether the page changed at all.
 */
export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setFields({});
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => null);
      const feedback = toRecoverFeedback(payload);
      if (feedback.ok) {
        setSubmitted(true);
        setMessage(RECOVERY_REQUEST_SENT_MESSAGE);
      } else {
        setFields(toFieldErrors(payload));
        setMessage(feedback.message);
      }
    } catch {
      setMessage(RECOVERY_GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate aria-busy={pending}>
      <div>
        <label htmlFor="recover-email" className="mb-1 block text-sm font-medium">Email address</label>
        <input
          id="recover-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fields.email)}
          aria-describedby={fields.email ? "recover-email-error" : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {fields.email && <p id="recover-email-error" className="mt-1 text-sm text-red-700">{fields.email}</p>}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-slate-700">{message}</p>
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send recovery link"}
      </button>
    </form>
  );
}