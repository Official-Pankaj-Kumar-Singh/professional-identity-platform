"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LOGOUT_GENERIC_ERROR,
  LOGOUT_SUCCESS_MESSAGE,
  toLogoutFeedback,
} from "./logout-form-rules";

/**
 * Task #107 — the explicit logout action.
 *
 * The component decides only one thing: whether the visitor currently has a
 * session. It probes the existing protected boundary (`GET /api/me`) rather than
 * trusting anything the client holds, because the session cookie is `HttpOnly`
 * and page script cannot read it. An authenticated visitor therefore sees a
 * `Log out` control; an anonymous one sees `Sign in`.
 *
 * Invoking logout posts to `POST /logout`, which destroys the session server-side
 * and clears the cookie. The component then returns the visitor to the
 * unauthenticated state by re-probing, which is what makes the transition
 * observable: the control flips back to `Sign in` because the session really is
 * gone, not merely hidden.
 *
 * The signed-out experience this returns the user to is the public landing page.
 * The authenticated application entry point does not exist yet — building it is
 * Task #137 — so there is nowhere further to navigate to, and deliberately no
 * navigation is performed here.
 *
 * Failure leaves the visitor exactly as they were. Reporting an error without
 * changing the displayed state avoids the one misleading outcome: appearing
 * signed out while the session is still valid.
 */
export function LogoutAction({ signedInPath = "/login" }: { signedInPath?: string }) {
  const [state, setState] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  /**
   * Asks the protected boundary whether this visitor has a session. Returns the
   * answer rather than storing it, so the caller decides when to react.
   */
  async function probe(): Promise<boolean> {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      return response.ok;
    } catch {
      // A failed probe is not evidence of authentication, so it reports false
      // rather than offering a logout that cannot work.
      return false;
    }
  }

  // State is set from the promise callback rather than the effect body, so the
  // probe cannot cascade a synchronous render on mount.
  useEffect(() => {
    let active = true;
    void probe().then((authenticated) => {
      if (active) setState(authenticated ? "authenticated" : "anonymous");
    });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/logout", { method: "POST" });
      // A body that is not JSON at all must not become an unhandled rejection,
      // and must not be rendered to the user as-is.
      const data = await response.json().catch(() => null);
      const feedback = toLogoutFeedback(data);
      setMessage(feedback.ok ? LOGOUT_SUCCESS_MESSAGE : feedback.message);
      // The protected boundary is the only trustworthy signal of session state,
      // so it decides what the control shows either way. After a successful
      // logout this returns false, which is the unauthenticated transition.
      setState((await probe()) ? "authenticated" : "anonymous");
    } catch {
      setMessage(LOGOUT_GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (state === "checking") {
    // Nothing is asserted before the probe resolves, so an authenticated visitor
    // is never briefly shown a `Sign in` link that would abandon their session.
    return <span className="px-4 py-2 text-sm text-slate-400">…</span>;
  }

  if (state === "authenticated") {
    return (
      <span className="flex items-center gap-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{message}</p>
        <button
          onClick={logout}
          disabled={pending}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Signing out…" : "Log out"}
        </button>
      </span>
    );
  }

  return <Link href={signedInPath} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Sign in</Link>;
}