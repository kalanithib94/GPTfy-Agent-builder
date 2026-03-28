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
};

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

  return rows.map((row) => {
    const id = String(row.Id ?? "");
    const name = String(row.Name ?? "").trim();
    const developerName = String(row[fDev] ?? "").trim();
    return { id, name, developerName };
  }).filter((r) => r.id && r.developerName);
}
