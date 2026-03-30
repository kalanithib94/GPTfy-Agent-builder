import type { GeneratedBundle } from "./generation-types";
import {
  describeSObject,
  fieldSuffixMatches,
  resolveObjectName,
  type DescribeField,
} from "./gptfy-metadata";
import { defaultIntentDeployPlan, type IntentDeployPlan } from "./intent-deploy-types";
import { deployApexClassMetadata, deployFlowMetadata } from "./sf-metadata-deploy";
import { refreshSalesforceAccessToken } from "./sf-token-refresh";
import type { SfSessionData } from "./session";
import { readFile } from "fs/promises";
import path from "path";
import { repairCaseCommentCaseIdToParentId } from "./apex-casecomment-repair";
import {
  getHandlerStructuralIssues,
  repairHandlerApexCommonIssues,
} from "./apex-handler-sanity";
import { preflightValidateHandlerSoqlCustomFields } from "./apex-soql-field-preflight";
import { mergeHandlerApexWithOrg } from "./apex-handler-merge";
import { getOpenAIApiKey, getOpenAIModel } from "./openai-server-config";

const API_VER = "v59.0";

export type DeployStep = { step: string; ok: boolean; detail?: string };

export type OrgDeployResult = {
  ok: boolean;
  steps: DeployStep[];
  errors: string[];
  /** Present after AI_Agent__c upsert — for Lightning deep links in the UI */
  deployedAgentId?: string;
  agentObjectApiName?: string;
};

/**
 * Deploy behavior for incremental / full CRUD.
 * - mergeExistingHandler: combine generated handler with org (default true).
 * - overwriteMatchingSkills: incoming `when` replaces org for same skill name.
 * - removeSkillsNotInBundle: drop org skills not in bundle; delete orphan AI_Prompt__c rows.
 * - intentDeployMode: create_only (skip existing), upsert (update + replace actions), sync (delete intents not in bundle).
 * - intentSyncDeleteOrgWhenBundleEmpty: when sync + empty intentDeployPlan, delete all org intents for this agent (default false = skip).
 * - skipIntents: do not describe or deploy intent/action/detail rows (skills-only agent).
 * - skillArtifactsOnly: deploy Apex + AI_Prompt__c only; no AI_Agent__c or AI_Agent_Skill__c.
 */
export type DeployBundleOptions = {
  mergeExistingHandler?: boolean;
  overwriteMatchingSkills?: boolean;
  removeSkillsNotInBundle?: boolean;
  intentDeployMode?: "create_only" | "upsert" | "sync";
  /**
   * When `intentDeployMode` is `sync` and `intentDeployPlan` is empty: if true, delete every intent
   * for this agent in the org (full wipe). If false (default), skip deletion and record a deploy step.
   */
  intentSyncDeleteOrgWhenBundleEmpty?: boolean;
  /** Skip all intent metadata (no AI_Agent_Intent__c describe or DML). */
  skipIntents?: boolean;
  /** Prompt + handler only: no agent record or skill junction deploy. */
  skillArtifactsOnly?: boolean;
  /**
   * Update this AI_Agent__c Id directly (from org picker). PATCH includes Developer_Name__c from the bundle
   * so the org field can be repaired when it was not API-safe.
   */
  targetAgentId?: string;
  /** Called after each deploy step (for streaming UI). */
  onDeployStep?: (step: DeployStep) => void;
  /** Called when a non-fatal error line is recorded (same as final `errors` array). */
  onDeployError?: (message: string) => void;
};

function pickField(fields: DescribeField[], suffix: string): string | null {
  const f = fields.find((x) => fieldSuffixMatches(x.name, suffix));
  return f?.name ?? null;
}

function pickFieldAny(fields: DescribeField[], suffixes: string[]): string | null {
  for (const s of suffixes) {
    const v = pickField(fields, s);
    if (v) return v;
  }
  return null;
}

function soqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function promptStemFromFileName(fileName: string): string {
  const base = fileName.replace(/\.json$/i, "");
  return base.replace(/(_prompt)?command$/i, "").replace(/_+$/, "").trim();
}

