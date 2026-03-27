"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedBundle } from "@/lib/generation-types";
import type { IntentDeployPlan } from "@/lib/intent-deploy-types";
import { lightningRecordViewUrl } from "@/lib/salesforce-lightning-url";
import { consumeDeployNdjsonStream } from "@/lib/deploy-stream-client";
import type { DeployStep } from "@/lib/sf-deploy-pipeline";

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
  deployedAgentId?: string;
  agentObjectApiName?: string;
};

const TABS = [
  { id: "spec", label: "Spec" },
  { id: "handler", label: "Apex handler" },
  { id: "prompts", label: "Prompt JSON" },
  { id: "system", label: "System prompt" },
  { id: "desc", label: "Description" },
  { id: "intents", label: "Intents" },
  { id: "fullconfig", label: "FullConfig stub" },
  { id: "samples", label: "Sample prompts" },
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
  const [dataMappingName, setDataMappingName] = useState("Account 360 view - GPTfy");
  const [notes, setNotes] = useState("");
  /** Fed to OpenAI as authoritative guidance for skills, intents, and deploy shape. */
  const [intentResearchInstructions, setIntentResearchInstructions] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [useTemplateOnly, setUseTemplateOnly] = useState(false);
  /** When true, deploy merges generated handler with existing Apex in org (additive skills). */
  const [mergeExistingHandler, setMergeExistingHandler] = useState(true);
  /** UI: create new AI_Agent vs update one that already exists in Salesforce (drives merge default). */
  const [agentTargetMode, setAgentTargetMode] = useState<"new" | "existing">("existing");
  const [overwriteMatchingSkills, setOverwriteMatchingSkills] = useState(false);
  const [removeSkillsNotInBundle, setRemoveSkillsNotInBundle] = useState(false);
  const [intentDeployMode, setIntentDeployMode] = useState<
    "create_only" | "upsert" | "sync"
  >("upsert");
  /** Sync + empty intent list: allow deleting every org intent (dangerous). */
  const [intentSyncDeleteOrgWhenBundleEmpty, setIntentSyncDeleteOrgWhenBundleEmpty] =
    useState(false);

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
  /** Live NDJSON stream (publish / deploy) */
  const [deployLiveStatus, setDeployLiveStatus] = useState<string | null>(null);
  const [deployLiveSteps, setDeployLiveSteps] = useState<DeployStep[]>([]);
  const [deployLiveErrors, setDeployLiveErrors] = useState<string[]>([]);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as SessionInfo;
        setSession(s);
        setOpenaiModel((prev) =>
          prev.trim() ? prev : (s.openaiModel?.trim() || "gpt-4.1")
        );
      }
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  function onAgentTargetChange(mode: "new" | "existing") {
    setAgentTargetMode(mode);
    if (mode === "existing") {
      setMergeExistingHandler(true);
    } else {
      setMergeExistingHandler(false);
    }
  }

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
      mergeExistingHandler,
      overwriteMatchingSkills: overwriteMatchingSkills || undefined,
      removeSkillsNotInBundle: removeSkillsNotInBundle || undefined,
      intentDeployMode,
      intentSyncDeleteOrgWhenBundleEmpty:
        intentSyncDeleteOrgWhenBundleEmpty === true ? true : undefined,
      streamDeploy: true,
      intentResearchInstructions: intentResearchInstructions.trim() || undefined,
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
    setDeployLiveStatus(null);
    setDeployLiveSteps([]);
    setDeployLiveErrors([]);
    setPipelineLoading(true);
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        if (res.status === 401) {
          setErr("Connect Salesforce first.");
          return;
        }
        const j = await res.json().catch(() => ({}));
        setErr(
          typeof j.error === "string"
            ? j.error
            : JSON.stringify(j.details ?? j, null, 2)
        );
        return;
      }

      if (ct.includes("ndjson")) {
        let fatalMsg: string | null = null;
        const complete = await consumeDeployNdjsonStream(res, {
          onStatus: (m) => setDeployLiveStatus(m),
          onStep: (step) => setDeployLiveSteps((prev) => [...prev, step]),
          onErrorLine: (m) => setDeployLiveErrors((prev) => [...prev, m]),
          onFatal: (m) => {
            fatalMsg = m;
            setErr(m);
          },
        });
        if (fatalMsg) return;
        if (!complete || complete.type !== "complete") {
          setErr((prev) => prev ?? "Deploy stream ended without a result.");
          return;
        }
        const bundleData = complete.bundle as GeneratedBundle | undefined;
        const warningsList = Array.isArray(complete.warnings) ? (complete.warnings as string[]) : [];
        const deploy = complete.deploy as DeployOutcome | undefined;
        if (bundleData) setBundle(bundleData);
        setWarnings(warningsList);
        if (deploy) {
          setDeployOutcome(deploy);
          if (deploy.errors?.length) {
            setRetryErrorText(deploy.errors.join("\n"));
          }
        }
        setTab("spec");
      } else {
        const j = (await res.json()) as {
          bundle?: GeneratedBundle;
          warnings?: string[];
          deploy?: DeployOutcome;
        };
        if (j.bundle) setBundle(j.bundle);
        setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
        if (j.deploy) {
          setDeployOutcome(j.deploy);
          if (j.deploy.errors?.length) {
            setRetryErrorText(j.deploy.errors.join("\n"));
          }
        }
        setTab("spec");
      }
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
    setDeployLiveStatus(null);
    setDeployLiveSteps([]);
    setDeployLiveErrors([]);
    try {
      const res = await fetch("/api/deploy/to-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundle,
          mergeExistingHandler: mergeExistingHandler !== false,
          overwriteMatchingSkills: overwriteMatchingSkills === true,
          removeSkillsNotInBundle: removeSkillsNotInBundle === true,
          intentDeployMode,
          intentSyncDeleteOrgWhenBundleEmpty: intentSyncDeleteOrgWhenBundleEmpty === true,
          stream: true,
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(typeof j.error === "string" ? j.error : JSON.stringify(j));
        return;
      }

      if (ct.includes("ndjson")) {
        let fatalMsg: string | null = null;
        const complete = await consumeDeployNdjsonStream(res, {
          onStatus: (m) => setDeployLiveStatus(m),
          onStep: (step) => setDeployLiveSteps((prev) => [...prev, step]),
          onErrorLine: (m) => setDeployLiveErrors((prev) => [...prev, m]),
          onFatal: (m) => {
            fatalMsg = m;
            setErr(m);
          },
        });
        if (fatalMsg) return;
        if (!complete || complete.type !== "complete") {
          setErr((prev) => prev ?? "Deploy stream ended without a result.");
          return;
        }
        const deploy = complete.deploy as DeployOutcome | undefined;
        if (deploy) {
          setDeployOutcome(deploy);
          if (deploy.errors?.length) {
            setRetryErrorText(deploy.errors.join("\n"));
          }
        }
      } else {
        const j = (await res.json()) as DeployOutcome;
        setDeployOutcome(j);
        if (Array.isArray(j.errors) && j.errors.length) {
          setRetryErrorText(j.errors.join("\n"));
        }
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
          intentResearchInstructions: intentResearchInstructions.trim() || undefined,
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
    ? renderTab(tab, bundle, copy, copied, { deployOutcome, session })
    : null;

  return (
    <div className="space-y-10 lg:space-y-12">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-400/80">Generate</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Use case → artifacts</h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Pick <strong className="text-white">new vs existing</strong> agent, set <strong className="text-white">merge</strong>{" "}
          and deploy options, then describe the use case and any <strong className="text-white">extra AI instructions</strong>.
          Preview with <strong className="text-white">Generate only</strong> or publish with{" "}
          <strong className="text-white">Publish to org</strong>.
        </p>
        <details className="mt-4 max-w-3xl rounded-lg border border-[var(--border)] bg-black/20 px-4 py-3 text-sm text-[var(--muted)] open:border-cyan-500/30">
          <summary className="cursor-pointer font-medium text-cyan-200/95">
            How create vs update works (skills, handler, intents)
          </summary>
          <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3 text-[13px] leading-relaxed">
            <p>
              Use the <strong className="text-white">same</strong>{" "}
              <span className="text-neutral-300">Agent Developer Name</span>,{" "}
              <span className="text-neutral-300">Handler class</span>, and{" "}
              <span className="text-neutral-300">External Id prefix</span> as in Salesforce when you want to{" "}
              <strong className="text-white">update</strong> that agent; new values create a different agent.
            </p>
            <p>
              <strong className="text-white">Skills &amp; prompts:</strong> Each prompt upserts by{" "}
              <strong className="text-white">External Id</strong> (prefix + skill stem).{" "}
              <strong className="text-white">Merge handler</strong> (on) pulls existing Apex from the org and combines it
              with this bundle: by default org keeps branches on name clashes; use{" "}
              <strong className="text-white">Overwrite matching skills</strong> to replace a skill&apos;s logic, and{" "}
              <strong className="text-white">Sync skill list to bundle</strong> to remove org-only skills/prompts not in
              this bundle. <strong className="text-white">Merge off</strong> replaces the whole handler class with
              generated code only.
            </p>
            <p>
              <strong className="text-white">Intents:</strong> Default <strong className="text-white">Upsert</strong>{" "}
              updates existing intents by name and rewrites actions. <strong className="text-white">Create only</strong>{" "}
              leaves existing intents unchanged (no field or action updates).{" "}
              <strong className="text-white">Sync</strong> removes org intents not listed in the bundle; if the bundle
              has <strong className="text-white">zero</strong> intents, deletion is skipped unless you enable the
              explicit &quot;wipe all intents&quot; option under Sync mode.
            </p>
            <p>
              <strong className="text-white">Handler merge with no class yet:</strong> If the Apex class does not
              exist in the org (or has no body), merge cannot run — the deploy uses the generated handler only. The
              deploy log states this.
            </p>
            <p>
              <strong className="text-white">Org-only rows:</strong> Extra intents or prompts that only exist in
              Salesforce stay there unless you use <strong className="text-white">Sync</strong> (intents) or{" "}
              <strong className="text-white">Sync skill list to bundle</strong> (skills/prompts).
            </p>
            <p>
              <strong className="text-white">Research box:</strong> Use{" "}
              <strong className="text-white">Skills &amp; intents research</strong> below to tell the model exactly
              which intents/skills to add, change, or drop — it is sent to OpenAI as primary guidance.
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
        <div className="rounded-xl border border-cyan-900/50 bg-gradient-to-br from-cyan-950/40 to-black/40 px-4 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">1 · Agent target</h2>
            <span className="text-[10px] uppercase tracking-wider text-cyan-300/80">Choose first</span>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            This only sets defaults (merge on/off). You still fill identifiers below — for an{" "}
            <strong className="text-white/90">existing</strong> agent they must match Salesforce exactly.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onAgentTargetChange("new")}
              className={`text-left rounded-lg border px-4 py-3 transition ${
                agentTargetMode === "new"
                  ? "border-emerald-500/70 bg-emerald-950/35 ring-1 ring-emerald-500/40"
                  : "border-[var(--border)] bg-black/20 hover:bg-white/5"
              }`}
            >
              <div className="text-sm font-semibold text-white">Create a new agent</div>
              <div className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                New names in the org. Merge is turned <strong className="text-white/90">off</strong> by default (full
                generated handler). Turn merge on if you already have a class to combine with.
              </div>
            </button>
            <button
              type="button"
              onClick={() => onAgentTargetChange("existing")}
              className={`text-left rounded-lg border px-4 py-3 transition ${
                agentTargetMode === "existing"
                  ? "border-cyan-500/70 bg-cyan-950/35 ring-1 ring-cyan-500/40"
                  : "border-[var(--border)] bg-black/20 hover:bg-white/5"
              }`}
            >
              <div className="text-sm font-semibold text-white">Update an existing agent</div>
              <div className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                Same <strong className="text-white/90">Developer Name</strong>, <strong className="text-white/90">Handler</strong>, and{" "}
                <strong className="text-white/90">External Id prefix</strong> as in Salesforce. Merge is{" "}
                <strong className="text-white/90">on</strong> by default.
              </div>
            </button>
          </div>
        </div>

        <div className="max-w-2xl space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/30 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              2 · Salesforce deploy &amp; handler merge
            </h2>
            {agentTargetMode === "existing" ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200/95">
                Updating existing
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200/95">
                New agent path
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
              Salesforce handler (Apex)
            </p>
            <label className="flex items-start gap-3 text-sm text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={mergeExistingHandler}
                onChange={(e) => setMergeExistingHandler(e.target.checked)}
                className="mt-1 rounded border-[var(--border)]"
              />
              <span>
                <span className="font-medium text-white">Merge with existing handler in the org</span>
                <span className="block text-[var(--muted)] text-[13px] mt-1 leading-relaxed">
                  When <strong className="text-white/90">on</strong> (recommended for updates): loads the current Apex
                  class from Salesforce, then merges it with the generated handler. New skills from this bundle are
                  added; branches with the same skill name stay on the org version unless you enable &quot;Overwrite
                  matching skills&quot; below. When <strong className="text-white/90">off</strong>: the deployed class is
                  replaced entirely by generated code — use only if you want a full overwrite.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Skill merge (only when merge is on)
            </p>
            <label className="flex items-start gap-3 text-sm text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteMatchingSkills}
                onChange={(e) => setOverwriteMatchingSkills(e.target.checked)}
                disabled={!mergeExistingHandler}
                className="mt-1 rounded border-[var(--border)] disabled:opacity-40"
              />
              <span>
                <span className="font-medium text-white">Overwrite matching skills</span>
                <span className="block text-[var(--muted)] text-[13px] mt-1">
                  For each skill name that exists in both org and bundle, use the <strong className="text-white/90">bundle</strong>{" "}
                  <code className="text-cyan-200/90">when</code> branch (update logic).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={removeSkillsNotInBundle}
                onChange={(e) => setRemoveSkillsNotInBundle(e.target.checked)}
                className="mt-1 rounded border-[var(--border)]"
              />
              <span>
                <span className="font-medium text-white">Sync skill list to this bundle</span>
                <span className="block text-[var(--muted)] text-[13px] mt-1">
                  Remove handler branches and <code className="text-cyan-200/90">AI_Prompt__c</code> rows for this
                  handler that are <strong className="text-white/90">not</strong> in the bundle (same external-id
                  prefix).
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-1">
            <label htmlFor="intent-deploy-mode" className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Intent rows in Salesforce
            </label>
            <select
              id="intent-deploy-mode"
              value={intentDeployMode}
              onChange={(e) => {
                const v = e.target.value as "create_only" | "upsert" | "sync";
                setIntentDeployMode(v);
                if (v !== "sync") setIntentSyncDeleteOrgWhenBundleEmpty(false);
              }}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="upsert">
                Upsert (default) — create or update intents; replace actions from bundle
              </option>
              <option value="create_only">Create only — do not change intents that already exist</option>
              <option value="sync">
                Sync — upsert from bundle, then delete intents not listed in bundle
              </option>
            </select>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              <strong className="text-white/90">Upsert</strong> matches by agent + intent name.{" "}
              <strong className="text-white/90">Sync</strong> deletes extra org intents; if the bundle has{" "}
              <strong className="text-white/90">no</strong> intents, nothing is deleted unless you opt in below.
            </p>
            {intentDeployMode === "sync" ? (
              <label className="mt-2 flex items-start gap-2 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/95 cursor-pointer">
                <input
                  type="checkbox"
                  checked={intentSyncDeleteOrgWhenBundleEmpty}
                  onChange={(e) => setIntentSyncDeleteOrgWhenBundleEmpty(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--border)]"
                />
                <span>
                  <span className="font-medium text-white">Danger:</span> If the bundle has zero intents, still delete{" "}
                  <strong className="text-white">all</strong> intents for this agent in the org. Use only when you
                  intentionally want a full intent wipe (e.g. cleaning before a fresh plan).
                </span>
              </label>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            3 · Use case <span className="text-red-400">*</span>
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

        <div className="rounded-xl border-2 border-violet-600/50 bg-violet-950/20 px-4 py-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">4 · Extra instructions for the AI</h2>
            <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
              These fields are sent to OpenAI when generating the bundle (not used in template-only mode). Use them to steer
              skills, intents, and deploy behavior.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-violet-200">
              Structured instructions (skills, intents, deploy) <span className="text-[var(--muted)] font-normal">— recommended</span>
            </label>
            <p className="text-xs text-[var(--muted)]">
              List intent names, skill stems, flows, constraints, or &quot;do not generate&quot; rules. This is the main place
              for upsert-style change lists.
            </p>
            <textarea
              rows={8}
              value={intentResearchInstructions}
              onChange={(e) => setIntentResearchInstructions(e.target.value)}
              placeholder={`Example bullets you can paste and edit:

- Intents to include: greeting, out_of_scope, escalate_case, find_case_details
- New skill stems: MyAgent_find_case, MyAgent_add_note (must match handler when branches)
- Replace intent "find_case_details" actions: first Flow X, then Apex class CaseLookupUtil
- Do NOT add intents that only duplicate Case skills; keep 2 domain intents max
- Org constraint: no delete DML; use Task create only`}
              className="w-full rounded-md border border-violet-800/50 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 whitespace-pre-wrap font-mono"
            />
          </div>
          <div className="space-y-2 border-t border-violet-800/30 pt-4">
            <label className="block text-sm font-medium text-violet-200/90">
              General notes <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <p className="text-xs text-[var(--muted)]">
              Short tone, compliance, or style preferences (not a substitute for structured instructions above).
            </p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. EU GDPR wording, avoid medical advice, preferred language…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white mb-3">5 · Agent identifiers &amp; GPTfy connections</h2>
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
            placeholder="Account 360 view - GPTfy"
          />
          </div>
        </div>

        <div className="max-w-xl">
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            6 · OpenAI model (optional override)
          </label>
          <input
            type="text"
            value={openaiModel}
            onChange={(e) => setOpenaiModel(e.target.value)}
            placeholder={session?.openaiModel || "gpt-4.1"}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono text-sm"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Leave as default (<code>gpt-4.1</code>), or set another model ID (example:{" "}
            <code>gpt-4.1-mini</code>).
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

      {(pipelineLoading || deployLoading) ? (
        <div className="rounded-lg border border-cyan-800/50 bg-cyan-950/20 p-4 text-sm space-y-2">
          <h3 className="font-semibold text-white">Live deploy progress</h3>
          <p className="text-xs text-cyan-200/85">
            {deployLiveStatus ??
              (deployLiveSteps.length === 0 && deployLiveErrors.length === 0 ?
                "Starting…"
              : "Working…")}
          </p>
          {deployLiveSteps.length > 0 ? (
            <ul className="space-y-1 max-h-[min(50vh,320px)] overflow-y-auto border border-[var(--border)] rounded-md p-2 bg-black/25">
              {deployLiveSteps.map((s, i) => (
                <li key={`live_${i}_${s.step.slice(0, 40)}`} className="flex gap-2 text-xs text-gray-200">
                  <span className="shrink-0">{s.ok ? "✓" : "✗"}</span>
                  <span>
                    {s.step}
                    {s.detail ? (
                      <span className="text-[var(--muted)] block mt-0.5">{s.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {deployLiveErrors.length > 0 ? (
            <ul className="list-disc list-inside text-red-300/95 text-xs space-y-1">
              {deployLiveErrors.map((er, i) => (
                <li key={`live_err_${i}`}>{er}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
            {deployOutcome.steps.map((s, i) => (
              <li key={`${i}_${s.step}`} className="flex gap-2">
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
            <span className="text-xs text-[var(--muted)]">Model: {openaiModel || session?.openaiModel || "gpt-4.1"}</span>
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
  copied: string | null,
  ctx: { deployOutcome: DeployOutcome | null; session: SessionInfo | null }
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
    case "samples": {
      const samples = (bundle.sampleQueries ?? []).slice(0, 10);
      const { deployOutcome, session } = ctx;
      const agentId = deployOutcome?.deployedAgentId;
      const agentObj = deployOutcome?.agentObjectApiName;
      const instanceUrl = session?.instanceUrl?.trim();
      const agentRecordUrl =
        agentId && agentObj && instanceUrl ?
          lightningRecordViewUrl(instanceUrl, agentObj, agentId)
        : null;

      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/25 px-4 py-3 text-sm text-cyan-100/95 leading-relaxed">
            <p className="font-medium text-white mb-1">This tab is not a chat simulator</p>
            <p className="text-cyan-200/90">
              GPTfy runs inside your Salesforce org. This app only generates artifacts and deploys
              them. Use the prompts below in your org&apos;s agent test experience (or any GPTfy
              surface wired to this agent) after a successful publish.
            </p>
          </div>

          {agentRecordUrl ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-800/50 bg-emerald-950/20 px-4 py-3">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium text-white">Open deployed agent in Salesforce</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  AI_Agent__c record — use your org&apos;s GPTfy UI to send messages.
                </div>
              </div>
              <a
                href={agentRecordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Open in Salesforce
              </a>
            </div>
          ) : deployOutcome?.ok ? (
            <p className="text-xs text-[var(--muted)]">
              Republish with the latest app version to attach a direct Lightning link here, or find
              the agent under GPTfy / AI Agent records in your org.
            </p>
          ) : deployOutcome && !deployOutcome.ok ? (
            <p className="text-xs text-amber-200/90">
              Last deploy did not complete successfully — fix the errors above and publish again to
              get a Salesforce link.
            </p>
          ) : (
            <p className="text-xs text-amber-200/90">
              Publish this bundle to your org first — then you can open the agent record and try
              these prompts in Salesforce.
            </p>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Sample prompts to paste in the org</h3>
              {samples.length > 0 ? (
                <button
                  type="button"
                  onClick={() => copy(samples.join("\n\n"), "samples_all")}
                  className="text-xs px-2 py-1 rounded bg-[var(--border)] text-white hover:opacity-90"
                >
                  {copied === "samples_all" ? "Copied" : "Copy all"}
                </button>
              ) : null}
            </div>
            {samples.length ? (
              <ol className="list-decimal list-inside space-y-3 text-sm text-gray-200">
                {samples.map((q, i) => (
                  <li key={`sample_${i}`} className="pl-0">
                    <div className="inline-flex flex-col sm:flex-row sm:items-start gap-2 w-full">
                      <span className="whitespace-pre-wrap flex-1">{q}</span>
                      <button
                        type="button"
                        onClick={() => copy(q, `sample_${i}`)}
                        className="shrink-0 text-xs px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-white"
                      >
                        {copied === `sample_${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-amber-200">
                No sample queries in this bundle yet. Regenerate once to get examples.
              </div>
            )}
          </div>
        </div>
      );
    }
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
