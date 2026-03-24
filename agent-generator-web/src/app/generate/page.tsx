"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedBundle } from "@/lib/generation-types";

type SessionInfo = {
  connected: boolean;
  username?: string;
  instanceUrl?: string;
  gptfyNamespace?: string | null;
  openaiConfigured: boolean;
  openaiKeyHint?: string | null;
  openaiSource?: "env" | "redis" | "none";
  openaiModel?: string;
};

type DeployOutcome = {
  ok: boolean;
  steps: { step: string; ok: boolean; detail?: string }[];
  errors: string[];
};

const TABS = [
  { id: "spec", label: "Spec" },
  { id: "handler", label: "Apex handler" },
  { id: "prompts", label: "Prompt JSON" },
  { id: "system", label: "System prompt" },
  { id: "desc", label: "Description" },
  { id: "intents", label: "Intents" },
  { id: "fullconfig", label: "FullConfig stub" },
] as const;

export default function GeneratePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [useCase, setUseCase] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDeveloperName, setAgentDeveloperName] = useState("");
  const [handlerClass, setHandlerClass] = useState("");
  const [externalIdPrefix, setExternalIdPrefix] = useState("UC:GENERATED:");
  const [connectionName, setConnectionName] = useState("GPTfy (OpenAI)");
  const [agentModelConnectionName, setAgentModelConnectionName] = useState(
    "Response API Agentic"
  );
  const [dataMappingName, setDataMappingName] = useState("Prepackaged - Case");
  const [notes, setNotes] = useState("");
  const [useTemplateOnly, setUseTemplateOnly] = useState(false);

  const [bundle, setBundle] = useState<GeneratedBundle | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("spec");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployOutcome, setDeployOutcome] = useState<DeployOutcome | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) setSession((await res.json()) as SessionInfo);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  function buildPayload() {
    return {
      useCase,
      agentName: agentName || undefined,
      agentDeveloperName: agentDeveloperName || undefined,
      handlerClass: handlerClass || undefined,
      externalIdPrefix: externalIdPrefix || undefined,
      connectionName: connectionName || undefined,
      agentModelConnectionName: agentModelConnectionName || undefined,
      dataMappingName: dataMappingName || undefined,
      notes: notes || undefined,
      useTemplateOnly: useTemplateOnly || undefined,
    };
  }

  async function runFullPipeline(e?: React.MouseEvent) {
    e?.preventDefault();
    setErr(null);
    setBundle(null);
    setWarnings([]);
    setDeployOutcome(null);
    setPipelineLoading(true);
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setErr("Connect Salesforce first.");
          return;
        }
        setErr(
          typeof j.error === "string"
            ? j.error
            : JSON.stringify(j.details ?? j, null, 2)
        );
        return;
      }
      setBundle(j.bundle as GeneratedBundle);
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      setDeployOutcome(j.deploy as DeployOutcome);
      setTab("spec");
    } catch {
      setErr("Pipeline request failed");
    } finally {
      setPipelineLoading(false);
    }
  }

  async function deployCurrentBundle() {
    if (!bundle) return;
    setDeployLoading(true);
    setErr(null);
    setDeployOutcome(null);
    try {
      const res = await fetch("/api/deploy/to-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : JSON.stringify(j));
        return;
      }
      setDeployOutcome(j as DeployOutcome);
    } catch {
      setErr("Deploy request failed");
    } finally {
      setDeployLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBundle(null);
    setWarnings([]);
    setDeployOutcome(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setErr("Connect Salesforce first (Connect org → Connection check).");
          return;
        }
        setErr(
          typeof j.error === "string"
            ? j.error
            : JSON.stringify(j.details ?? j, null, 2)
        );
        return;
      }
      setBundle(j.bundle as GeneratedBundle);
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      setTab("spec");
    } catch {
      setErr("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!bundle) return;
    setZipLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/generate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      if (!res.ok) {
        const t = await res.text();
        setErr(t.slice(0, 400));
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${bundle.parameters.agentDeveloperName}_gptfy_bundle.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErr("ZIP download failed");
    } finally {
      setZipLoading(false);
    }
  }

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const tabContent = bundle
    ? renderTab(tab, bundle, copy, copied)
    : null;

  return (
    <div className="space-y-10 lg:space-y-12">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-400/80">Generate</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Use case → artifacts</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Connect Salesforce, describe the agent, then preview or use{" "}
          <strong className="text-white">Publish to org</strong> for a full pipeline deploy.
        </p>
      </div>

      {/* Session strip */}
      <div className="card flex flex-wrap gap-6 items-center justify-between text-sm">
        <div className="space-y-1">
          <div className="text-[var(--muted)]">Salesforce</div>
          {session?.connected ? (
            <div className="text-white">
              <span className="text-[var(--ok)]">●</span>{" "}
              {session.username ?? "Connected"}{" "}
              <span className="text-[var(--muted)] text-xs block sm:inline">
                {session.instanceUrl}
              </span>
            </div>
          ) : (
            <div className="text-amber-200">
              Not connected —{" "}
              <Link href="/connect" className="text-[var(--accent)] underline">
                Connect org
              </Link>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-[var(--muted)]">AI generation</div>
          <div className={session?.openaiConfigured ? "text-[var(--ok)]" : "text-amber-200"}>
            {session?.openaiConfigured ? (
              <>
                OpenAI ready ({session.openaiSource ?? "server"}
                {session.openaiKeyHint ? ` · ${session.openaiKeyHint}` : ""}
                {session.openaiModel ? ` · ${session.openaiModel}` : ""})
              </>
            ) : (
              <>
                Template mode — set a shared key in Vercel (
                <code className="text-neutral-400">OPENAI_API_KEY</code>) or{" "}
                <Link href="/admin" className="underline text-[var(--accent)]">
                  OpenAI setup
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/status"
            className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-1.5 text-white hover:bg-white/5"
          >
            Org check
          </Link>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            Use case <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            minLength={10}
            rows={6}
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Describe objects, actions, and guardrails (e.g. create Tasks on Account, never delete…)…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Agent name"
            value={agentName}
            onChange={setAgentName}
            placeholder="My Support Agent"
          />
          <Field
            label="Agent Developer Name"
            value={agentDeveloperName}
            onChange={setAgentDeveloperName}
            placeholder="My_Support_Agent"
          />
          <Field
            label="Handler class"
            value={handlerClass}
            onChange={setHandlerClass}
            placeholder="MySupportAgenticHandler"
          />
          <Field
            label="External Id prefix"
            value={externalIdPrefix}
            onChange={setExternalIdPrefix}
            placeholder="UC:MY_AGENT:"
          />
          <Field
            label="Prompt connection name"
            value={connectionName}
            onChange={setConnectionName}
            placeholder="GPTfy (OpenAI)"
          />
          <Field
            label="Agentic model connection"
            value={agentModelConnectionName}
            onChange={setAgentModelConnectionName}
            placeholder="Response API Agentic"
          />
          <Field
            label="Data extraction mapping"
            value={dataMappingName}
            onChange={setDataMappingName}
            className="sm:col-span-2 xl:col-span-3"
            placeholder="Prepackaged - Case"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={useTemplateOnly}
            onChange={(e) => setUseTemplateOnly(e.target.checked)}
            className="rounded border-[var(--border)]"
          />
          Force template only (skip OpenAI even if configured)
        </label>

        {warnings.length > 0 ? (
          <ul className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100 list-disc list-inside">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {err ? (
          <div className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="submit"
            disabled={loading || pipelineLoading}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-medium text-white hover:bg-white/5 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate only (preview)"}
          </button>
          <button
            type="button"
            disabled={pipelineLoading || loading}
            onClick={() => runFullPipeline()}
            className="rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {pipelineLoading ? "Publishing…" : "Publish to org (full pipeline)"}
          </button>
        </div>
      </form>

      {deployOutcome ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            deployOutcome.ok
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-100"
              : "border-amber-800/60 bg-amber-950/30 text-amber-100"
          }`}
        >
          <h3 className="font-semibold text-white mb-2">
            Org deploy {deployOutcome.ok ? "completed" : "finished with issues"}
          </h3>
          <ul className="space-y-1 mb-3">
            {deployOutcome.steps.map((s) => (
              <li key={s.step} className="flex gap-2">
                <span>{s.ok ? "✓" : "✗"}</span>
                <span>
                  {s.step}
                  {s.detail ? (
                    <span className="text-[var(--muted)] text-xs block">{s.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {deployOutcome.errors.length > 0 ? (
            <ul className="list-disc list-inside text-red-200/90 text-xs space-y-1">
              {deployOutcome.errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {bundle ? (
        <div className="space-y-6 border-t border-[var(--border)] pt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Output</h2>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">
                Source: <strong className="text-white">{bundle.source}</strong>
              </span>
              <button
                type="button"
                onClick={() => deployCurrentBundle()}
                disabled={deployLoading}
                className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {deployLoading ? "Deploying…" : "Deploy this bundle to org"}
              </button>
              <button
                type="button"
                onClick={() => downloadZip()}
                disabled={zipLoading}
                className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {zipLoading ? "Building ZIP…" : "Download ZIP"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  tab === t.id
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-white hover:bg-[var(--surface)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tabContent}
        </div>
      ) : null}
    </div>
  );
}

function renderTab(
  tab: (typeof TABS)[number]["id"],
  bundle: GeneratedBundle,
  copy: (t: string, id: string) => void,
  copied: string | null
) {
  const wrap = (id: string, content: string) => (
    <div className="relative group">
      <button
        type="button"
        onClick={() => copy(content, id)}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-[var(--border)] text-white opacity-80 hover:opacity-100"
      >
        {copied === id ? "Copied" : "Copy"}
      </button>
      <pre className="rounded-xl border border-[var(--border)] bg-black/40 p-4 pt-10 text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap font-mono max-h-[min(75vh,640px)] overflow-y-auto">
        {content}
      </pre>
    </div>
  );

  switch (tab) {
    case "spec":
      return wrap("spec", bundle.specMarkdown);
    case "handler":
      return wrap("handler", bundle.handlerApex);
    case "prompts":
      return (
        <div className="space-y-6">
          {bundle.promptCommands.map((pc) => (
            <div key={pc.fileName}>
              <div className="text-sm text-cyan-400 mb-2 font-mono">{pc.fileName}</div>
              {wrap(`pc_${pc.fileName}`, pc.content)}
            </div>
          ))}
        </div>
      );
    case "system":
      return wrap("system", bundle.agentSystemPrompt);
    case "desc":
      return wrap("desc", bundle.agentDescription);
    case "intents":
      return wrap("intents", bundle.intentsConfigMd);
    case "fullconfig":
      return wrap("fc", bundle.fullConfigStubApex);
    default:
      return null;
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[var(--muted)] mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}
