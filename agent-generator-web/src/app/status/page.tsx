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

type ModelField = {
  apiName: string;
  label?: string;
  type?: string;
  required: boolean;
  createable?: boolean;
  updateable?: boolean;
  picklistValues?: string[];
};

type ModelObject = {
  localName: string;
  apiName: string;
  keyFields: ModelField[];
  allFieldsCount: number;
};

type ModelPayload = {
  connected: boolean;
  namespace?: string | null;
  objects: ModelObject[];
};

export default function StatusPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelPayload | null>(null);

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

  async function loadModel() {
    try {
      const res = await fetch("/api/org/model", { cache: "no-store" });
      if (!res.ok) return;
      setModel((await res.json()) as ModelPayload);
    } catch {
      // ignore model load errors in main status page
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-neutral-500">
        Loading…
      </p>
    );
  }

  if (error === "not_connected") {
    return (
      <div className="max-w-xl space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-400/80">Org</p>
          <h1 className="text-2xl font-bold text-white">Connection check</h1>
        </div>
        <p className="text-neutral-400">
          <Link href="/connect" className="text-cyan-300 hover:underline">
            Connect Salesforce
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  if (error && error !== "not_connected") {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-white">Connection check</h1>
        <p className="text-red-300 text-sm">{error}</p>
        <button type="button" onClick={() => load()} className="btn btn-primary text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-violet-400/80">Org</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">GPTfy metadata</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => load()} className="btn text-sm">
            Refresh
          </button>
          <button type="button" onClick={() => logout()} className="btn text-sm">
            Log out
          </button>
          <button type="button" onClick={() => loadModel()} className="btn text-sm">
            Load data model
          </button>
        </div>
      </div>

      <div className="card-muted text-sm text-neutral-300 space-y-1">
        <div className="break-all text-cyan-200/80">{data.instanceUrl}</div>
        {data.username ? <div>{data.username}</div> : null}
        {data.orgId ? <div className="font-mono text-xs text-neutral-500">{data.orgId}</div> : null}
        <div>
          Namespace:{" "}
          {data.detectedNamespace === "" || data.detectedNamespace == null
            ? data.detectedNamespace === ""
              ? "(none)"
              : "—"
            : data.detectedNamespace}
        </div>
      </div>

      <p className={`text-sm font-medium ${data.summary.allOk ? "text-emerald-400" : "text-amber-200"}`}>
        {data.summary.allOk
          ? "All checks passed."
          : `${data.summary.okCount}/${data.summary.total} OK`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-black/20">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-white/[0.03] text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">Object</th>
              <th className="px-4 py-3 font-medium">API name</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.objectLocalName} className="border-t border-[var(--border)] hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-mono text-neutral-200">{row.objectLocalName}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-500 break-all max-w-md">
                  {row.apiName ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      row.status === "ok"
                        ? "text-emerald-400"
                        : row.status === "missing"
                          ? "text-amber-200"
                          : "text-red-300"
                    }
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {model ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Connected org data model</h2>
          {model.objects.map((obj) => (
            <div key={obj.localName} className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
              <div className="mb-2 text-sm text-cyan-300">
                {obj.localName} → <span className="font-mono text-xs text-neutral-400">{obj.apiName}</span>
              </div>
              <div className="mb-2 text-xs text-neutral-500">Total fields: {obj.allFieldsCount}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-neutral-500">
                      <th className="px-2 py-1">Field</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Required</th>
                      <th className="px-2 py-1">Create/Update</th>
                      <th className="px-2 py-1">Picklist values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obj.keyFields.map((f) => (
                      <tr key={f.apiName} className="border-t border-[var(--border)]">
                        <td className="px-2 py-1 font-mono text-neutral-200">{f.apiName}</td>
                        <td className="px-2 py-1 text-neutral-400">{f.type ?? "—"}</td>
                        <td className="px-2 py-1 text-neutral-300">{f.required ? "yes" : "no"}</td>
                        <td className="px-2 py-1 text-neutral-300">
                          {f.createable ? "C" : "-"} / {f.updateable ? "U" : "-"}
                        </td>
                        <td className="px-2 py-1 text-neutral-500">
                          {f.picklistValues?.slice(0, 8).join(", ") ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Link href="/generate" className="inline-flex text-sm font-medium text-cyan-300 hover:underline">
        → Generate
      </Link>
    </div>
  );
}