function rewriteHandlerSkillNames(apex: string, stemMap: Map<string, string>): string {
  let out = apex;
  for (const [oldStem, newStem] of Array.from(stemMap.entries())) {
    if (!oldStem || !newStem || oldStem === newStem) continue;
    const esc = oldStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(when\\s+')${esc}(')`, "g"), `$1${newStem}$2`);
  }
  return out;
}

function truncateName(s: string, max: number): string {
  return s.length <= max ? s : s.substring(0, max);
}

function lower(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function picklistValuesBySuffix(fields: DescribeField[], suffix: string): string[] {
  const f = fields.find((x) => fieldSuffixMatches(x.name, suffix)) as
    | (DescribeField & {
        picklistValues?: { value?: string; active?: boolean }[];
      })
    | undefined;
  const vals = f?.picklistValues;
  if (!Array.isArray(vals)) return [];
  return vals
    .filter((v) => v && (v.active ?? true) && typeof v.value === "string")
    .map((v) => String(v.value));
}

function normalizePicklistValue(input: string | undefined, allowed: string[]): string | null {
  const raw = (input ?? "").trim();
  if (!raw || !allowed.length) return null;
  const exact = allowed.find((v) => v === raw);
  if (exact) return exact;
  const lowered = raw.toLowerCase();
  const ci = allowed.find((v) => v.toLowerCase() === lowered);
  if (ci) return ci;
  const compact = lowered.replace(/[\s_\-]/g, "");
  const fuzzy = allowed.find((v) => v.toLowerCase().replace(/[\s_\-]/g, "") === compact);
  return fuzzy ?? null;
}

function coerceActionType(raw: string | undefined, allowed: string[]): string {
  const normalized = normalizePicklistValue(raw, allowed);
  if (normalized) return normalized;
  if (!allowed.length) return raw?.trim() || "Apex";
  const key = lower(raw);
  const candidates: Record<string, string[]> = {
    "canned response": ["Canned Response"],
    "create record": ["Create Record"],
    "update field": ["Update Field"],
    apex: ["Apex"],
    flow: ["Flow"],
    "invoke agent": ["Invoke Agent"],
  };
  for (const preferred of candidates[key] ?? []) {
    const mapped = normalizePicklistValue(preferred, allowed);
    if (mapped) return mapped;
  }
  return allowed[0];
}

function resolveFieldApiName(fields: DescribeField[], requested: string): string | null {
  const raw = requested.trim();
  if (!raw) return null;
  const exact = fields.find((f) => f.name === raw);
  if (exact?.name) return exact.name;
  const ci = fields.find((f) => f.name.toLowerCase() === raw.toLowerCase());
  if (ci?.name) return ci.name;
  const suffix = raw.includes(".") ? raw.split(".").pop() ?? raw : raw;
  const bySuffix = fields.find((f) => fieldSuffixMatches(f.name, suffix));
  return bySuffix?.name ?? null;
}

function picklistValuesForField(fields: DescribeField[], fieldApiName: string): string[] {
  const f = fields.find((x) => x.name === fieldApiName) as
    | (DescribeField & {
        picklistValues?: { value?: string; active?: boolean }[];
      })
    | undefined;
  const vals = f?.picklistValues;
  if (!Array.isArray(vals)) return [];
  return vals
    .filter((v) => v && (v.active ?? true) && typeof v.value === "string")
    .map((v) => String(v.value));
}

function resolveIntentActionInterfaceSymbol(gptfyNamespace?: string): string {
  const raw = gptfyNamespace?.trim();
  if (!raw) return "AIIntentActionInterface";
  const noSuffix = raw.replace(/__$/, "");
  if (!noSuffix) return "AIIntentActionInterface";
  return `${noSuffix}.AIIntentActionInterface`;
}

function sanitizeApexClassName(raw: string, fallback = "GeneratedIntentAction"): string {
  let s = (raw || "").replace(/[^A-Za-z0-9_]/g, "");
  if (!s) s = fallback;
  if (!/^[A-Za-z]/.test(s)) s = `A${s}`;
  if (s.length > 40) s = s.slice(0, 40);
  return s;
}

function buildIntentActionApexStub(
  className: string,
  gptfyNamespace: string | undefined,
  purpose: string
): { body: string; metaXml: string } {
  const iface = resolveIntentActionInterfaceSymbol(gptfyNamespace);
  const escapedPurpose = purpose.replace(/'/g, "\\'");
  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <status>Active</status>
</ApexClass>
`;
  const body = `global with sharing class ${className} implements ${iface} {
    global Map<String, Object> invokeApex(Map<String, Object> request) {
        Map<String, Object> out = new Map<String, Object>{
            'success' => false,
            'status' => 'error',
            'purpose' => '${escapedPurpose}'
        };
        try {
            if (request == null) request = new Map<String, Object>();
            String subject = (String) request.get('subject');
            if (String.isBlank(subject)) {
                subject = 'Intent action: ${escapedPurpose}'.left(80);
            }
            String whatId = (String) request.get('recordId');
            if (Schema.sObjectType.Task.isCreateable()) {
                Task t = new Task(Subject = subject, Status = 'Not Started');
                if (!String.isBlank(whatId)) t.WhatId = whatId;
                insert t;
                out.put('taskId', t.Id);
                out.put('status', 'completed');
                out.put('success', true);
                out.put('message', 'Intent action executed by creating a follow-up task.');
                return out;
            }
            out.put('status', 'noop');
            out.put('success', true);
            out.put('message', 'No create permission on Task, action handled without DML.');
            return out;
        } catch (Exception ex) {
            out.put('message', ex.getMessage());
            return out;
        }
    }
}`;
  return { body, metaXml };
}

function buildNoopAutolaunchedFlowMeta(flowApiName: string): string {
  const label = flowApiName.replace(/_/g, " ").trim() || flowApiName;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <label>${label}</label>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>
</Flow>
`;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

function preflightValidateHandlerApex(apex: string, availableObjects?: Set<string>): string[] {
  const issues: string[] = [];
  issues.push(...getHandlerStructuralIssues(apex));
  if (/'[A-Za-z0-9_]+'\s*:/.test(apex)) {
    issues.push("JS-style key:value syntax detected; Apex Map literals must use =>");
  }
  if (/\bif\s*\([^)]*\bAND\b/i.test(apex) || /\bif\s*\([^)]*\bOR\b/i.test(apex)) {
    issues.push("Invalid boolean operators in if-condition; use && and ||");
  }
  if (/Schema\.sObjectType\.get\s*\(/.test(apex)) {
    issues.push("Invalid Schema.sObjectType.get(...) pattern detected");
  }
  if (/case\s+'[^']+'\s*:/.test(apex) || /\bcase\s+[A-Za-z0-9_]+\s*:/.test(apex)) {
    issues.push("Java-style switch case syntax detected; use switch on ... when ...");
  }
  if (availableObjects && availableObjects.size > 0) {
    const missing = extractReferencedObjectsFromApex(apex).filter(
      (obj) => !availableObjects.has(obj)
    );
    if (missing.length > 0) {
      issues.push(
        `Handler references unavailable objects: ${Array.from(new Set(missing)).join(", ")}`
      );
    }
  }
  return issues;
}

function extractReferencedObjectsFromApex(apex: string): string[] {
  const refs = new Set<string>();
  const primitiveOrUtility = new Set([
    "string",
    "integer",
    "long",
    "double",
    "decimal",
    "boolean",
    "date",
    "datetime",
    "time",
    "id",
    "object",
    "sobject",
    "sobjecttype",
    "map",
    "list",
    "set",
    "schema",
    "system",
    "exception",
    "userinfo",
    "math",
    "json",
  ]);
  const take = (re: RegExp) => {
    let m: RegExpExecArray | null = null;
    while ((m = re.exec(apex)) !== null) {
      const name = (m[1] ?? "").trim();
      if (!name) continue;
      if (primitiveOrUtility.has(name.toLowerCase())) continue;
      refs.add(name);
    }
  };
  take(/\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)\b/gi);
  take(/\bnew\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g);
  take(/\bSchema\.sObjectType\.([A-Za-z_][A-Za-z0-9_]*)\b/g);
  take(/\b(?:List|Set)\s*<\s*([A-Za-z_][A-Za-z0-9_]*)\s*>/g);
  return Array.from(refs);
}

function resolveAgenticInterfaceSymbol(gptfyNamespace?: string): string {
  const raw = gptfyNamespace?.trim();
  if (!raw) return "AIAgenticInterface";
  const noSuffix = raw.replace(/__$/, "");
  if (!noSuffix) return "AIAgenticInterface";
  return `${noSuffix}.AIAgenticInterface`;
}

function buildSafeFallbackHandlerApex(
  handlerClass: string,
  gptfyNamespace: string | undefined,
  skillNames: string[]
): string {
  const iface = resolveAgenticInterfaceSymbol(gptfyNamespace);
  const uniqueSkills = Array.from(new Set(skillNames.filter(Boolean)));
  const switchBranches = uniqueSkills.length
    ? uniqueSkills
        .map(
          (s) => `                when '${s}' {
                    return ok(new Map<String, Object>{
                        'status' => 'fallback',
                        'skill' => '${s}',
                        'message' => 'Fallback handler executed. Replace generated logic for full behavior.'
                    });
                }`
        )
        .join("\n")
    : `                when 'health_Check_Agent' {
                    return ok(new Map<String, Object>{
                        'status' => 'fallback',
                        'message' => 'Fallback handler executed. Replace generated logic for full behavior.'
                    });
                }`;
  return `global with sharing class ${handlerClass} implements ${iface} {
    private String err(String msg) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'error',
            'message' => msg
        });
    }

    private String ok(Map<String, Object> body) {
        body.put('success', true);
        return JSON.serialize(body);
    }

    global String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            if (parameters == null) parameters = new Map<String, Object>();
            switch on requestParam {
${switchBranches}
                when else {
                    return err('Unsupported skill: ' + requestParam);
                }
            }
        } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, '${handlerClass} | EXCEPTION | ' + ex.getMessage());
            return err(ex.getMessage());
        }
    }
}`;
}

function sanitizePromptCommandAgainstOrg(
  content: string,
  availableObjects: Set<string>
): { content: string; changed: boolean; skipped: boolean; note?: string } {
  if (availableObjects.size === 0) return { content, changed: false, skipped: false };
  try {
    const parsed = JSON.parse(content) as {
      properties?: Record<string, { enum?: unknown[]; const?: unknown; default?: unknown }>;
      required?: string[];
      [k: string]: unknown;
    };
    if (!parsed || typeof parsed !== "object") return { content, changed: false, skipped: false };
    const props = parsed.properties ?? {};
    let changed = false;
    const removedProps: string[] = [];
    for (const key of Object.keys(props)) {
      const norm = key.toLowerCase();
      const looksLikeObjectSelector =
        norm.includes("objectapi") ||
        norm.includes("object_name") ||
        norm === "object" ||
        norm.includes("sobject");
      if (!looksLikeObjectSelector) continue;
      const p = props[key];
      if (Array.isArray(p?.enum)) {
        const next = p.enum.filter((v) => typeof v !== "string" || availableObjects.has(v));
        if (next.length !== p.enum.length) {
          p.enum = next;
          changed = true;
        }
        if (next.length === 0) {
          delete props[key];
          removedProps.push(key);
          changed = true;
        }
      } else if (typeof p?.const === "string" && !availableObjects.has(p.const)) {
        delete props[key];
        removedProps.push(key);
        changed = true;
      } else if (typeof p?.default === "string" && !availableObjects.has(p.default)) {
        delete p.default;
        changed = true;
      }
    }
    if (removedProps.length > 0 && Array.isArray(parsed.required)) {
      parsed.required = parsed.required.filter((k) => !removedProps.includes(String(k)));
      changed = true;
    }
    if (!changed) return { content, changed: false, skipped: false };
    return {
      content: JSON.stringify(parsed, null, 2),
      changed: true,
      skipped: false,
      note: removedProps.length ? `removed unsupported object selector fields: ${removedProps.join(", ")}` : "normalized object selector defaults/enums",
    };
  } catch {
    return { content, changed: false, skipped: false };
  }
}

function isMetadataUnavailableError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("no such column") ||
    t.includes("invalid_field") ||
    t.includes("sobject type") && t.includes("not supported") ||
    t.includes("entity type") && t.includes("cannot be queried")
  );
}

async function generateIntentActionApexWithOpenAI(args: {
  className: string;
  interfaceSymbol: string;
  intentName: string;
  actionType: string;
  purpose: string;
  model?: string;
  apiKey: string;
}): Promise<string | null> {
  const system = `You generate production-ready Salesforce Apex for GPTfy intent actions.
