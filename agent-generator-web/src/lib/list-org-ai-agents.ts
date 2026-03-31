import {
  describeSObject,
  fieldSuffixMatches,
  resolveObjectName,
  type DescribeField,
} from "./gptfy-metadata";

const API_VER = "v59.0";

function pickField(fields: DescribeField[], suffix: string): string | null {
  const f = fields.find((x) => fieldSuffixMatches(x.name, suffix));
  return f?.name ?? null;
}

async function sfDataFetch(
  instanceUrl: string,
  accessToken: string,
  path: string
): Promise<{ ok: boolean; json?: unknown; text: string }> {
  const base = instanceUrl.replace(/\/$/, "");
  const url = `${base}/services/data/${API_VER}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
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
  return { ok: res.ok, json, text };
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
  if (Array.isArray(r.json) && r.json.length > 0) {
    const first = r.json[0] as { message?: unknown };
    if (typeof first?.message === "string") {
      throw new Error(`SOQL failed: ${first.message}`);
    }
  }
  const recs = (r.json as { records?: Record<string, unknown>[] }).records;
  return Array.isArray(recs) ? recs : [];
}

export type OrgAiAgentRow = {
  id: string;
  name: string;
  developerName: string;
  handlerClass?: string;
};

function pickMostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let winner = "";
  let max = 0;
  for (const [k, n] of Array.from(counts.entries())) {
    if (n > max) {
      winner = k;
      max = n;
    }
  }
  return winner;
}

/**
 * Lists GPTfy AI_Agent__c rows in the connected org so the UI can set
 * Agent Developer Name + display Name to match an existing record (deploy upsert key).
 */
export async function listOrgAiAgents(
  instanceUrl: string,
  accessToken: string
): Promise<OrgAiAgentRow[]> {
  const resolved = await resolveObjectName(instanceUrl, accessToken, API_VER, "AI_Agent__c");
  if (!resolved.found) return [];

  const d = await describeSObject(instanceUrl, accessToken, API_VER, resolved.apiName);
  if (!d.ok) {
    throw new Error("Could not describe AI_Agent__c");
  }
  const fDev = pickField(d.body.fields, "Developer_Name__c");
  if (!fDev) {
    throw new Error("AI_Agent__c has no Developer_Name__c field");
  }

  const q = `SELECT Id, Name, ${fDev} FROM ${resolved.apiName} ORDER BY Name NULLS LAST LIMIT 500`;
  const rows = await runQuery(instanceUrl, accessToken, q);

  const baseRows = rows.map((row) => {
    const id = String(row.Id ?? "");
    const name = String(row.Name ?? "").trim();
    const developerName = String(row[fDev] ?? "").trim();
    return { id, name, developerName, handlerClass: "" };
  }).filter((r) => r.id && r.developerName);

  if (baseRows.length === 0) return [];

  // Best effort: infer handler class from existing AI_Agent_Skill__c -> AI_Prompt__c links.
  try {
    const skillObj = await resolveObjectName(instanceUrl, accessToken, API_VER, "AI_Agent_Skill__c");
    const promptObj = await resolveObjectName(instanceUrl, accessToken, API_VER, "AI_Prompt__c");
    if (!skillObj.found || !promptObj.found) return baseRows;

    const skDesc = await describeSObject(instanceUrl, accessToken, API_VER, skillObj.apiName);
    const prDesc = await describeSObject(instanceUrl, accessToken, API_VER, promptObj.apiName);
    if (!skDesc.ok || !prDesc.ok) return baseRows;

    const fSkillAgent = pickField(skDesc.body.fields, "AI_Agent__c");
    const fSkillPrompt = pickField(skDesc.body.fields, "AI_Prompt__c");
    const fPromptClass = pickField(prDesc.body.fields, "Agentic_Function_Class__c");
    if (!fSkillAgent || !fSkillPrompt || !fPromptClass) return baseRows;

    const idList = baseRows.map((r) => `'${r.id.replace(/'/g, "\\'")}'`).join(",");
    const skillRows = await runQuery(
      instanceUrl,
      accessToken,
      `SELECT ${fSkillAgent}, ${fSkillPrompt} FROM ${skillObj.apiName} WHERE ${fSkillAgent} IN (${idList})`
    );
    const promptIds = Array.from(
      new Set(
        skillRows
          .map((r) => String(r[fSkillPrompt] ?? "").trim())
          .filter(Boolean)
      )
    );
    if (promptIds.length === 0) return baseRows;

    const promptIdList = promptIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(",");
    const promptRows = await runQuery(
      instanceUrl,
      accessToken,
      `SELECT Id, ${fPromptClass} FROM ${promptObj.apiName} WHERE Id IN (${promptIdList})`
    );
    const promptToClass = new Map<string, string>();
    for (const pr of promptRows) {
      const pid = String(pr.Id ?? "").trim();
      const cls = String(pr[fPromptClass] ?? "").trim();
      if (pid && cls) promptToClass.set(pid, cls);
    }

    const classesByAgent = new Map<string, string[]>();
    for (const sr of skillRows) {
      const aid = String(sr[fSkillAgent] ?? "").trim();
      const pid = String(sr[fSkillPrompt] ?? "").trim();
      const cls = promptToClass.get(pid);
      if (!aid || !cls) continue;
      if (!classesByAgent.has(aid)) classesByAgent.set(aid, []);
      classesByAgent.get(aid)!.push(cls);
    }

    return baseRows.map((r) => ({
      ...r,
      handlerClass: pickMostFrequent(classesByAgent.get(r.id) ?? []),
    }));
  } catch {
    return baseRows;
  }
}
