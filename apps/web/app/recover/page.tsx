import Link from "next/link";
import { RecoverForm } from "./recover-form";

/**
 * Recovery-request page (Task #122).
 *
 * A thin shell, following the same convention as `/login` and `/register`: the
 * page holds no state and all behaviour lives in `RecoverForm` with its rules in
 * `recover-rules.ts`.
 */
export default function RecoverPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/login" className="text-sm text-slate-600 hover:underline">← Back to sign in</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-slate-600">Enter the email address for your account and we will send you a recovery link.</p>
        <RecoverForm />
      </section>
    </main>
  );
}