Return ONLY Apex code (no markdown).
Requirements:
- global with sharing class ${args.className} implements ${args.interfaceSymbol}
- Must include: global Map<String, Object> invokeApex(Map<String, Object> request)
- Must include try/catch and safe null handling for request
- Must perform meaningful action for the purpose (avoid no-op placeholder)
- Use CRUD checks before DML
- Return Map with keys: success (Boolean), status (String), message (String)
- Keep implementation concise and compile-safe in API 59.0`;
  const user = JSON.stringify({
    intentName: args.intentName,
    actionType: args.actionType,
    purpose: args.purpose,
  });
  const payload = JSON.stringify({
    model: args.model || "gpt-4.1",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = parsed.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const apex = stripCodeFences(content);
    if (!apex.includes(`class ${args.className}`)) return null;
    if (!apex.includes(`implements ${args.interfaceSymbol}`)) return null;
    if (!/invokeApex\s*\(\s*Map<\s*String\s*,\s*Object\s*>\s*request\s*\)/.test(apex)) return null;
    return apex;
  } catch {
    return null;
  }
}

async function sfDataFetch(
  instanceUrl: string,
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json?: unknown; text: string }> {
  const base = instanceUrl.replace(/\/$/, "");
  const url = `${base}/services/data/${API_VER}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers as object),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function runQuery(
  instanceUrl: string,
  accessToken: string,
  q: string
): Promise<Record<string, unknown>[]> {
  const path = `query?q=${encodeURIComponent(q)}`;
  const r = await sfDataFetch(instanceUrl, accessToken, path);
  if (!r.ok) {
    throw new Error(`SOQL failed: ${r.text.slice(0, 500)}`);
  }
  if (!r.json || typeof r.json !== "object") return [];
  // Salesforce query errors often come back as an array of { message, errorCode }.
  if (Array.isArray(r.json) && r.json.length > 0) {
    const first = r.json[0] as { message?: unknown };
    if (typeof first?.message === "string") {
      throw new Error(`SOQL failed: ${first.message}`);
    }
  }
  const recs = (r.json as { records?: Record<string, unknown>[] }).records;
  return Array.isArray(recs) ? recs : [];
}

async function resolveApiName(
  instanceUrl: string,
  accessToken: string,
  local: string
): Promise<string> {
  const r = await resolveObjectName(instanceUrl, accessToken, API_VER, local);
  if (!r.found) throw new Error(`SObject not installed: ${local} (tried ${r.tried.join(", ")})`);
  return r.apiName;
}

/**
 * Full deploy: Apex metadata → prompts → agent → skills → activate → intent skeleton.
 */
