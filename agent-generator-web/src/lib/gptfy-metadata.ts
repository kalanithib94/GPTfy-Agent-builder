/**
 * GPTfy / agentic objects used by Deploy-GptfyUseCasePipeline.ps1 and FullConfig patterns.
 * Managed-package orgs typically use ccai__ or ccai_qa__; unpackaged dev orgs use unprefixed API names.
 */

export const OBJECT_CANDIDATES = [
  "",
  "ccai__",
  "ccai_qa__",
] as const;

export type ResolvedNamespace = (typeof OBJECT_CANDIDATES)[number];

export type DescribeField = { name: string; type?: string; label?: string };

export type DescribeResult = {
  name: string;
  label?: string;
  fields: DescribeField[];
};

/** Core objects that should exist for pipeline-style deployment */
export const GPTFY_OBJECTS = [
  "AI_Prompt__c",
  "AI_Agent__c",
  "AI_Connection__c",
  "AI_Data_Extraction_Mapping__c",
  "AI_Agent_Skill__c",
  "AI_Agent_Intent__c",
  "AI_Intent_Action__c",
  "AI_Intent_Action_Detail__c",
] as const;

/** Field name suffixes (last segment) we require on AI_Prompt__c — matches any namespace */
export const PROMPT_REQUIRED_FIELD_SUFFIXES = [
  "Prompt_Command__c",
  "Agentic_Function_Class__c",
  "AI_Connection__c",
  "AI_Data_Extraction_Mapping__c",
  "External_Id__c",
  "Type__c",
  "Status__c",
] as const;

export const AGENT_REQUIRED_FIELD_SUFFIXES = [
  "Developer_Name__c",
  "AI_Model__c",
  "System_Prompt__c",
  "Description__c",
  "Status__c",
] as const;

export const CONNECTION_REQUIRED_FIELD_SUFFIXES = ["Type__c", "Name"] as const;

export const SKILL_REQUIRED_FIELD_SUFFIXES = ["AI_Agent__c", "AI_Prompt__c"] as const;

function buildObjectNames(localName: string): string[] {
  return OBJECT_CANDIDATES.map((p) => `${p}${localName}`);
}

export async function describeSObject(
  instanceUrl: string,
  accessToken: string,
  apiVersion: string,
  objectApiName: string
): Promise<{ ok: true; body: DescribeResult } | { ok: false; status: number; body: string }> {
  const url = `${instanceUrl.replace(/\/$/, "")}/services/data/${apiVersion}/sobjects/${encodeURIComponent(objectApiName)}/describe`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text };
  }
  try {
    return { ok: true, body: JSON.parse(text) as DescribeResult };
  } catch {
    return { ok: false, status: res.status, body: text };
  }
}

export function fieldSuffixMatches(fieldName: string, suffix: string): boolean {
  return fieldName === suffix || fieldName.endsWith(`__${suffix}`);
}

export function findMissingFieldSuffixes(
  fields: DescribeField[],
  requiredSuffixes: readonly string[]
): string[] {
  return requiredSuffixes.filter(
    (suffix) => !fields.some((f) => fieldSuffixMatches(f.name, suffix))
  );
}

export type ObjectResolution =
  | { found: true; apiName: string; prefix: ResolvedNamespace }
  | { found: false; tried: string[] };

export async function resolveObjectName(
  instanceUrl: string,
  accessToken: string,
  apiVersion: string,
  localName: string
): Promise<ObjectResolution> {
  const tried = buildObjectNames(localName);
  for (const apiName of tried) {
    const d = await describeSObject(instanceUrl, accessToken, apiVersion, apiName);
    if (d.ok) {
      let p: ResolvedNamespace = "";
      if (apiName.startsWith("ccai_qa__")) p = "ccai_qa__";
      else if (apiName.startsWith("ccai__")) p = "ccai__";
      return { found: true, apiName, prefix: p };
    }
  }
  return { found: false, tried };
}

export type OrgCheckItem = {
  objectLocalName: string;
  status: "ok" | "missing" | "error";
  apiName?: string;
  namespaceNote?: string;
  missingFields?: string[];
  message?: string;
};

export async function runGptfyOrgValidation(
  instanceUrl: string,
  accessToken: string,
  apiVersion = "v59.0"
): Promise<{ items: OrgCheckItem[]; primaryPrefix: ResolvedNamespace | null }> {
  const items: OrgCheckItem[] = [];
  let primaryPrefix: ResolvedNamespace | null = null;

  const promptRes = await resolveObjectName(instanceUrl, accessToken, apiVersion, "AI_Prompt__c");
  if (promptRes.found) {
    primaryPrefix = promptRes.prefix;
    const d = await describeSObject(
      instanceUrl,
      accessToken,
      apiVersion,
      promptRes.apiName
    );
    if (d.ok) {
      const missing = findMissingFieldSuffixes(d.body.fields, PROMPT_REQUIRED_FIELD_SUFFIXES);
      items.push({
        objectLocalName: "AI_Prompt__c",
        status: missing.length ? "error" : "ok",
        apiName: promptRes.apiName,
        namespaceNote:
          primaryPrefix === ""
            ? "Unprefixed (typical unpackaged dev org)"
            : `Managed-style prefix: ${primaryPrefix}`,
        missingFields: missing.length ? missing : undefined,
        message:
          missing.length > 0
            ? `Missing field suffixes (any namespace): ${missing.join(", ")}`
            : undefined,
      });
    }
  } else {
    items.push({
      objectLocalName: "AI_Prompt__c",
      status: "missing",
      message: `Not found as ${promptRes.tried.join(", ")}`,
    });
  }

  const checks: {
    local: (typeof GPTFY_OBJECTS)[number];
    fieldSuffixes?: readonly string[];
  }[] = [
    { local: "AI_Agent__c", fieldSuffixes: AGENT_REQUIRED_FIELD_SUFFIXES },
    { local: "AI_Connection__c", fieldSuffixes: CONNECTION_REQUIRED_FIELD_SUFFIXES },
    { local: "AI_Data_Extraction_Mapping__c" },
    { local: "AI_Agent_Skill__c", fieldSuffixes: SKILL_REQUIRED_FIELD_SUFFIXES },
    { local: "AI_Agent_Intent__c" },
    { local: "AI_Intent_Action__c" },
    { local: "AI_Intent_Action_Detail__c" },
  ];

  for (const row of checks) {
    if (row.local === "AI_Prompt__c") continue;
    const res = await resolveObjectName(instanceUrl, accessToken, apiVersion, row.local);
    if (!res.found) {
      items.push({
        objectLocalName: row.local,
        status: "missing",
        message: `Not found as ${res.tried.join(", ")}`,
      });
      continue;
    }
    if (!row.fieldSuffixes) {
      items.push({
        objectLocalName: row.local,
        status: "ok",
        apiName: res.apiName,
      });
      continue;
    }
    const d = await describeSObject(instanceUrl, accessToken, apiVersion, res.apiName);
    if (!d.ok) {
      items.push({
        objectLocalName: row.local,
        status: "error",
        apiName: res.apiName,
        message: "Describe failed",
      });
      continue;
    }
    const missing = findMissingFieldSuffixes(d.body.fields, row.fieldSuffixes);
    items.push({
      objectLocalName: row.local,
      status: missing.length ? "error" : "ok",
      apiName: res.apiName,
      missingFields: missing.length ? missing : undefined,
      message:
        missing.length > 0
          ? `Missing field suffixes: ${missing.join(", ")}`
          : undefined,
    });
  }

  return { items, primaryPrefix };
}
