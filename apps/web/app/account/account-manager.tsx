"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACCOUNT_DELETED_MESSAGE,
  ACCOUNT_UPDATED_MESSAGE,
  DELETE_CONFIRMATION_PHRASE,
  isConfirmedDeletion,
  toAccountFeedback,
  validateEmailChange,
  type AccountFeedback,
  type AccountPayload,
} from "./account-rules";

interface AccountView {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account management screen (Feature #79 — Tasks #128, #131, #134).
 *
 * The authenticated account's identifier comes from the resource returned by
 * `GET /api/me`, never from a value held in the page or typed into a field. The
 * component therefore has no way to address a different account: it can only ask
 * for the one the server says it is. Identifier substitution is enforced
 * server-side; this merely avoids constructing a request that would be refused.
 *
 * Decision logic lives in `account-rules.ts` as pure functions because the
 * repository has no component-test setup.
 */
export function AccountManager({ endpoint }: { endpoint: string }) {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(async (): Promise<void> => {
    try {
      // `/api/me` is the authenticated identity boundary; it yields both the
      // permitted fields and the id of the account they belong to.
      const me = await fetch("/api/me", { cache: "no-store" });
      if (!me.ok) {
        setLoaded(true);
        return;
      }
      const payload = (await me.json()) as AccountPayload;
      if (!payload.ok || !payload.account) {
        setLoaded(true);
        return;
      }
      const view = payload.account as AccountView;
      setAccount(view);
      setEmail(view.email);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // The initial fetch runs inline and touches state only from the promise
    // callback, so mounting cannot cascade a synchronous render. `load` is kept
    // for the event-driven refreshes below, where setting state is expected.
    void (async () => {
      try {
        const me = await fetch("/api/me", { cache: "no-store" });
        if (!active) return;
        if (!me.ok) {
          setLoaded(true);
          return;
        }
        const payload = (await me.json()) as AccountPayload;
        if (!active) return;
        if (payload.ok && payload.account) {
          const view = payload.account as AccountView;
          setAccount(view);
          setEmail(view.email);
        }
        setLoaded(true);
      } catch {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function sendFeedback(result: AccountFeedback, successMessage: string): Promise<boolean> {
    if (result.ok) {
      setFields({});
      setStatus(successMessage);
      return true;
    }
    setFields(result.fields);
    setStatus(result.message);
    return false;
  }

  async function saveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !account) return;

    const local = validateEmailChange(email);
    if (Object.keys(local).length > 0) {
      setFields(local);
      setStatus("Check the account details.");
      return;
    }

    setPending(true);
    setStatus("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as AccountPayload | null;
      const ok = await sendFeedback(toAccountFeedback(payload), ACCOUNT_UPDATED_MESSAGE);
      if (ok) await load();
    } catch {
      await sendFeedback({ ok: false, message: "We could not complete that request right now.", fields: {} }, ACCOUNT_UPDATED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !account) return;

    // The server independently requires a confirmation flag; this phrase is the
    // client-side guard against an accidental destructive submit.
    if (!isConfirmedDeletion(confirmText)) {
      setStatus(`Type ${DELETE_CONFIRMATION_PHRASE} to confirm deletion.`);
      return;
    }

    setPending(true);
    setStatus("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(account.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = (await response.json().catch(() => null)) as AccountPayload | null;
      const ok = await sendFeedback(toAccountFeedback(payload), ACCOUNT_DELETED_MESSAGE);
      // Deletion revokes the session server-side, so the page returns to its
      // unauthenticated state rather than continuing to show account details.
      if (ok) {
        setDeleted(true);
        setAccount(null);
      }
    } catch {
      await sendFeedback({ ok: false, message: "We could not complete that request right now.", fields: {} }, ACCOUNT_DELETED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  if (deleted) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Account deleted</h2>
        <p className="mt-2 text-slate-600">{ACCOUNT_DELETED_MESSAGE}</p>
      </section>
    );
  }

  if (!loaded) return <p className="mt-8 text-sm text-slate-500">Loading your account…</p>;

  if (!account) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Account unavailable</h2>
        <p className="mt-2 text-slate-600">Sign in to view your account details.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Account information</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Email</dt>
            <dd className="font-medium">{account.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Member since</dt>
            <dd className="font-medium">{account.createdAt.slice(0, 10)}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={saveEmail} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" noValidate>
        <h2 className="text-xl font-semibold">Update email</h2>
        <label htmlFor="account-email" className="mb-1 mt-4 block text-sm font-medium">Email address</label>
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fields.email)}
          aria-describedby={fields.email ? "account-email-error" : undefined}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {fields.email && <p id="account-email-error" className="mt-1 text-sm text-red-700">{fields.email}</p>}
        <button type="submit" disabled={pending} className="mt-4 rounded-lg bg-slate-950 px-4 py-2 font-medium text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form onSubmit={deleteAccount} className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm" noValidate>
        <h2 className="text-xl font-semibold text-red-900">Delete account</h2>
        <p className="mt-2 text-sm text-slate-600">
          This permanently removes your account and signs you out everywhere. Type {DELETE_CONFIRMATION_PHRASE} to confirm.
        </p>
        <label htmlFor="account-delete-confirm" className="mb-1 mt-4 block text-sm font-medium">Confirmation</label>
        <input
          id="account-delete-confirm"
          name="confirm"
          type="text"
          autoComplete="off"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="submit" disabled={pending} className="mt-4 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-800 disabled:opacity-60">
          {pending ? "Deleting…" : "Delete account"}
        </button>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-slate-700">{status}</p>
    </section>
  );
}