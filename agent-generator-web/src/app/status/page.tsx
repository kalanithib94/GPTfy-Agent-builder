"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  objectLocalName: string;
  status: "ok" | "missing" | "error";
  apiName?: string;
  namespaceNote?: string;
  missingFields?: string[];
  message?: string;
};

type Payload = {
  connected: boolean;
  instanceUrl?: string;
  username?: string;
  orgId?: string;
  detectedNamespace?: string | null;
  namespaceHelp?: string;
  items: Item[];
  summary: { allOk: boolean; okCount: number; total: number };
};

export default function StatusPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/org/validate", { cache: "no-store" });
      if (res.status === 401) {
        setData(null);
        setError("not_connected");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "request_failed");
        return;
      }
      setData((await res.json()) as Payload);
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/salesforce/logout", { method: "POST" });
    setData(null);
    setError("not_connected");
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Checking org…</p>;
  }

  if (error === "not_connected") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Connection check</h1>
        <p className="text-[var(--muted)]">
          No active Salesforce session.{" "}
          <Link href="/connect" className="text-[var(--accent)] hover:underline">
            Connect your org
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  if (error && error !== "not_connected") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Connection check</h1>
        <p className="text-red-200 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Connection check</h1>
          <p className="text-[var(--muted)] text-sm max-w-xl">
            Validates REST describe access for GPTfy-related objects. Namespace is
            auto-detected: packaged orgs usually use{" "}
            <code className="text-cyan-400">ccai__</code> or{" "}
            <code className="text-cyan-400">ccai_qa__</code>; unpackaged dev orgs often
            have no prefix.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-white hover:bg-[var(--surface)]"
          >
            Re-run check
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-md border border-red-900/60 px-4 py-2 text-sm text-red-200 hover:bg-red-950/40"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm">
        <div className="grid gap-1">
          <span className="text-[var(--muted)]">Instance</span>
          <span className="text-white break-all">{data.instanceUrl}</span>
        </div>
        {data.username ? (
          <div className="grid gap-1">
            <span className="text-[var(--muted)]">User</span>
            <span className="text-white">{data.username}</span>
          </div>
        ) : null}
        {data.orgId ? (
          <div className="grid gap-1">
            <span className="text-[var(--muted)]">Organization ID</span>
            <span className="font-mono text-white">{data.orgId}</span>
          </div>
        ) : null}
        <div className="grid gap-1 pt-2 border-t border-[var(--border)]">
          <span className="text-[var(--muted)]">Namespace detection</span>
          <span className="text-white">
            {data.detectedNamespace === null || data.detectedNamespace === undefined
              ? "—"
              : data.detectedNamespace === ""
                ? "(none — unprefixed)"
                : data.detectedNamespace}
          </span>
          {data.namespaceHelp ? (
            <span className="text-[var(--muted)]">{data.namespaceHelp}</span>
          ) : null}
        </div>
      </div>

      <div
        className={`rounded-md px-4 py-3 text-sm font-medium ${
          data.summary.allOk
            ? "bg-emerald-950/50 text-emerald-200 border border-emerald-800/60"
            : "bg-amber-950/40 text-amber-100 border border-amber-800/50"
        }`}
      >
        {data.summary.allOk
          ? "All checked objects and required fields are present."
          : `Some checks failed (${data.summary.okCount}/${data.summary.total} OK). Install or upgrade the GPTfy package, or fix field-level security / API names.`}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] text-left text-[var(--muted)]">
              <th className="p-3 font-medium">Object</th>
              <th className="p-3 font-medium">API name (resolved)</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr
                key={row.objectLocalName}
                className="border-t border-[var(--border)]"
              >
                <td className="p-3 font-mono text-cyan-400">{row.objectLocalName}</td>
                <td className="p-3 font-mono text-white text-xs break-all">
                  {row.apiName ?? "—"}
                </td>
                <td className="p-3">
                  <span
                    className={
                      row.status === "ok"
                        ? "text-[var(--ok)]"
                        : row.status === "missing"
                          ? "text-[var(--warn)]"
                          : "text-[var(--err)]"
                    }
                  >
                    {row.status}
                  </span>
                </td>
                <td className="p-3 text-[var(--muted)]">
                  {row.namespaceNote ? (
                    <span className="block text-xs mb-1">{row.namespaceNote}</span>
                  ) : null}
                  {row.message ?? ""}
                  {row.missingFields?.length ? (
                    <ul className="list-disc list-inside text-xs mt-1 text-amber-200/90">
                      {row.missingFields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Continue to the{" "}
        <Link href="/generate" className="text-[var(--accent)] hover:underline">
          Generator
        </Link>{" "}
        after the org looks correct.
      </p>
    </div>
  );
}
