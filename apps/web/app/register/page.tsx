import Link from "next/link";
import { RegistrationForm } from "./registration-form";

export default function RegisterPage() {
  return <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/" className="text-sm text-slate-600 hover:underline">← Professional Identity</Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-slate-600">Start your professional identity journey.</p>
      <RegistrationForm onSubmit={async () => ({ ok: false, message: "Account creation is not available until secure account storage and password hashing are configured." })} />
      <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-medium text-slate-950 underline">Sign in</Link></p>
    </section>
  </main>;
}
