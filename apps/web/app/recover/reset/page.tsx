import Link from "next/link";
import { ResetForm } from "../reset-form";

/**
 * Password-reset page (Task #126).
 *
 * The recovery token is not read from the URL. A token in a query string is
 * retained in browser history and can leak through `Referer` headers and access
 * logs, so it is entered into the form (or passed by the caller that already
 * holds it) and sent in the request body.
 */
export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/recover" className="text-sm text-slate-600 hover:underline">← Back</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-slate-600">Use the recovery code from your link, then set a new password.</p>
        <ResetForm />
      </section>
    </main>
  );
}