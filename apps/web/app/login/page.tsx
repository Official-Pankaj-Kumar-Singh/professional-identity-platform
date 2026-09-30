"use client";

import Link from "next/link";
import { SignInForm } from "./sign-in-form";
import { toSignInFeedback } from "./sign-in-form-rules";

/**
 * Task #105 — the sign-in page.
 *
 * `app/register/page.tsx` linked to `/login` before this page existed, so the
 * link resolved to a segment that served POST but had nothing to render for
 * GET. This file is that page.
 *
 * A `page.tsx` may not coexist with a `route.ts` in the same App Router
 * segment; the production build rejects that combination. POST is therefore
 * served by `app/api/login/route.ts` as POST /api/login, the same split Task
 * #154 introduced for registration.
 *
 * On success the browser is authenticated by the `HttpOnly` session cookie the
 * endpoint sets, and this page reports that it worked. It deliberately does not
 * navigate anywhere: the authenticated application entry point does not exist
 * yet, and building one is Task #137.
 */
export default function LoginPage() {
  return <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/" className="text-sm text-slate-600 hover:underline">← Professional Identity</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-slate-600">Welcome back to your professional identity.</p>
      <SignInForm onSubmit={async (values) => {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        // A body that is not JSON at all must not become an unhandled rejection
        // in the form, and must not be shown to the user as-is.
        const data = await response.json().catch(() => null);
        return toSignInFeedback(data);
      }} />
      <p className="mt-6 text-center text-sm text-slate-600">
        Need an account? <Link href="/register" className="font-medium text-slate-950 underline">Create one</Link>
      </p>
    </section>
  </main>;
}
