import Link from "next/link";
import { AccountManager } from "./account-manager";

/**
 * Account management page (Feature #79).
 *
 * A thin shell: the page itself holds no state, and all behaviour lives in
 * `AccountManager` with its rules in `account-rules.ts`. It follows the existing
 * page convention used by `/login` and `/register`, and introduces no new
 * navigation, theme, or layout work.
 */
export default function AccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Professional Identity</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Your account</h1>
        <AccountManager endpoint="/api/accounts" />
      </section>
    </main>
  );
}