export async function deployBundleToConnectedOrg(
  session: SfSessionData,
  bundle: GeneratedBundle,
  onSessionPersist: () => Promise<void>,
  options?: DeployBundleOptions
): Promise<OrgDeployResult> {
  const steps: DeployStep[] = [];
  const errors: string[] = [];
  const pushErr = (msg: string) => {
    errors.push(msg);
    options?.onDeployError?.(msg);
  };
  const addStep = (step: string, ok: boolean, detail?: string) => {
    const row: DeployStep = { step, ok, detail };
    steps.push(row);
    options?.onDeployStep?.(row);
  };

  let token = session.accessToken!;
  const instanceUrl = session.instanceUrl!;

  async function ensureToken(): Promise<boolean> {
    const ok = await refreshSalesforceAccessToken(session);
    if (ok) {
      token = session.accessToken!;
      await onSessionPersist();
      return true;
    }
    return false;
  }

  async function fetchWithRefresh(
    path: string,
    init?: RequestInit
  ): Promise<Awaited<ReturnType<typeof sfDataFetch>>> {
    let r = await sfDataFetch(instanceUrl, token, path, init);
    if (r.status === 401) {
      if (await ensureToken()) {
        r = await sfDataFetch(instanceUrl, token, path, init);
      }
    }
    return r;
  }

  let deployAgentMeta: { deployedAgentId: string; agentObjectApiName: string } | undefined;

  try {
    const skillOnly = options?.skillArtifactsOnly === true;
    const skipIntents = options?.skipIntents === true || skillOnly;
    const plans: IntentDeployPlan[] =
      skipIntents ? []
      : bundle.intentDeployPlan?.length ?
        bundle.intentDeployPlan
      : defaultIntentDeployPlan(
          bundle.parameters.agentDeveloperName,
          bundle.parameters.agentName
        );

    const promptApi = await resolveApiName(instanceUrl, token, "AI_Prompt__c");
    const agentApi = await resolveApiName(instanceUrl, token, "AI_Agent__c");
    const connApi = await resolveApiName(instanceUrl, token, "AI_Connection__c");
    const mapApi = await resolveApiName(instanceUrl, token, "AI_Data_Extraction_Mapping__c");
    const skillApi = await resolveApiName(instanceUrl, token, "AI_Agent_Skill__c");

    const pDesc = await describeSObject(instanceUrl, token, API_VER, promptApi);
    const aDesc = await describeSObject(instanceUrl, token, API_VER, agentApi);
    const cDesc = await describeSObject(instanceUrl, token, API_VER, connApi);
    const skDesc = await describeSObject(instanceUrl, token, API_VER, skillApi);

    let intentApi = "";
    let actionApi = "";
    let detailApi = "";
    let iDesc: Awaited<ReturnType<typeof describeSObject>> | null = null;
    let actDesc: Awaited<ReturnType<typeof describeSObject>> | null = null;
    let dDesc: Awaited<ReturnType<typeof describeSObject>> | null = null;

    if (!skipIntents) {
      intentApi = await resolveApiName(instanceUrl, token, "AI_Agent_Intent__c");
      actionApi = await resolveApiName(instanceUrl, token, "AI_Intent_Action__c");
      detailApi = await resolveApiName(instanceUrl, token, "AI_Intent_Action_Detail__c");
      iDesc = await describeSObject(instanceUrl, token, API_VER, intentApi);
      actDesc = await describeSObject(instanceUrl, token, API_VER, actionApi);
      dDesc = await describeSObject(instanceUrl, token, API_VER, detailApi);
    }

    if (!pDesc.ok || !aDesc.ok || !cDesc.ok || !skDesc.ok) {
      throw new Error("Describe failed for one or more GPTfy objects");
    }
    if (!skipIntents && (!iDesc?.ok || !actDesc?.ok || !dDesc?.ok)) {
      throw new Error("Describe failed for one or more GPTfy intent objects");
    }

    const pf = pDesc.body.fields;
    const cf = cDesc.body.fields;
    const skf = skDesc.body.fields;
    const skillAgentFld = pickField(skf, "AI_Agent__c");
    const skillPromptFld = pickField(skf, "AI_Prompt__c");
    if (!skillAgentFld || !skillPromptFld) {
      throw new Error("Could not resolve AI_Agent_Skill__c lookup fields");
    }
    const af = aDesc.body.fields;

    const fExt = pickField(pf, "External_Id__c");
    const fCmd = pickField(pf, "Prompt_Command__c");
    const fClass = pickField(pf, "Agentic_Function_Class__c");
    const fConn = pickField(pf, "AI_Connection__c");
    const fMap = pickField(pf, "AI_Data_Extraction_Mapping__c");
    const fType = pickField(pf, "Type__c");
    const fStat = pickField(pf, "Status__c");
    const fConnType = pickField(cf, "Type__c");

    const fDev = pickField(af, "Developer_Name__c");
    const fModel = pickField(af, "AI_Model__c");
    const fSys = pickField(af, "System_Prompt__c");
    const fDesc = pickField(af, "Description__c");
    const fAgStat = pickField(af, "Status__c");

    let fIntAgent: string | null = null;
    let fIntSeq: string | null = null;
    let fIntActive: string | null = null;
    let fIntDesc: string | null = null;
    let fActIntent: string | null = null;
    let fActSeq: string | null = null;
    let fActType: string | null = null;
    let fActDesc: string | null = null;
    let fActActive: string | null = null;
    let fLang: string | null = null;
    let fCanned: string | null = null;
    let fObj: string | null = null;
    let fFlow: string | null = null;
    let fApex: string | null = null;
    let fApexRet: string | null = null;
    let actionTypePicklist: string[] = [];
    let languagePicklist: string[] = [];
    let apexReturnPicklist: string[] = [];
    const objectDescribeCache = new Map<string, DescribeField[]>();
    let fDetAct: string | null = null;
    let fDetField: string | null = null;
    let fDetType: string | null = null;
    let fDetVal: string | null = null;
    let fDetActive: string | null = null;
    let detailTypePicklist: string[] = [];

    if (!skipIntents && iDesc?.ok && actDesc?.ok && dDesc?.ok) {
      const intf = iDesc.body.fields;
      const actf = actDesc.body.fields;
      const dtf = dDesc.body.fields;

      fIntAgent = pickField(intf, "AI_Agent__c");
      fIntSeq = pickField(intf, "Sequence__c") ?? pickField(intf, "Seq__c");
      fIntActive = pickField(intf, "Is_Active__c");
      fIntDesc = pickField(intf, "Description__c");

      fActIntent = pickFieldAny(actf, ["AI_Agent_Intent__c", "Intent__c"]);
      fActSeq = pickField(actf, "Sequence__c") ?? pickField(actf, "Seq__c");
      fActType = pickField(actf, "Action_Type__c");
      fActDesc = pickFieldAny(actf, ["Description__c", "Action_Description__c"]);
      fActActive = pickFieldAny(actf, ["Is_Active__c", "Active__c"]);
      fLang = pickField(actf, "Language__c");
      fCanned = pickFieldAny(actf, [
        "Canned_Response_Text__c",
        "Canned_Response__c",
        "Response_Text__c",
      ]);
      fObj = pickFieldAny(actf, ["Object_API_Name__c", "Object_Name__c", "Object__c"]);
      fFlow = pickFieldAny(actf, ["Flow_API_Name__c", "Flow_Name__c", "Flow__c"]);
      fApex = pickFieldAny(actf, ["Apex_Class_Name__c", "Apex_Class__c"]);
      fApexRet = pickFieldAny(actf, ["Apex_Return_Type__c", "Return_Type__c"]);
      actionTypePicklist = picklistValuesBySuffix(actf, "Action_Type__c");
      languagePicklist = picklistValuesBySuffix(actf, "Language__c");
      apexReturnPicklist = picklistValuesBySuffix(actf, "Apex_Return_Type__c");

      fDetAct = pickFieldAny(dtf, ["AI_Intent_Action__c", "Intent_Action__c"]);
      fDetField = pickFieldAny(dtf, ["Field_API_Name__c", "Field_Name__c"]);
      fDetType = pickField(dtf, "Type__c");
      fDetVal = pickFieldAny(dtf, [
        "Hardcoded_Value_Or_AI_Instruction__c",
        "Value_Or_AI_Instruction__c",
        "Value__c",
        "AI_Description__c",
      ]);
      fDetActive = pickField(dtf, "Is_Active__c");
      detailTypePicklist = picklistValuesBySuffix(dtf, "Type__c");
    }

    const requiredPrompt = [fExt, fCmd, fClass, fConn, fMap, fType, fStat];
    if (requiredPrompt.some((x) => !x)) {
      throw new Error(
        `Missing AI_Prompt__c fields for deploy: ${requiredPrompt.map((x) => x ?? "?").join(", ")}`
      );
    }
    if (!fConnType) {
      throw new Error("Missing AI_Connection__c field: Type__c");
    }

    const sObjRes = await fetchWithRefresh("sobjects");
    const availableObjects = new Set<string>();
    if (sObjRes.ok && sObjRes.json && typeof sObjRes.json === "object") {
      const rows = (sObjRes.json as { sobjects?: { name?: string }[] }).sobjects;
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const name = String(row?.name ?? "").trim();
          if (name) availableObjects.add(name);
        }
      }
    }
    addStep(
      "Load org object catalog",
      availableObjects.size > 0,
      availableObjects.size > 0 ? `${availableObjects.size} objects` : "Could not load sobjects list"
    );

    // Guard against org-wide skill-name collisions before we deploy/update handler + prompts.
    // If a prompt Name already exists for a different external id, rename the new skill stem
    // and rewrite handler switch branches to keep skill dispatch aligned.
    const extPrefix = bundle.parameters.externalIdPrefix;
    const intended = bundle.promptCommands
      .map((pc, idx) => ({
        idx,
        oldStem: promptStemFromFileName(pc.fileName),
      }))
      .filter((x) => Boolean(x.oldStem));
    const intendedNames = intended.map((x) => String(x.oldStem));
    const intendedExts = intendedNames.map((n) => `${extPrefix}${n}`);
    const qNames =
      intendedNames.length ?
        `SELECT Id, Name, ${fExt!}, ${fClass!} FROM ${promptApi} WHERE Name IN (${intendedNames.map((n) => `'${soqlEscape(n)}'`).join(",")})`
      : "";
    const qExts =
      intendedExts.length ?
        `SELECT Id, Name, ${fExt!}, ${fClass!} FROM ${promptApi} WHERE ${fExt!} IN (${intendedExts.map((e) => `'${soqlEscape(e)}'`).join(",")})`
      : "";
    const nameRows = qNames ? await runQuery(instanceUrl, token, qNames) : [];
    const extRows = qExts ? await runQuery(instanceUrl, token, qExts) : [];
    const extSeen = new Map<string, Record<string, unknown>>();
    for (const r of extRows) {
      const extVal = String(r[fExt!] ?? "");
      if (extVal) extSeen.set(extVal, r);
    }
    const usedNames = new Set(
      nameRows.map((r) => String(r.Name ?? "")).filter(Boolean).map((n) => n.toLowerCase())
    );
    const renameMap = new Map<string, string>();
    const renameNotes: string[] = [];
    for (const item of intended) {
      const oldStem = String(item.oldStem);
      const extVal = `${extPrefix}${oldStem}`;
      // Same external id means this is our managed skill; safe to keep stem.
      if (extSeen.has(extVal)) continue;
      let finalStem = oldStem;
      let suffix = 2;
      while (usedNames.has(finalStem.toLowerCase())) {
        finalStem = `${oldStem}_${suffix++}`;
      }
      usedNames.add(finalStem.toLowerCase());
      if (finalStem !== oldStem) {
        renameMap.set(oldStem, finalStem);
        bundle.promptCommands[item.idx] = {
          ...bundle.promptCommands[item.idx],
          fileName: `${finalStem}_PromptCommand.json`,
        };
        renameNotes.push(`${oldStem} -> ${finalStem}`);
      }
    }
    if (renameMap.size > 0) {
      bundle.handlerApex = rewriteHandlerSkillNames(bundle.handlerApex, renameMap);
      addStep(
        "Resolve skill name collisions",
        true,
        `renamed ${renameMap.size} skill(s): ${renameNotes.join(", ")}`
      );
    } else {
      addStep("Resolve skill name collisions", true, "no conflicts found");
    }

    let handlerApexToDeploy = bundle.handlerApex;
    if (options?.mergeExistingHandler !== false) {
      const tq = `SELECT Body FROM ApexClass WHERE Name = '${soqlEscape(bundle.parameters.handlerClass)}' LIMIT 1`;
      const tr = await fetchWithRefresh(`tooling/query?q=${encodeURIComponent(tq)}`);
      let orgBody: string | null = null;
      if (tr.ok && tr.json && typeof tr.json === "object") {
        const recs = (tr.json as { records?: { Body?: string }[] }).records;
        const b = recs?.[0]?.Body;
        orgBody = typeof b === "string" && b.trim() ? b : null;
      }
      if (orgBody?.trim()) {
        try {
          const merged = mergeHandlerApexWithOrg(orgBody, handlerApexToDeploy, {
            overwriteMatchingSkills: options?.overwriteMatchingSkills === true,
            removeSkillsNotInBundle: options?.removeSkillsNotInBundle === true,
          });
          handlerApexToDeploy = merged;
          addStep(
            "Merge handler with org",
            true,
            [
              options?.overwriteMatchingSkills ? "overwrite matching skills" : null,
              options?.removeSkillsNotInBundle ? "sync skill list to bundle" : null,
            ]
              .filter(Boolean)
              .join("; ") || "additive merge (org wins on name clash)"
          );
        } catch (e) {
          addStep(
            "Merge handler with org",
            false,
            (e as Error).message?.slice(0, 200) ?? "merge failed"
          );
        }
      } else {
        addStep(
          "Merge handler with org",
          true,
          "No existing Apex class body in org (or class missing) — deploying generated handler only"
        );
      }
    }

    handlerApexToDeploy = repairCaseCommentCaseIdToParentId(handlerApexToDeploy);
    handlerApexToDeploy = repairHandlerApexCommonIssues(handlerApexToDeploy);

    const soqlFieldIssues = await preflightValidateHandlerSoqlCustomFields(
      instanceUrl,
      token,
      API_VER,
      handlerApexToDeploy
    );
    addStep(
      "Validate handler SOQL fields (describe)",
      soqlFieldIssues.length === 0,
      soqlFieldIssues.length === 0 ?
        "Custom __c fields in bracket SOQL match org describe"
      : soqlFieldIssues.slice(0, 4).join(" · ")
    );
    if (soqlFieldIssues.length > 0) {
      for (const msg of soqlFieldIssues) {
        pushErr(`SOQL field: ${msg}`);
      }
      return { ok: false, steps, errors };
    }

    const preflightIssues = preflightValidateHandlerApex(handlerApexToDeploy, availableObjects);
    if (preflightIssues.length > 0) {
      const onlyUnavailableObjectIssue = preflightIssues.every((x) =>
        x.startsWith("Handler references unavailable objects:")
      );
      if (onlyUnavailableObjectIssue) {
        const skillNames = bundle.promptCommands
          .map((pc) => promptStemFromFileName(pc.fileName))
          .filter(Boolean);
        handlerApexToDeploy = buildSafeFallbackHandlerApex(
          bundle.parameters.handlerClass,
          session.gptfyNamespace,
          skillNames
        );
        addStep(
          "Preflight validate handler Apex",
          true,
          `Unavailable objects in generated handler; deployed safe fallback handler instead (${preflightIssues.join(" | ")})`
        );
      } else {
        const reason = preflightIssues.join(" | ");
        addStep("Preflight validate handler Apex", false, reason);
        pushErr(`Handler Apex preflight failed: ${reason}`);
        return { ok: false, steps, errors };
      }
    } else {
      addStep("Preflight validate handler Apex", true);
    }

    const meta = await deployApexClassMetadata(
      instanceUrl,
      token,
      bundle.parameters.handlerClass,
      handlerApexToDeploy,
      bundle.handlerMetaXml
    );
    if (!meta.ok) {
      addStep("Deploy Apex class", false, meta.message);
      pushErr(`Apex deploy: ${meta.message}`);
      return { ok: false, steps, errors };
    }
    addStep("Deploy Apex class", true, bundle.parameters.handlerClass);
    bundle.handlerApex = handlerApexToDeploy;

    let promptConnId: string | null = null;
    for (const name of [
      bundle.parameters.connectionName,
      "OpenAI-4/ChatGPT",
      "GPTfy",
    ]) {
      const rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${connApi} WHERE Name = '${soqlEscape(name)}' LIMIT 1`
      );
      if (rows[0]?.Id) {
        promptConnId = String(rows[0].Id);
        break;
      }
    }
    if (!promptConnId) {
      throw new Error("No AI_Connection__c found for prompt (try GPTfy / OpenAI names)");
    }

    let agentModelId: string | null = null;
    if (!skillOnly) {
      const pref = bundle.parameters.agentModelConnectionName;
      let rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${connApi} WHERE ${fConnType} = 'Agentic' AND Name = '${soqlEscape(pref)}' LIMIT 1`
      );
      if (rows[0]?.Id) agentModelId = String(rows[0].Id);
      if (!agentModelId) {
        rows = await runQuery(
          instanceUrl,
          token,
          `SELECT Id FROM ${connApi} WHERE ${fConnType} = 'Agentic' ORDER BY LastModifiedDate DESC LIMIT 1`
        );
        if (rows[0]?.Id) agentModelId = String(rows[0].Id);
      }
      if (!agentModelId) {
        throw new Error("No AI_Connection__c with Type__c = Agentic for AI_Model__c");
      }
    }

    let rows = await runQuery(
      instanceUrl,
      token,
      `SELECT Id FROM ${mapApi} WHERE Name = '${soqlEscape(bundle.parameters.dataMappingName)}' LIMIT 1`
    );
    if (!rows[0]?.Id) {
      throw new Error(
        `No AI_Data_Extraction_Mapping__c named "${bundle.parameters.dataMappingName}"`
      );
    }
    const mapId = String(rows[0].Id);

    addStep("Resolve connections & mapping", true);

    const handlerName = bundle.parameters.handlerClass;

    const promptNotes: string[] = [];
    for (const pc of bundle.promptCommands) {
      const stem = promptStemFromFileName(pc.fileName);
      if (!stem) continue;
      const extVal = `${extPrefix}${stem}`;
      const sanitizedPrompt = sanitizePromptCommandAgainstOrg(pc.content, availableObjects);
      if (sanitizedPrompt.changed && sanitizedPrompt.note) {
        promptNotes.push(`${stem}: ${sanitizedPrompt.note}`);
      }
      const body: Record<string, unknown> = {
        Name: truncateName(stem, 80),
        [fType!]: "Agentic",
        [fStat!]: "Active",
        [fConn!]: promptConnId,
        [fMap!]: mapId,
        [fCmd!]: sanitizedPrompt.content,
        [fClass!]: handlerName,
      };

      const path = `sobjects/${encodeURIComponent(promptApi)}/${encodeURIComponent(fExt!)}/${encodeURIComponent(extVal)}`;
      const patch = await fetchWithRefresh(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!patch.ok) {
        throw new Error(`Prompt upsert failed ${stem}: ${patch.text.slice(0, 400)}`);
      }
    }
    addStep(
      `Upsert ${bundle.promptCommands.length} AI_Prompt__c`,
      true,
      promptNotes.length ? `normalized ${promptNotes.length} prompt command(s)` : undefined
    );

    const bundleStemSet = new Set(
      bundle.promptCommands.map((pc) => promptStemFromFileName(pc.fileName)).filter(Boolean)
    );
    if (options?.removeSkillsNotInBundle === true && fClass && !skillOnly) {
      const orphanPrompts = await runQuery(
        instanceUrl,
        token,
        `SELECT Id, ${fExt!} FROM ${promptApi} WHERE ${fClass!} = '${soqlEscape(handlerName)}'`
      );
      let deletedPrompts = 0;
      for (const row of orphanPrompts) {
        const extVal = String(row[fExt!] ?? "");
        if (!extVal.startsWith(extPrefix)) continue;
        const stem = extVal.slice(extPrefix.length);
        if (bundleStemSet.has(stem)) continue;
        const pid = String(row.Id);
        const skillRows = await runQuery(
          instanceUrl,
          token,
          `SELECT Id FROM ${skillApi} WHERE ${skillPromptFld} = '${soqlEscape(pid)}'`
        );
        for (const sj of skillRows) {
          await fetchWithRefresh(`sobjects/${skillApi}/${String(sj.Id)}`, { method: "DELETE" });
        }
        const delP = await fetchWithRefresh(`sobjects/${promptApi}/${pid}`, { method: "DELETE" });
        if (delP.ok) deletedPrompts++;
      }
      if (deletedPrompts > 0) {
        addStep("Remove prompts not in bundle", true, String(deletedPrompts));
      }
    }

    const extKeys = bundle.promptCommands
      .map((pc) => `${extPrefix}${promptStemFromFileName(pc.fileName)}`)
      .filter(Boolean);
    const inList = extKeys.map((k) => `'${soqlEscape(k)}'`).join(",");
    const promptRows =
      extKeys.length > 0 ?
        await runQuery(
          instanceUrl,
          token,
          `SELECT Id, ${fExt!} FROM ${promptApi} WHERE ${fExt!} IN (${inList})`
        )
      : [];
    const promptIds = promptRows.map((r) => String(r.Id));
    if (promptIds.length === 0) {
      throw new Error(
        "No AI_Prompt__c rows found after upsert — check External_Id__c and permissions."
      );
    }

    let agentId: string | undefined;
    if (skillOnly) {
      for (const pr of promptRows) {
        const pid = String(pr.Id);
        await fetchWithRefresh(`sobjects/${promptApi}/${pid}`, {
          method: "PATCH",
          body: JSON.stringify({ [fStat!]: "Active" }),
        });
      }
      addStep("Activate AI_Prompt__c records", true);
      addStep(
        "Skill artifacts only",
        true,
        "Handler + AI_Prompt__c deployed. Add these prompts to an agent in GPTfy (link AI_Prompt__c via AI_Agent_Skill__c) — no AI_Agent__c deploy in this mode."
      );
    } else {
      const devName = bundle.parameters.agentDeveloperName;
      const tid = options?.targetAgentId?.trim();
      const useTargetId =
        tid && /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(tid) ? tid : undefined;

      if (useTargetId) {
        agentId = useTargetId;
        const patchBody: Record<string, unknown> = {
          [fModel!]: agentModelId,
          [fSys!]: bundle.agentSystemPrompt,
          [fDesc!]: bundle.agentDescription,
          [fAgStat!]: "Draft",
          [fDev!]: devName,
        };
        const pr = await fetchWithRefresh(`sobjects/${agentApi}/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify(patchBody),
        });
        if (!pr.ok) throw new Error(`Agent update failed: ${pr.text.slice(0, 300)}`);
      } else {
        let agentRows = await runQuery(
          instanceUrl,
          token,
          `SELECT Id FROM ${agentApi} WHERE ${fDev!} = '${soqlEscape(devName)}' LIMIT 1`
        );
        if (agentRows[0]?.Id) {
          agentId = String(agentRows[0].Id);
          const patchBody: Record<string, unknown> = {
            [fModel!]: agentModelId,
            [fSys!]: bundle.agentSystemPrompt,
            [fDesc!]: bundle.agentDescription,
            [fAgStat!]: "Draft",
          };
          const pr = await fetchWithRefresh(`sobjects/${agentApi}/${agentId}`, {
            method: "PATCH",
            body: JSON.stringify(patchBody),
          });
          if (!pr.ok) throw new Error(`Agent update failed: ${pr.text.slice(0, 300)}`);
        } else {
          const insertBody: Record<string, unknown> = {
            Name: bundle.parameters.agentName,
            [fDev!]: devName,
            [fModel!]: agentModelId,
            [fSys!]: bundle.agentSystemPrompt,
            [fDesc!]: bundle.agentDescription,
            [fAgStat!]: "Draft",
          };
          const ir = await fetchWithRefresh(`sobjects/${agentApi}`, {
            method: "POST",
            body: JSON.stringify(insertBody),
          });
          if (!ir.ok) throw new Error(`Agent insert failed: ${ir.text.slice(0, 400)}`);
          const id = (ir.json as { id?: string })?.id;
          if (!id) throw new Error("Agent insert returned no id");
          agentId = id;
        }
      }
      addStep(
        "Upsert AI_Agent__c",
        true,
        useTargetId ? `${agentId} (matched org row by Id; Developer Name set to bundle)` : agentId
      );

      deployAgentMeta = { deployedAgentId: agentId, agentObjectApiName: agentApi };

      const inPrompts = promptIds.map((id) => `'${soqlEscape(id)}'`).join(",");
      const skillDel = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${skillApi} WHERE ${skillAgentFld} = '${soqlEscape(agentId)}' AND ${skillPromptFld} IN (${inPrompts})`
      );

      for (const s of skillDel) {
        await fetchWithRefresh(`sobjects/${skillApi}/${s.Id}`, { method: "DELETE" });
      }

      for (const pid of promptIds) {
        const sb: Record<string, unknown> = {
          [skillAgentFld!]: agentId,
          [skillPromptFld!]: pid,
        };
        const sr = await fetchWithRefresh(`sobjects/${skillApi}`, {
          method: "POST",
          body: JSON.stringify(sb),
        });
        if (!sr.ok) {
          pushErr(`Skill insert failed: ${sr.text.slice(0, 200)}`);
        }
      }
      addStep("Rebuild AI_Agent_Skill__c junctions", true, String(promptIds.length));

      for (const pr of promptRows) {
        const pid = String(pr.Id);
        await fetchWithRefresh(`sobjects/${promptApi}/${pid}`, {
          method: "PATCH",
          body: JSON.stringify({ [fStat!]: "Active" }),
        });
      }
      addStep("Activate AI_Prompt__c records", true);
    }

    if (!skipIntents) {
    // Auto-provision dependencies used by intent actions before creating rows/publishing.
    const referencedApex = new Set<string>();
    const referencedFlows = new Set<string>();
    const apexPurpose = new Map<string, string>();
    const provisionErrors: string[] = [];
    const provisionNotes: string[] = [];
    const openaiKey = await getOpenAIApiKey();
    const openaiModel = getOpenAIModel();

    const ensureApexDependency = async (
      className: string,
      purpose: string
    ): Promise<boolean> => {
      let rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ApexClass WHERE Name = '${soqlEscape(className)}' LIMIT 1`
      );
      if (rows[0]?.Id) return true;

      const iface = resolveIntentActionInterfaceSymbol(session.gptfyNamespace);
      let aiBody =
        openaiKey ?
          await generateIntentActionApexWithOpenAI({
            className,
            interfaceSymbol: iface,
            intentName: className,
            actionType: "Apex",
            purpose,
            model: openaiModel,
            apiKey: openaiKey,
          })
        : null;
      if (aiBody && availableObjects.size > 0) {
        const missing = extractReferencedObjectsFromApex(aiBody).filter(
          (obj) => !availableObjects.has(obj)
        );
        if (missing.length > 0) {
          aiBody = null;
          provisionNotes.push(
            `Apex dependency ${className}: skipped AI body due to unavailable objects (${Array.from(
              new Set(missing)
            ).join(", ")}), using safe fallback`
          );
        }
      }
      const fallback = buildIntentActionApexStub(className, session.gptfyNamespace, purpose);
      // Try AI-generated class first (if available), then hard fallback stub if compile fails.
      // This prevents org-specific field assumptions from blocking deploy.
      if (aiBody) {
        const aiDep = await deployApexClassMetadata(
          instanceUrl,
          token,
          className,
          aiBody,
          fallback.metaXml
        );
        if (!aiDep.ok) {
          provisionNotes.push(
            `Apex dependency ${className}: AI class failed compile, using safe fallback stub`
          );
          const fbDep = await deployApexClassMetadata(
            instanceUrl,
            token,
            className,
            fallback.body,
            fallback.metaXml
          );
          if (!fbDep.ok) {
            provisionErrors.push(
              `Could not auto-create Apex dependency ${className}: AI=${aiDep.message} | fallback=${fbDep.message}`
            );
            return false;
          }
        }
      } else {
        const dep = await deployApexClassMetadata(
          instanceUrl,
          token,
          className,
          fallback.body,
          fallback.metaXml
        );
        if (!dep.ok) {
          provisionErrors.push(`Could not auto-create Apex dependency ${className}: ${dep.message}`);
          return false;
        }
      }
      rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ApexClass WHERE Name = '${soqlEscape(className)}' LIMIT 1`
      );
      if (!rows[0]?.Id) {
        provisionErrors.push(`Apex dependency ${className} still missing after deploy`);
        return false;
      }
      provisionNotes.push(`Auto-created Apex dependency: ${className}`);
      return true;
    };

    for (const plan of plans) {
      for (const act of plan.actions) {
        const kind = lower(act.actionType);
        const purpose = [
          `Intent=${plan.name}`,
          plan.description ? `IntentDescription=${plan.description}` : "",
          `ActionType=${act.actionType}`,
        ]
          .filter(Boolean)
          .join(" | ");

        if (kind === "apex") {
          const cls = (act.apexClass ?? "").trim();
          const generatedClass = sanitizeApexClassName(`${plan.name}_IntentAction`);
          const finalClass =
            !cls || cls === bundle.parameters.handlerClass ? generatedClass : cls;
          act.apexClass = finalClass;
          act.apexReturnType = "String";
          referencedApex.add(finalClass);
          if (!apexPurpose.has(finalClass)) apexPurpose.set(finalClass, purpose);
          if (!cls || cls === bundle.parameters.handlerClass) {
            provisionNotes.push(
              `Intent ${plan.name}: assigned dedicated apexClass ${finalClass}`
            );
          }
        } else if (kind === "flow") {
          const flow = (act.flowApiName ?? "").trim();
          if (!flow) {
            const generated = sanitizeApexClassName(`${plan.name}_FlowAction`);
            act.actionType = "Apex";
            act.apexClass = generated;
            act.apexReturnType = "String";
            act.flowApiName = undefined;
            referencedApex.add(generated);
            apexPurpose.set(generated, `${purpose} | ConvertedFrom=FlowMissingName`);
            provisionNotes.push(
              `Intent ${plan.name}: missing flowApiName, converted action to Apex ${generated}`
            );
          } else {
            referencedFlows.add(flow);
          }
        } else if (kind === "create record" || kind === "update field") {
          const hasObject = Boolean((act.objectApiName ?? "").trim());
          const hasDetails = Boolean(act.details?.length);
          if (!hasObject || !hasDetails) {
            const generated = sanitizeApexClassName(`${plan.name}_DataAction`);
            act.actionType = "Apex";
            act.apexClass = generated;
            act.apexReturnType = "String";
            act.objectApiName = undefined;
            act.details = undefined;
            referencedApex.add(generated);
            apexPurpose.set(
              generated,
              `${purpose} | ConvertedFrom=${kind}|Reason=missing object/details`
            );
            provisionNotes.push(
              `Intent ${plan.name}: ${kind} missing object/details, converted to Apex ${generated}`
            );
          }
        } else if (kind === "invoke agent") {
          const generated = sanitizeApexClassName(`${plan.name}_InvokeAction`);
          act.actionType = "Apex";
          act.apexClass = generated;
          act.apexReturnType = "String";
          referencedApex.add(generated);
          apexPurpose.set(generated, `${purpose} | ConvertedFrom=invoke_agent`);
          provisionNotes.push(
            `Intent ${plan.name}: converted Invoke Agent to Apex ${generated} (no target mapping in generated payload)`
          );
        }
      }
    }

    for (const cls of Array.from(referencedApex)) {
      const purpose = apexPurpose.get(cls) ?? "Auto-provisioned intent action";
      const ok = await ensureApexDependency(cls, purpose);
      if (!ok) continue;
    }

    for (const flow of Array.from(referencedFlows)) {
      let rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id, ActiveVersionId FROM FlowDefinition WHERE DeveloperName = '${soqlEscape(flow)}' LIMIT 1`
      );
      const existsAndActive = Boolean(rows[0]?.Id && rows[0]?.ActiveVersionId);
      if (existsAndActive) continue;

      const candidates = [
        path.join(process.cwd(), "force-app", "main", "default", "flows", `${flow}.flow-meta.xml`),
        path.join(process.cwd(), "..", "force-app", "main", "default", "flows", `${flow}.flow-meta.xml`),
      ];
      let flowMeta = "";
      for (const p of candidates) {
        try {
          flowMeta = await readFile(p, "utf8");
          if (flowMeta.trim()) break;
        } catch {
          // continue
        }
      }
      if (flowMeta.trim()) {
        const dep = await deployFlowMetadata(instanceUrl, token, flow, flowMeta);
        if (!dep.ok) {
          provisionErrors.push(`Could not auto-create/activate Flow dependency ${flow}: ${dep.message}`);
          continue;
        }
        rows = await runQuery(
          instanceUrl,
          token,
          `SELECT Id, ActiveVersionId FROM FlowDefinition WHERE DeveloperName = '${soqlEscape(flow)}' LIMIT 1`
        );
      }

      if (!rows[0]?.Id || !rows[0]?.ActiveVersionId) {
        const fallback = sanitizeApexClassName(`${flow}_FlowAction`);
        const purpose = `Converted Flow action for ${flow}. Execute business intent when flow is unavailable.`;
        const ok = await ensureApexDependency(fallback, purpose);
        if (!ok) {
          provisionErrors.push(`Flow ${flow} unavailable and Apex fallback provisioning failed`);
          continue;
        }
        for (const plan of plans) {
          for (const act of plan.actions) {
            if (lower(act.actionType) === "flow" && (act.flowApiName ?? "").trim() === flow) {
              act.actionType = "Apex";
              act.apexClass = fallback;
              act.apexReturnType = "String";
              act.flowApiName = undefined;
            }
          }
        }
        provisionNotes.push(
          `Flow ${flow} unavailable after deploy; converted related actions to Apex ${fallback}`
        );
      } else {
        provisionNotes.push(`Auto-created/activated Flow dependency: ${flow}`);
      }
    }

    if (provisionErrors.length > 0) {
      for (const e of provisionErrors) pushErr(e);
      addStep(
        "Provision Apex/Flow dependencies",
        false,
        `${provisionErrors.length} dependency issue(s)`
      );
      return { ok: false, steps, errors, ...deployAgentMeta };
    }
    addStep(
      "Provision Apex/Flow dependencies",
      true,
      `apex=${referencedApex.size}, flow=${referencedFlows.size}${provisionNotes.length ? `, notes=${provisionNotes.length}` : ""}`
    );

    const intentMode = options?.intentDeployMode ?? "upsert";
    const shouldUpsertExisting = intentMode === "upsert" || intentMode === "sync";

    const deleteDetailsForAction = async (actionId: string) => {
      if (!fDetAct) return;
      const drows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${detailApi} WHERE ${fDetAct} = '${soqlEscape(actionId)}'`
      );
      for (const d of drows) {
        await fetchWithRefresh(`sobjects/${detailApi}/${String(d.Id)}`, { method: "DELETE" });
      }
    };

    const deleteActionsForIntent = async (intentId: string) => {
      const acts = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${actionApi} WHERE ${fActIntent!} = '${soqlEscape(intentId)}'`
      );
      for (const a of acts) {
        const aid = String(a.Id);
        await deleteDetailsForAction(aid);
        await fetchWithRefresh(`sobjects/${actionApi}/${aid}`, { method: "DELETE" });
      }
    };

    const deleteIntentCascade = async (intentId: string) => {
      await deleteActionsForIntent(intentId);
      const dr = await fetchWithRefresh(`sobjects/${intentApi}/${intentId}`, { method: "DELETE" });
      if (!dr.ok) {
        pushErr(`Intent delete: ${dr.text.slice(0, 200)}`);
      }
    };

    const planNamesInBundle = new Set(plans.map((p) => p.name));

    let intentsCreated = 0;
    let intentsUpdated = 0;
    let intentsRemoved = 0;
    const skippedActionNotes: string[] = [];
    for (const plan of plans) {
      const existingIntentRows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${intentApi} WHERE ${fIntAgent!} = '${soqlEscape(agentId!)}' AND Name = '${soqlEscape(plan.name)}' LIMIT 1`
      );
      const existingIntentId = existingIntentRows[0]?.Id ? String(existingIntentRows[0].Id) : null;

      if (existingIntentId && intentMode === "create_only") {
        addStep(`Intent skip (exists): ${plan.name}`, true);
        continue;
      }

      let intentId: string | null = null;

      if (existingIntentId && shouldUpsertExisting) {
        intentId = existingIntentId;
        const patchBody: Record<string, unknown> = {};
        if (fIntSeq != null && plan.sequence != null) patchBody[fIntSeq] = plan.sequence;
        if (fIntActive != null && plan.isActive != null) patchBody[fIntActive] = plan.isActive;
        if (fIntDesc != null && plan.description) patchBody[fIntDesc] = plan.description;
        if (Object.keys(patchBody).length > 0) {
          const pr = await fetchWithRefresh(`sobjects/${intentApi}/${intentId}`, {
            method: "PATCH",
            body: JSON.stringify(patchBody),
          });
          if (!pr.ok) {
            pushErr(`Intent patch ${plan.name}: ${pr.text.slice(0, 300)}`);
            continue;
          }
        }
        await deleteActionsForIntent(intentId);
        intentsUpdated++;
      } else if (!existingIntentId) {
        const intentBody: Record<string, unknown> = {
          Name: truncateName(plan.name, 80),
          [fIntAgent!]: agentId,
        };
        if (fIntSeq != null && plan.sequence != null) intentBody[fIntSeq] = plan.sequence;
        if (fIntActive != null && plan.isActive != null) intentBody[fIntActive] = plan.isActive;
        if (fIntDesc != null && plan.description) intentBody[fIntDesc] = plan.description;

        const ir = await fetchWithRefresh(`sobjects/${intentApi}`, {
          method: "POST",
          body: JSON.stringify(intentBody),
        });
        if (!ir.ok) {
          pushErr(`Intent ${plan.name}: ${ir.text.slice(0, 300)}`);
          continue;
        }
        const newId = (ir.json as { id?: string })?.id;
        if (!newId) continue;
        intentId = newId;
        intentsCreated++;
      } else {
        continue;
      }

      if (!intentId) continue;

      for (const act of plan.actions) {
        const actBody: Record<string, unknown> = {
          [fActIntent!]: intentId,
        };
        const normalizedActionType = coerceActionType(act.actionType, actionTypePicklist);
        const actionTypeKey = lower(normalizedActionType);
        if (fActSeq) actBody[fActSeq] = act.seq;
        if (fActType) actBody[fActType] = normalizedActionType;
        if (fActActive) actBody[fActActive] = true;
        if (fActDesc) {
          actBody[fActDesc] = `Intent ${plan.name} action: ${normalizedActionType}`;
        }
        const isCanned = actionTypeKey === "canned response";
        if (fLang && isCanned && act.language) {
          const normalizedLanguage =
            normalizePicklistValue(act.language, languagePicklist) ??
            languagePicklist[0];
          if (normalizedLanguage) actBody[fLang] = normalizedLanguage;
        }
        if (fLang && isCanned && !act.language && languagePicklist.length > 0) {
          actBody[fLang] = languagePicklist[0];
        }
        if (fCanned && isCanned && act.cannedText) actBody[fCanned] = act.cannedText;
        if (isCanned && fCanned && !act.cannedText) {
          const fallbackText = (key: string) =>
            key.includes("greeting")
              ? "Hello! I can help with Salesforce tasks and follow-up actions."
              : "I can help with Salesforce operations related to this agent.";
          actBody[fCanned] = fallbackText(plan.name.toLowerCase());
        }
        const isCreateOrUpdate = actionTypeKey === "create record" || actionTypeKey === "update field";
        if (isCreateOrUpdate && !act.objectApiName) {
          act.objectApiName = actionTypeKey === "create record" ? "Task" : "Opportunity";
        }
        if (isCreateOrUpdate && (!act.details || act.details.length === 0)) {
          act.details =
            actionTypeKey === "create record"
              ? [
                  { fieldApiName: "Subject", type: "AI Extracted", valueOrInstruction: "Extract a concise task subject from user request." },
                  { fieldApiName: "Status", type: "Hardcoded", valueOrInstruction: "Not Started" },
                  { fieldApiName: "Priority", type: "Hardcoded", valueOrInstruction: "Normal" },
                ]
              : [
                  { fieldApiName: "StageName", type: "AI Extracted", valueOrInstruction: "Extract target stage from user request." },
                ];
        }
        let normalizedDetails = act.details;
        if (isCreateOrUpdate && act.objectApiName) {
          const objApi = act.objectApiName.trim();
          let targetFields = objectDescribeCache.get(objApi);
          if (!targetFields) {
            const d = await describeSObject(instanceUrl, token, API_VER, objApi);
            if (!d.ok) {
              skippedActionNotes.push(
                `Skipped ${plan.name} action (${normalizedActionType}): object ${objApi} not available`
              );
              continue;
            }
            targetFields = d.body.fields;
            objectDescribeCache.set(objApi, targetFields);
          }
          const nextDetails: typeof act.details = [];
          let invalidDetail = false;
          for (const detail of act.details ?? []) {
            const resolvedField = resolveFieldApiName(
              targetFields,
              detail.fieldApiName
            );
            if (!resolvedField) {
              skippedActionNotes.push(
                `Skipped ${plan.name} action (${normalizedActionType}): field ${detail.fieldApiName} not found on ${objApi}`
              );
              invalidDetail = true;
              break;
            }
            let normalizedVal = detail.valueOrInstruction;
            const detailType = lower(detail.type);
            if (detailType === "hardcoded" && normalizedVal) {
              const pickVals = picklistValuesForField(targetFields, resolvedField);
              if (pickVals.length > 0) {
                const mapped = normalizePicklistValue(normalizedVal, pickVals);
                if (!mapped) {
                  skippedActionNotes.push(
                    `Skipped ${plan.name} action (${normalizedActionType}): invalid picklist "${normalizedVal}" for ${objApi}.${resolvedField}`
                  );
                  invalidDetail = true;
                  break;
                }
                normalizedVal = mapped;
              }
            }
            nextDetails.push({
              ...detail,
              fieldApiName: resolvedField,
              valueOrInstruction: normalizedVal,
            });
          }
          if (invalidDetail) continue;
          normalizedDetails = nextDetails;
        }
        if (fObj && act.objectApiName) actBody[fObj] = act.objectApiName;
        if (fFlow && act.flowApiName) actBody[fFlow] = act.flowApiName;
        if (fApex && act.apexClass) actBody[fApex] = act.apexClass;
        const isApex = actionTypeKey === "apex";
        if (isApex && !act.apexClass) {
          skippedActionNotes.push(
            `Skipped ${plan.name} action (${normalizedActionType}): missing apexClass`
          );
          continue;
        }
        if (fApexRet && isApex) {
          const normalizedApexReturn =
            normalizePicklistValue(act.apexReturnType, apexReturnPicklist) ??
            normalizePicklistValue("Map", apexReturnPicklist) ??
            normalizePicklistValue("Map<String, Object>", apexReturnPicklist) ??
            normalizePicklistValue("JSON", apexReturnPicklist) ??
            apexReturnPicklist[0];
          if (normalizedApexReturn) {
            actBody[fApexRet] = normalizedApexReturn;
          }
        }

        const ar = await fetchWithRefresh(`sobjects/${actionApi}`, {
          method: "POST",
          body: JSON.stringify(actBody),
        });
        if (!ar.ok) {
          if (isMetadataUnavailableError(ar.text)) {
            skippedActionNotes.push(
              `Skipped ${plan.name} action (${normalizedActionType}) due to unavailable metadata`
            );
          } else {
            pushErr(`Action for ${plan.name}: ${ar.text.slice(0, 250)}`);
          }
          continue;
        }
        const actionId = (ar.json as { id?: string })?.id;
        if (!actionId || !normalizedDetails?.length) continue;

        if (!fDetAct || !fDetField || !fDetType) continue;

        for (const d of normalizedDetails) {
          const normalizedDetailType =
            normalizePicklistValue(d.type, detailTypePicklist) ?? d.type;
          const db: Record<string, unknown> = {
            [fDetAct]: actionId,
            [fDetField]: d.fieldApiName,
            [fDetType]: normalizedDetailType,
          };
          if (fDetActive) db[fDetActive] = true;
          if (fDetVal && d.valueOrInstruction) db[fDetVal] = d.valueOrInstruction;
          const dr = await fetchWithRefresh(`sobjects/${detailApi}`, {
            method: "POST",
            body: JSON.stringify(db),
          });
          if (!dr.ok) {
            if (isMetadataUnavailableError(dr.text)) {
              skippedActionNotes.push(
                `Skipped detail for ${plan.name} action field ${d.fieldApiName}: unavailable metadata`
              );
            } else {
              pushErr(`Detail ${plan.name}: ${dr.text.slice(0, 200)}`);
            }
          }
        }
      }
    }

    if (intentMode === "sync") {
      if (plans.length > 0) {
        const allIntents = await runQuery(
          instanceUrl,
          token,
          `SELECT Id, Name FROM ${intentApi} WHERE ${fIntAgent!} = '${soqlEscape(agentId!)}'`
        );
        for (const row of allIntents) {
          const name = String(row.Name);
          if (planNamesInBundle.has(name)) continue;
          await deleteIntentCascade(String(row.Id));
          intentsRemoved++;
        }
      } else if (options?.intentSyncDeleteOrgWhenBundleEmpty === true) {
        const allIntents = await runQuery(
          instanceUrl,
          token,
          `SELECT Id, Name FROM ${intentApi} WHERE ${fIntAgent!} = '${soqlEscape(agentId!)}'`
        );
        for (const row of allIntents) {
          await deleteIntentCascade(String(row.Id));
          intentsRemoved++;
        }
        addStep(
          "Intent sync (empty bundle)",
          true,
          `removed ${allIntents.length} intent(s) — bundle had none; intentSyncDeleteOrgWhenBundleEmpty enabled`
        );
      } else {
        addStep(
          "Intent sync (empty bundle)",
          true,
          "No org intents deleted — bundle has zero intents (safety). Enable intentSyncDeleteOrgWhenBundleEmpty to remove all intents for this agent."
        );
      }
    }

    addStep(
      `Intent / action rows (${intentsCreated} new, ${intentsUpdated} updated${intentsRemoved ? `, ${intentsRemoved} removed` : ""})`,
      errors.length === 0 || intentsCreated > 0 || intentsUpdated > 0 || intentsRemoved > 0,
      errors.length ?
        "Some rows may have failed — see errors"
      : skippedActionNotes.length ?
        `Skipped ${skippedActionNotes.length} row(s) due to unavailable metadata`
      : undefined
    );
    } else {
      addStep(
        "Intent deploy skipped",
        true,
        "skipIntents enabled — no describe/DML for AI_Agent_Intent__c, AI_Intent_Action__c, or AI_Intent_Action_Detail__c"
      );
    }

    if (errors.length > 0) {
      addStep("Publish AI_Agent__c (Active)", false, "Skipped due to intent/action errors");
      return { ok: false, steps, errors, ...deployAgentMeta };
    }

    if (skillOnly) {
      addStep("Publish AI_Agent__c (Active)", true, "Skipped — skill-artifacts-only deploy (no agent row)");
    } else if (agentId) {
      await fetchWithRefresh(`sobjects/${agentApi}/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ [fAgStat!]: "Active" }),
      });
      addStep("Publish AI_Agent__c (Active)", true);
    }

    const ok = errors.length === 0;
    return { ok, steps, errors, ...deployAgentMeta };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushErr(msg);
    addStep("Pipeline aborted", false, msg);
    return { ok: false, steps, errors, ...deployAgentMeta };
  }
}
