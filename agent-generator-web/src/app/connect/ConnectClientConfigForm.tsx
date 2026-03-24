"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  suggestedCallback: string;
  usingSessionConfig: boolean;
};

export function ConnectClientConfigForm({ suggestedCallback, usingSessionConfig }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [callbackUrl, setCallbackUrl] = useState(suggestedCallback);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveSessionConfig() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/salesforce/client-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "session",
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          callbackUrl: callbackUrl.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error || "Failed to save client config.");
        return;
      }
      setMsg("Saved for this browser session. Browser OAuth now uses this org's client app.");
      setClientSecret("");
      router.refresh();
    } catch {
      setErr("Network error while saving client config.");
    } finally {
      setBusy(false);
    }
  }

  async function useEnvConfig() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/salesforce/client-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "env" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error || "Failed to switch back to server env config.");
        return;
      }
      setMsg("Switched to server env config.");
      router.refresh();
    } catch {
      setErr("Network error while switching config.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-muted space-y-4">
      <h2 className="text-sm font-semibold text-neutral-200">Optional: use this org&apos;s External Client App</h2>
      <p className="text-xs text-neutral-500">
        For multi-org setups, paste each org&apos;s Client ID/Secret + callback here. Stored encrypted in your session
        cookie for this browser only.
      </p>
      <p className="text-xs text-neutral-400">
        Active source:{" "}
        <span className={usingSessionConfig ? "text-cyan-300" : "text-neutral-300"}>
          {usingSessionConfig ? "Session client config" : "Server env client config"}
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-neutral-400">Client ID (Consumer Key)</span>
          <input
            className="inp"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Paste org-specific Consumer Key"
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-neutral-400">Client Secret (Consumer Secret)</span>
          <input
            className="inp"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Paste org-specific Consumer Secret"
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-neutral-400">Callback URL</span>
          <input
            className="inp"
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            placeholder="https://your-app.vercel.app/api/salesforce/callback"
            autoComplete="off"
            disabled={busy}
          />
        </label>
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !clientId.trim() || !clientSecret.trim() || !callbackUrl.trim()}
          onClick={saveSessionConfig}
        >
          {busy ? "Saving..." : "Save for this browser"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={useEnvConfig}>
          Use server env instead
        </button>
      </div>
    </div>
  );
}

