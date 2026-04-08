import type { GeneratedBundle } from "./generation-types";
import {
  describeSObject,
  fieldSuffixMatches,
  resolveObjectName,
  type DescribeField,
} from "./gptfy-metadata";
import { defaultIntentDeployPlan, type IntentDeployPlan } from "./intent-deploy-types";
import { deployApexClassMetadata } from "./sf-metadata-deploy";
import { refreshSalesforceAccessToken } from "./sf-token-refresh";
import type { SfSessionData } from "./session";
import {
  preflightValidateHandlerSoqlCustomFields,
  preflightValidateHandlerSoqlFilterability,
} from "./apex-soql-field-preflight";
import {
  repairCaseSoqlNameUsage,
  repairNonFilterableDescriptionLike,
} from "./apex-case-soql-repair";

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

function extractDeclaredApexClassNames(apex: string): string[] {
  const names = new Set<string>();
  const re =
    /\b(?:global|public|private|protected)\s+(?:virtual\s+|abstract\s+|with\s+sharing\s+|without\s+sharing\s+|inherited\s+sharing\s+)*class\s+([A-Za-z][A-Za-z0-9_]*)\b/gm;
  let m: RegExpExecArray | null = re.exec(apex);
  while (m) {
    names.add(m[1]);
    m = re.exec(apex);
  }
  return Array.from(names);
}

