import Link from "next/link";
import { AppEntry } from "./app-entry";

/**
 * Authenticated application entry page (Task #137).
 *
 * A thin shell, matching `/recover` and `/account`: the page holds no state and
 * all behaviour lives in `AppEntry` with its decision rules in
 * `app/session/entry-contract.ts`.
 *
 * This route is the authenticated entry point. It does **not** create a profile,
 * a portfolio, or any portfolio content — EPIC-02 owns those. Reaching it proves
 * a session exists; it creates nothing.
 */
export default function AppHome() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Professional Identity</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Your application</h1>
        <AppEntry />
      </section>
    </main>
  );
}