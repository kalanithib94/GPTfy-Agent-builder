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
import { getOpenAIApiKey, getOpenAIModel } from "./openai-server-config";

const API_VER = "v59.0";

export type DeployStep = { step: string; ok: boolean; detail?: string };

export type OrgDeployResult = {
  ok: boolean;
  steps: DeployStep[];
  errors: string[];
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
    model: args.model || "gpt-4.1-mini",
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
  onSessionPersist: () => Promise<void>
): Promise<OrgDeployResult> {
  const steps: DeployStep[] = [];
  const errors: string[] = [];
  const pushErr = (msg: string) => {
    errors.push(msg);
  };
  const addStep = (step: string, ok: boolean, detail?: string) => {
    steps.push({ step, ok, detail });
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

  try {
    const plans: IntentDeployPlan[] =
      bundle.intentDeployPlan?.length ?
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
    const intentApi = await resolveApiName(instanceUrl, token, "AI_Agent_Intent__c");
    const actionApi = await resolveApiName(instanceUrl, token, "AI_Intent_Action__c");
    const detailApi = await resolveApiName(instanceUrl, token, "AI_Intent_Action_Detail__c");

    const pDesc = await describeSObject(instanceUrl, token, API_VER, promptApi);
    const aDesc = await describeSObject(instanceUrl, token, API_VER, agentApi);
    const cDesc = await describeSObject(instanceUrl, token, API_VER, connApi);
    const skDesc = await describeSObject(instanceUrl, token, API_VER, skillApi);
    const iDesc = await describeSObject(instanceUrl, token, API_VER, intentApi);
    const actDesc = await describeSObject(instanceUrl, token, API_VER, actionApi);
    const dDesc = await describeSObject(instanceUrl, token, API_VER, detailApi);

    if (!pDesc.ok || !aDesc.ok || !cDesc.ok || !skDesc.ok || !iDesc.ok || !actDesc.ok || !dDesc.ok) {
      throw new Error("Describe failed for one or more GPTfy objects");
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
    const intf = iDesc.body.fields;
    const actf = actDesc.body.fields;
    const dtf = dDesc.body.fields;

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

    const fIntAgent = pickField(intf, "AI_Agent__c");
    const fIntSeq = pickField(intf, "Sequence__c") ?? pickField(intf, "Seq__c");
    const fIntActive = pickField(intf, "Is_Active__c");
    const fIntDesc = pickField(intf, "Description__c");

    const fActIntent = pickFieldAny(actf, ["AI_Agent_Intent__c", "Intent__c"]);
    const fActSeq = pickField(actf, "Sequence__c") ?? pickField(actf, "Seq__c");
    const fActType = pickField(actf, "Action_Type__c");
    const fActDesc = pickFieldAny(actf, ["Description__c", "Action_Description__c"]);
    const fActActive = pickFieldAny(actf, ["Is_Active__c", "Active__c"]);
    const fLang = pickField(actf, "Language__c");
    const fCanned = pickFieldAny(actf, ["Canned_Response_Text__c", "Canned_Response__c"]);
    const fObj = pickFieldAny(actf, ["Object_API_Name__c", "Object_Name__c"]);
    const fFlow = pickFieldAny(actf, ["Flow_API_Name__c", "Flow_Name__c"]);
    const fApex = pickFieldAny(actf, ["Apex_Class_Name__c", "Apex_Class__c"]);
    const fApexRet = pickFieldAny(actf, ["Apex_Return_Type__c", "Return_Type__c"]);
    const actionTypePicklist = picklistValuesBySuffix(actf, "Action_Type__c");
    const languagePicklist = picklistValuesBySuffix(actf, "Language__c");
    const apexReturnPicklist = picklistValuesBySuffix(actf, "Apex_Return_Type__c");
    const objectDescribeCache = new Map<string, DescribeField[]>();

    const fDetAct = pickFieldAny(dtf, ["AI_Intent_Action__c", "Intent_Action__c"]);
    const fDetField = pickFieldAny(dtf, ["Field_API_Name__c", "Field_Name__c"]);
    const fDetType = pickField(dtf, "Type__c");
    const fDetVal = pickFieldAny(dtf, [
      "Hardcoded_Value_Or_AI_Instruction__c",
      "Value_Or_AI_Instruction__c",
      "Value__c",
      "AI_Description__c",
    ]);
    const fDetActive = pickField(dtf, "Is_Active__c");
    const detailTypePicklist = picklistValuesBySuffix(dtf, "Type__c");

    const requiredPrompt = [fExt, fCmd, fClass, fConn, fMap, fType, fStat];
    if (requiredPrompt.some((x) => !x)) {
      throw new Error(
        `Missing AI_Prompt__c fields for deploy: ${requiredPrompt.map((x) => x ?? "?").join(", ")}`
      );
    }
    if (!fConnType) {
      throw new Error("Missing AI_Connection__c field: Type__c");
    }

    const meta = await deployApexClassMetadata(
      instanceUrl,
      token,
      bundle.parameters.handlerClass,
      bundle.handlerApex,
      bundle.handlerMetaXml
    );
    if (!meta.ok) {
      addStep("Deploy Apex class", false, meta.message);
      pushErr(`Apex deploy: ${meta.message}`);
      return { ok: false, steps, errors };
    }
    addStep("Deploy Apex class", true, bundle.parameters.handlerClass);

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

    rows = await runQuery(
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

    const extPrefix = bundle.parameters.externalIdPrefix;
    const handlerName = bundle.parameters.handlerClass;

    for (const pc of bundle.promptCommands) {
      const stem = promptStemFromFileName(pc.fileName);
      if (!stem) continue;
      const extVal = `${extPrefix}${stem}`;
      const body: Record<string, unknown> = {
        Name: truncateName(stem, 80),
        [fType!]: "Agentic",
        [fStat!]: "Active",
        [fConn!]: promptConnId,
        [fMap!]: mapId,
        [fCmd!]: pc.content,
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
    addStep(`Upsert ${bundle.promptCommands.length} AI_Prompt__c`, true);

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

    const devName = bundle.parameters.agentDeveloperName;
    let agentRows = await runQuery(
      instanceUrl,
      token,
      `SELECT Id FROM ${agentApi} WHERE ${fDev!} = '${soqlEscape(devName)}' LIMIT 1`
    );
    let agentId: string;
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
    addStep("Upsert AI_Agent__c", true, agentId);

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
      const aiBody =
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
      const fallback = buildIntentActionApexStub(className, session.gptfyNamespace, purpose);
      const dep = await deployApexClassMetadata(
        instanceUrl,
        token,
        className,
        aiBody ?? fallback.body,
        fallback.metaXml
      );
      if (!dep.ok) {
        provisionErrors.push(`Could not auto-create Apex dependency ${className}: ${dep.message}`);
        return false;
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
      return { ok: false, steps, errors };
    }
    addStep(
      "Provision Apex/Flow dependencies",
      true,
      `apex=${referencedApex.size}, flow=${referencedFlows.size}${provisionNotes.length ? `, notes=${provisionNotes.length}` : ""}`
    );

    const existingNames = new Set(
      (
        await runQuery(
          instanceUrl,
          token,
          `SELECT Name FROM ${intentApi} WHERE ${fIntAgent!} = '${agentId}'`
        )
      ).map((r) => String(r.Name))
    );

    let intentsCreated = 0;
    for (const plan of plans) {
      if (existingNames.has(plan.name)) {
        addStep(`Intent skip (exists): ${plan.name}`, true);
        continue;
      }

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
      const intentId = (ir.json as { id?: string })?.id;
      if (!intentId) continue;
      intentsCreated++;

      for (const act of plan.actions) {
        const actBody: Record<string, unknown> = {
          [fActIntent!]: intentId,
        };
        const normalizedActionType =
          normalizePicklistValue(act.actionType, actionTypePicklist) ??
          act.actionType;
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
          pushErr(`Action for ${plan.name}: ${normalizedActionType} missing objectApiName`);
          continue;
        }
        if (isCreateOrUpdate && (!act.details || act.details.length === 0)) {
          pushErr(`Action for ${plan.name}: ${normalizedActionType} missing detail mappings`);
          continue;
        }
        let normalizedDetails = act.details;
        if (isCreateOrUpdate && act.objectApiName) {
          const objApi = act.objectApiName.trim();
          let targetFields = objectDescribeCache.get(objApi);
          if (!targetFields) {
            const d = await describeSObject(instanceUrl, token, API_VER, objApi);
            if (!d.ok) {
              pushErr(
                `Action for ${plan.name}: cannot describe object ${objApi} (${d.status})`
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
              pushErr(
                `Action for ${plan.name}: field ${detail.fieldApiName} not found on ${objApi}`
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
                  pushErr(
                    `Action for ${plan.name}: invalid picklist value "${normalizedVal}" for ${objApi}.${resolvedField}`
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
          pushErr(`Action for ${plan.name}: Apex action missing apexClass`);
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
          pushErr(`Action for ${plan.name}: ${ar.text.slice(0, 250)}`);
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
            pushErr(`Detail ${plan.name}: ${dr.text.slice(0, 200)}`);
          }
        }
      }
    }
    addStep(
      `Intent / action rows (${intentsCreated} new intents)`,
      errors.length === 0 || intentsCreated > 0,
      errors.length ? "Some rows may have failed — see errors" : undefined
    );

    await fetchWithRefresh(`sobjects/${agentApi}/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ [fAgStat!]: "Active" }),
    });
    addStep("Publish AI_Agent__c (Active)", true);

    const ok = errors.length === 0;
    return { ok, steps, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushErr(msg);
    addStep("Pipeline aborted", false, msg);
    return { ok: false, steps, errors };
  }
}
