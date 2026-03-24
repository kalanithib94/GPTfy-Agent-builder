"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Bootstrap = {
  adminEnabled: boolean;
  openaiReady: boolean;
  openaiModel: string;
};

type OpenAiDetail = {
  source: "env" | "redis" | "none";
  keyHint: string | null;
  model: string;
  redisConfigured: boolean;
  envKeySet: boolean;
  note: string;
};

export default function AdminPage() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [detail, setDetail] = useState<OpenAiDetail | null>(null);
  const [password, setPassword] = useState("");
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bootstrap", { cache: "no-store" });
      if (res.ok) setBootstrap((await res.json()) as Bootstrap);
    } catch {
      setBootstrap(null);
    }
  }, []);

  const loadDetail = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/openai", { cache: "no-store" });
      if (res.status === 401) {
        setDetail(null);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? "load_failed");
        return;
      }
      setDetail((await res.json()) as OpenAiDetail);
    } catch {
      setErr("network");
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? "unlock_failed");
        return;
      }
      setPassword("");
      setMsg("Unlocked for 8 hours on this browser.");
      await loadDetail();
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey: newKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "save_failed");
        return;
      }
      setNewKey("");
      setMsg("Shared OpenAI key saved. All users of this app will use it.");
      await loadBootstrap();
      await loadDetail();
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  async function clearRedisKey() {
    if (!confirm("Remove the OpenAI key from Redis? (Environment variable, if any, is unchanged.)")) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/openai", { method: "DELETE" });
      if (!res.ok) {
        setErr("clear_failed");
        return;
      }
      setMsg("Redis key cleared.");
      await loadBootstrap();
      await loadDetail();
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  async function logoutAdmin() {
    await fetch("/api/admin/logout", { method: "POST" });
    setDetail(null);
    setMsg("Admin session closed.");
    await loadDetail();
  }

  return (
    <div className="max-w-3xl space-y-8 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-400/80">Server</p>
          <h1 className="text-2xl font-bold text-white">OpenAI key</h1>
        </div>
        <Link href="/generate" className="text-sm text-cyan-400/90 hover:underline">
          ← Generate
        </Link>
      </div>

      <p className="text-neutral-400">
        One shared key for all users (never exposed to the browser). Prefer{" "}
        <code className="rounded bg-black/30 px-1 text-cyan-200/90">OPENAI_API_KEY</code> on Vercel; Redis below is
        optional.
      </p>

      {bootstrap ? (
        <div className="card-muted space-y-2 text-neutral-300">
          <div>
            OpenAI for generation:{" "}
            <span className={bootstrap.openaiReady ? "text-[var(--ok)]" : "text-amber-200"}>
              {bootstrap.openaiReady ? "ready" : "not configured"}
            </span>
          </div>
          <div>Model: {bootstrap.openaiModel}</div>
          <div>
            Admin UI:{" "}
            {bootstrap.adminEnabled ? (
              <span className="text-[var(--ok)]">enabled</span>
            ) : (
              <span className="text-amber-200">set GEN_ADMIN_SECRET (16+ chars) on the server</span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-neutral-500">Loading…</p>
      )}

      {msg ? <p className="text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-red-300">{err}</p> : null}

      {bootstrap?.adminEnabled ? (
        <form onSubmit={unlock} className="card space-y-3">
          <div className="text-neutral-300 font-medium">Unlock admin (8 hours)</div>
          <input
            type="password"
            autoComplete="current-password"
            className="inp w-full max-w-md"
            placeholder="GEN_ADMIN_SECRET"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn" disabled={busy || !password}>
            Unlock
          </button>
        </form>
      ) : null}

      {detail ? (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-neutral-300 font-medium">Current configuration</div>
            <button type="button" className="btn text-[10px]" onClick={() => logoutAdmin()}>
              Lock admin
            </button>
          </div>
          <p className="text-neutral-400 whitespace-pre-wrap">{detail.note}</p>
          <div className="text-neutral-500 space-y-0.5">
            <div>Source: {detail.source}</div>
            <div>Key hint: {detail.keyHint ?? "—"}</div>
            <div>Redis connected: {detail.redisConfigured ? "yes" : "no"}</div>
            <div>OPENAI_API_KEY in env: {detail.envKeySet ? "yes (takes priority)" : "no"}</div>
          </div>

          {detail.redisConfigured && !detail.envKeySet ? (
            <form onSubmit={saveKey} className="space-y-2 border-t border-[var(--border)] pt-4">
              <label className="block text-neutral-400">Save shared OpenAI key to Redis</label>
              <input
                type="password"
                autoComplete="off"
                className="inp w-full font-mono text-[11px]"
                placeholder="sk-..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn" disabled={busy || !newKey.startsWith("sk-")}>
                  Save key
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => clearRedisKey()}>
                  Clear Redis key
                </button>
              </div>
            </form>
          ) : null}

          {detail.envKeySet ? (
            <p className="text-neutral-500 border-t border-[var(--border)] pt-4 text-xs">
              Change the key in Vercel → Env → <code className="text-cyan-200/80">OPENAI_API_KEY</code>, then redeploy.
            </p>
          ) : null}

          {!detail.redisConfigured ? (
            <p className="text-neutral-500 border-t border-[var(--border)] pt-4 text-xs">
              To store a key here, add Vercel Redis (Upstash); <code className="text-cyan-200/80">UPSTASH_*</code> env
              vars appear automatically.
            </p>
          ) : null}
        </div>
      ) : bootstrap?.adminEnabled ? (
        <p className="text-neutral-500">Unlock above to view or edit the stored key.</p>
      ) : null}
    </div>
  );
}
