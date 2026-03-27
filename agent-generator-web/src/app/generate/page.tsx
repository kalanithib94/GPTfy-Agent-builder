"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedBundle } from "@/lib/generation-types";
import type { IntentDeployPlan } from "@/lib/intent-deploy-types";

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
  { id: "samples", label: "Try it" },
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
  const [openaiModel, setOpenaiModel] = useState("");
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
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryNotes, setRetryNotes] = useState("");
  const [retryErrorText, setRetryErrorText] = useState("");
  const [deployOutcome, setDeployOutcome] = useState<DeployOutcome | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as SessionInfo;
        setSession(s);
        setOpenaiModel((prev) =>
          prev.trim() ? prev : (s.openaiModel?.trim() || "gpt-4.1-mini")
        );
      }
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
      openaiModel: openaiModel.trim() || undefined,
      useTemplateOnly: useTemplateOnly || undefined,
    };
  }

  async function runFullPipeline(e?: React.MouseEvent) {
    e?.preventDefault();
    setErr(null);
    setBundle(null);
    setWarnings([]);
    setDeployOutcome(null);
    setRetryErrorText("");
    setRetryNotes("");
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
      const deploy = j.deploy as DeployOutcome;
      if (deploy?.errors?.length) {
        setRetryErrorText(deploy.errors.join("\n"));
      }
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
      if (Array.isArray((j as DeployOutcome).errors) && (j as DeployOutcome).errors.length) {
        setRetryErrorText((j as DeployOutcome).errors.join("\n"));
      }
    } catch {
      setErr("Deploy request failed");
    } finally {
      setDeployLoading(false);
    }
  }

  async function retryFixFromDeployErrors() {
    if (!bundle) return;
    const deployErrorText = retryErrorText.trim() || deployOutcome?.errors.join("\n") || "";
    if (!deployErrorText) {
      setErr("Add deploy error details first, then retry fix.");
      return;
    }
    setRetryLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/generate/retry-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle,
          useCase,
          notes: notes || undefined,
          deployErrorText,
          retryNotes: retryNotes || undefined,
          openaiModel: openaiModel.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Retry fix failed");
        return;
      }
      setBundle(j.bundle as GeneratedBundle);
      setWarnings((prev) => [
        ...prev,
        ...(Array.isArray(j.warnings) ? (j.warnings as string[]) : []),
      ]);
      setDeployOutcome(null);
      setTab("handler");
    } catch {
      setErr("Retry fix request failed");
    } finally {
      setRetryLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBundle(null);
    setWarnings([]);
    setDeployOutcome(null);
    setRetryErrorText("");
    setRetryNotes("");
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
        <details className="mt-4 max-w-3xl rounded-lg border border-[var(--border)] bg-black/20 px-4 py-3 text-sm text-[var(--muted)] open:border-cyan-500/30">
          <summary className="cursor-pointer font-medium text-cyan-200/95">
            Already have an agent? Add skills or intents incrementally
          </summary>
          <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3 text-[13px] leading-relaxed">
            <p>
              Use the <strong className="text-white">same</strong>{" "}
              <span className="text-neutral-300">Agent Developer Name</span>,{" "}
              <span className="text-neutral-300">Handler class</span>, and{" "}
              <span className="text-neutral-300">External Id prefix</span> as in Salesforce so the pipeline updates
              that agent instead of creating a different one.
            </p>
            <p>
              <strong className="text-white">Add a skill:</strong> After you generate (or paste) a bundle, merge{" "}
              <strong className="text-white">all</strong> skills you want to keep into one handler: each skill needs a{" "}
              <code className="text-cyan-200/90">when &apos;skill_name&apos;</code> branch{" "}
              <em className="text-neutral-400">and</em> a matching{" "}
              <code className="text-cyan-200/90">*_PromptCommand.json</code>. Publish replaces the whole Apex class and
              upserts prompts by external id, so old skills disappear from the handler if you omit them.
            </p>
            <p>
              <strong className="text-white">Add intents:</strong> In the <strong className="text-white">Intents</strong>{" "}
              tab, include only <strong className="text-white">new</strong> intent names (snake_case). The deploy step
              skips intents that already exist for this agent; it does not duplicate or update them.
            </p>
            <p className="text-neutral-500">
              Tip: generate a small use case for the new piece, copy the new skill/intent from the preview, then paste
              into your full bundle before editing the handler and publishing.
            </p>
          </div>
        </details>
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

        <div className="max-w-xl">
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            OpenAI model (optional override)
          </label>
          <input
            type="text"
            value={openaiModel}
            onChange={(e) => setOpenaiModel(e.target.value)}
            placeholder={session?.openaiModel || "gpt-4.1-mini"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono text-sm"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Leave as default, or set another model ID (example: <code>gpt-4.1-mini</code>,{" "}
            <code>gpt-4.1</code>).
          </p>
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

      {bundle && deployOutcome && !deployOutcome.ok ? (
        <div className="rounded-lg border border-violet-800/60 bg-violet-950/20 p-4 space-y-3">
          <h3 className="text-white font-semibold">Retry fix from deploy errors</h3>
          <p className="text-xs text-[var(--muted)]">
            Sends previous Apex + these errors back to OpenAI so it can patch and regenerate.
          </p>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Deploy errors</label>
            <textarea
              rows={6}
              value={retryErrorText}
              onChange={(e) => setRetryErrorText(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-black/40 px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 whitespace-pre-wrap font-mono text-xs"
              placeholder="Paste deploy errors here if needed"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Extra instructions (optional)</label>
            <input
              type="text"
              value={retryNotes}
              onChange={(e) => setRetryNotes(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-black/40 px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Example: keep only 2 skills and avoid dynamic SOQL"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => retryFixFromDeployErrors()}
              disabled={retryLoading || !retryErrorText.trim()}
              className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
            >
              {retryLoading ? "Retrying…" : "Retry fix with OpenAI"}
            </button>
            <span className="text-xs text-[var(--muted)]">Model: {openaiModel || session?.openaiModel || "gpt-4.1-mini"}</span>
          </div>
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
      return (
        <div className="space-y-6">
          {bundle.intentDeployPlan?.length ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Intent actions (deploy plan)</h3>
              {bundle.intentDeployPlan.map((intent, idx) => (
                <IntentPlanCard key={`${intent.name}_${idx}`} intent={intent} index={idx} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              No structured intent action plan found in this bundle.
            </div>
          )}
          <div>
            <div className="text-sm text-cyan-400 mb-2">Raw intents markdown</div>
            {wrap("intents", bundle.intentsConfigMd)}
          </div>
        </div>
      );
    case "fullconfig":
      return wrap("fc", bundle.fullConfigStubApex);
    case "samples":
      return (
        <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">10 sample queries to test this agent</h3>
          {(bundle.sampleQueries?.length ? bundle.sampleQueries : []).length ? (
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-200">
              {(bundle.sampleQueries ?? []).slice(0, 10).map((q, i) => (
                <li key={`sample_${i}`}>
                  <span className="whitespace-pre-wrap">{q}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm text-amber-200">
              No sample queries in this bundle yet. Regenerate once to get examples.
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

function IntentPlanCard({ intent, index }: { intent: IntentDeployPlan; index: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
          Intent {index + 1}
        </span>
        {intent.sequence !== undefined ? (
          <span className="text-xs px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
            Seq {intent.sequence}
          </span>
        ) : null}
        <span
          className={`text-xs px-2 py-1 rounded border ${
            intent.isActive === false
              ? "border-amber-700/60 text-amber-200 bg-amber-950/30"
              : "border-emerald-700/60 text-emerald-200 bg-emerald-950/30"
          }`}
        >
          {intent.isActive === false ? "Inactive" : "Active"}
        </span>
      </div>

      <div>
        <div className="text-white font-semibold">{intent.name}</div>
        {intent.description ? (
          <div className="text-sm text-[var(--muted)] mt-1">{intent.description}</div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-white">Actions</div>
        {intent.actions.length ? (
          <div className="space-y-2">
            {intent.actions.map((action, actionIdx) => (
              <div
                key={`${intent.name}_a_${actionIdx}`}
                className="rounded-lg border border-[var(--border)] bg-black/25 p-3"
              >
                <div className="text-sm text-white">
                  <strong>#{action.seq}</strong> - {action.actionType}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)] space-y-1">
                  {action.language ? <div>Language: {action.language}</div> : null}
                  {action.cannedText ? (
                    <div className="whitespace-pre-wrap">Canned text: {action.cannedText}</div>
                  ) : null}
                  {action.objectApiName ? <div>Object: {action.objectApiName}</div> : null}
                  {action.flowApiName ? <div>Flow: {action.flowApiName}</div> : null}
                  {action.apexClass ? <div>Apex class: {action.apexClass}</div> : null}
                  {action.apexReturnType ? (
                    <div>Apex return type: {action.apexReturnType}</div>
                  ) : null}
                </div>
                {action.details?.length ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-[var(--muted)]">
                          <th className="pr-3 py-1">Field</th>
                          <th className="pr-3 py-1">Type</th>
                          <th className="py-1">Value/Instruction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {action.details.map((d, dIdx) => (
                          <tr key={`${intent.name}_a_${actionIdx}_d_${dIdx}`} className="align-top">
                            <td className="pr-3 py-1 text-gray-200">{d.fieldApiName}</td>
                            <td className="pr-3 py-1 text-gray-200">{d.type}</td>
                            <td className="py-1 text-gray-300">{d.valueOrInstruction ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-amber-200">No actions on this intent.</div>
        )}
      </div>
    </div>
  );
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
