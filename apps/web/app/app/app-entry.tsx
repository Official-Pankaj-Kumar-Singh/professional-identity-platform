"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolveEntry, SIGN_IN_PATH, type EntryDecision } from "../session/entry-contract";
import { ANONYMOUS, resolveAuthState, type AuthState } from "../session/auth-state";

/**
 * The authenticated application entry point (Task #137).
 *
 * This is where a signed-in visitor arrives, and where an anonymous one is
 * turned away. It reads authentication exclusively through `resolveAuthState`,
 * which asks `GET /api/me` — the established server boundary from Story #84 —
 * and never from anything the browser supplied. There is no token in the URL, no
 * account id in client state that could be edited into authority, and no
 * client-side bypass: an anonymous visitor simply has no session to present.
 *
 * It renders no profile, portfolio, or portfolio content. Those belong to
 * EPIC-02; this feature is the transition into the application and nothing more,
 * as the entry contract requires.
 */
export function AppEntry() {
  const [auth, setAuth] = useState<AuthState>(ANONYMOUS);
  const [checked, setChecked] = useState(false);

  // State is set from the promise callback rather than the effect body, so
  // mounting cannot cascade a synchronous render.
  useEffect(() => {
    let active = true;
    void resolveAuthState().then((resolved) => {
      if (!active) return;
      setAuth(resolved);
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!checked) {
    return <p className="text-sm text-slate-500">Checking your session…</p>;
  }

  const decision: EntryDecision = resolveEntry(auth);

  if (decision.kind === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Sign in to continue</h2>
        <p className="mt-2 text-slate-600">
          This part of the application is only available to signed-in accounts.
        </p>
        <Link href={SIGN_IN_PATH} className="mt-4 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Signed in as {decision.identity.email}</h2>
        <p className="mt-1 text-sm text-slate-500">Account {decision.identity.id}</p>
        <Link href={decision.accountPath} className="mt-4 inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Manage your account
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Your professional profile and portfolio are not part of this release.
      </p>
    </div>
  );
}