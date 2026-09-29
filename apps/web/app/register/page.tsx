import Link from "next/link";
import { RegistrationForm } from "./registration-form";

export default function RegisterPage() {
  return <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/" className="text-sm text-slate-600 hover:underline">← Professional Identity</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-slate-600">Start your professional identity journey.</p>
      <RegistrationForm onSubmit={async (values) => {
        const response = await fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await response.json().catch(() => ({ ok: false, error: { code: "invalid-input", message: "We could not create your account. Please try again." } }));
        if (data.ok) return { ok: true };
        return {
          ok: false,
          message: data.error?.message ?? "We could not create your account. Please try again.",
          fieldErrors: data.error?.code === "invalid-input"
            ? { email: "Check your email address.", password: "Check your password." }
            : undefined,
        };
      }} />
      <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-medium text-slate-950 underline">Sign in</Link></p>
    </section>
  </main>;
}