function validateBundleHandlerBinding(bundle: GeneratedBundle): string[] {
  const issues: string[] = [];
  const expected = bundle.parameters.handlerClass?.trim();
  if (!expected) {
    issues.push("Missing parameters.handlerClass.");
    return issues;
  }
  if (expected.length > 40) {
    issues.push(`Handler class "${expected}" exceeds Apex 40-char limit.`);
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(expected)) {
    issues.push(`Handler class "${expected}" is not a valid Apex identifier.`);
  }
  const declared = extractDeclaredApexClassNames(bundle.handlerApex ?? "");
  if (declared.length === 0) {
    issues.push("handlerApex does not declare any Apex class.");
    return issues;
  }
  if (!declared.includes(expected)) {
    issues.push(
      `handlerApex class mismatch. Expected "${expected}" from bundle parameters, found: ${declared.join(", ")}.`
    );
  }
  const foreignAgentic = declared.filter((n) => n !== expected && /AgenticHandler$/i.test(n));
  if (foreignAgentic.length > 0) {
    issues.push(
      `handlerApex includes additional agentic handlers (${foreignAgentic.join(", ")}). Keep only "${expected}".`
    );
  }
  return issues;
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
  if (!r.ok || !r.json || typeof r.json !== "object") return [];
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
    // Normalize common LLM SOQL slips before preflight + metadata deploy.
    bundle.handlerApex = repairNonFilterableDescriptionLike(repairCaseSoqlNameUsage(bundle.handlerApex));

    const handlerBindingIssues = validateBundleHandlerBinding(bundle);
    if (handlerBindingIssues.length > 0) {
      const detail = handlerBindingIssues.join(" ");
      addStep("Validate handler/prompt class alignment", false, detail);
      pushErr(`Preflight failed: ${detail}`);
      return { ok: false, steps, errors };
    }
    addStep("Validate handler/prompt class alignment", true, bundle.parameters.handlerClass);

    const soqlFieldIssues = await preflightValidateHandlerSoqlCustomFields(
      instanceUrl,
      token,
      API_VER,
      bundle.handlerApex
    );
    const soqlFilterabilityIssues = await preflightValidateHandlerSoqlFilterability(
      instanceUrl,
      token,
      API_VER,
      bundle.handlerApex
    );
    const soqlIssues = [...soqlFieldIssues, ...soqlFilterabilityIssues];
    if (soqlIssues.length > 0) {
      const detail = soqlIssues.join(" ");
      addStep("Preflight handler SOQL fields/filterability", false, detail);
      pushErr(`Preflight failed: ${detail}`);
      return { ok: false, steps, errors };
    }
    addStep("Preflight handler SOQL fields/filterability", true);

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
    const skDesc = await describeSObject(instanceUrl, token, API_VER, skillApi);
    const iDesc = await describeSObject(instanceUrl, token, API_VER, intentApi);
    const actDesc = await describeSObject(instanceUrl, token, API_VER, actionApi);
    const dDesc = await describeSObject(instanceUrl, token, API_VER, detailApi);

    if (!pDesc.ok || !aDesc.ok || !skDesc.ok || !iDesc.ok || !actDesc.ok || !dDesc.ok) {
      throw new Error("Describe failed for one or more GPTfy objects");
    }

    const pf = pDesc.body.fields;
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

    const fDev = pickField(af, "Developer_Name__c");
    const fModel = pickField(af, "AI_Model__c");
    const fSys = pickField(af, "System_Prompt__c");
    const fDesc = pickField(af, "Description__c");
    const fAgStat = pickField(af, "Status__c");

    const fIntAgent = pickField(intf, "AI_Agent__c");
    const fIntSeq = pickField(intf, "Sequence__c") ?? pickField(intf, "Seq__c");
    const fIntActive = pickField(intf, "Is_Active__c");
    const fIntDesc = pickField(intf, "Description__c");

    const fActIntent = pickField(actf, "AI_Agent_Intent__c");
    const fActSeq = pickField(actf, "Sequence__c") ?? pickField(actf, "Seq__c");
    const fActType = pickField(actf, "Action_Type__c");
    const fLang = pickField(actf, "Language__c");
    const fCanned = pickField(actf, "Canned_Response_Text__c");
    const fObj = pickField(actf, "Object_API_Name__c");
    const fFlow = pickField(actf, "Flow_API_Name__c");
    const fApex = pickField(actf, "Apex_Class_Name__c");
    const fApexRet = pickField(actf, "Apex_Return_Type__c");

    const fDetAct = pickField(dtf, "AI_Intent_Action__c");
    const fDetField = pickField(dtf, "Field_API_Name__c");
    const fDetType = pickField(dtf, "Type__c");
    const fDetVal = pickField(dtf, "Hardcoded_Value_Or_AI_Instruction__c");

    const requiredPrompt = [fExt, fCmd, fClass, fConn, fMap, fType, fStat];
    if (requiredPrompt.some((x) => !x)) {
      throw new Error(
        `Missing AI_Prompt__c fields for deploy: ${requiredPrompt.map((x) => x ?? "?").join(", ")}`
      );
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
      `SELECT Id FROM ${connApi} WHERE Type__c = 'Agentic' AND Name = '${soqlEscape(pref)}' LIMIT 1`
    );
    if (rows[0]?.Id) agentModelId = String(rows[0].Id);
    if (!agentModelId) {
      rows = await runQuery(
        instanceUrl,
        token,
        `SELECT Id FROM ${connApi} WHERE Type__c = 'Agentic' ORDER BY LastModifiedDate DESC LIMIT 1`
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
        [fStat!]: "Draft",
        [fConn!]: promptConnId,
        [fMap!]: mapId,
        [fCmd!]: pc.content,
        [fClass!]: handlerName,
        [fExt!]: extVal,
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
      .map((pc: { fileName: string }) => `${extPrefix}${promptStemFromFileName(pc.fileName)}`)
      .filter((k: string): k is string => Boolean(k));
    const inList = extKeys.map((k: string) => `'${soqlEscape(k)}'`).join(",");
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

    await fetchWithRefresh(`sobjects/${agentApi}/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ [fAgStat!]: "Active" }),
    });
    addStep("Publish AI_Agent__c (Active)", true);

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
        if (fActSeq) actBody[fActSeq] = act.seq;
        if (fActType) actBody[fActType] = act.actionType;
        if (fLang && act.language) actBody[fLang] = act.language;
        if (fCanned && act.cannedText) actBody[fCanned] = act.cannedText;
        if (fObj && act.objectApiName) actBody[fObj] = act.objectApiName;
        if (fFlow && act.flowApiName) actBody[fFlow] = act.flowApiName;
        if (fApex && act.apexClass) actBody[fApex] = act.apexClass;
        if (fApexRet && act.apexReturnType) actBody[fApexRet] = act.apexReturnType;

        const ar = await fetchWithRefresh(`sobjects/${actionApi}`, {
          method: "POST",
          body: JSON.stringify(actBody),
        });
        if (!ar.ok) {
          pushErr(`Action for ${plan.name}: ${ar.text.slice(0, 250)}`);
          continue;
        }
        const actionId = (ar.json as { id?: string })?.id;
        if (!actionId || !act.details?.length) continue;

        if (!fDetAct || !fDetField || !fDetType) continue;

        for (const d of act.details) {
          const db: Record<string, unknown> = {
            [fDetAct]: actionId,
            [fDetField]: d.fieldApiName,
            [fDetType]: d.type,
          };
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

    const ok = errors.length === 0;
    return { ok, steps, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushErr(msg);
    addStep("Pipeline aborted", false, msg);
    return { ok: false, steps, errors };
  }
}
