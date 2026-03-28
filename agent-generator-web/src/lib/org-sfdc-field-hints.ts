/**
 * Fetches Salesforce describe for standard CRM objects inferred from the use case
 * and builds prompt text so OpenAI does not invent custom (__c) field API names.
 */

import { inferStandardObjectsForFindByName } from "./find-by-name-inject";
import { describeSObject } from "./gptfy-metadata";

const API_VER = "v59.0";
const MAX_CUSTOM_NAMES_PER_OBJECT = 150;

async function describeCustomFieldNames(
  instanceUrl: string,
  accessToken: string,
  objectApi: string
): Promise<{ ok: true; names: string[] } | { ok: false }> {
  const d = await describeSObject(instanceUrl, accessToken, API_VER, objectApi);
  if (!d.ok) {
    return { ok: false };
  }
  const names = d.body.fields
    .map((f) => f.name)
    .filter((n) => n.endsWith("__c"))
    .sort();
  return { ok: true, names };
}

/**
 * Builds authoritative text for the model: which custom fields exist per object in the connected org.
 * Object list (2780 types) does not include field-level data — this uses describe per object.
 */
export async function fetchSfdcFieldHintsForGeneration(params: {
  instanceUrl: string;
  accessToken: string;
  useCase: string;
  notes?: string;
  intentResearchInstructions?: string;
}): Promise<{ text: string }> {
  const objects = inferStandardObjectsForFindByName(
    params.useCase,
    params.intentResearchInstructions,
    []
  );
  if (objects.length === 0) {
    return { text: "" };
  }

  const lines: string[] = [];

  for (const obj of objects) {
    const r = await describeCustomFieldNames(params.instanceUrl, params.accessToken, obj);
    if (!r.ok) {
      lines.push(
        `${obj}: describe() failed — use only standard fields documented for ${obj}; do not invent __c API names.`
      );
      continue;
    }
    const names = r.names;
    const shown = names.slice(0, MAX_CUSTOM_NAMES_PER_OBJECT);
    const extra = names.length > MAX_CUSTOM_NAMES_PER_OBJECT ? names.length - MAX_CUSTOM_NAMES_PER_OBJECT : 0;

    if (names.length === 0) {
      lines.push(
        `${obj}: Describe returned **no custom (__c) fields** on ${obj} in this org. In SOQL use **standard fields only** (for Case: Id, CaseNumber, Subject, Status, Priority, Description, ContactId, AccountId, OwnerId, IsClosed, CreatedDate, etc.). **Do not** reference arbitrary __c names — they will fail deploy.`
      );
    } else {
      lines.push(
        `${obj}: **Only** these custom field API names exist on ${obj} here (you may use these __c fields; **do not** reference any other __c name): ${shown.join(", ")}${extra > 0 ? ` … (+${extra} more not listed)` : ""}`
      );
    }
  }

  const text = lines.join("\n");
  if (text.length > 12000) {
    return { text: `${text.slice(0, 12000)}\n…(truncated)` };
  }
  return { text };
}

/**
 * Org context for OpenAI: namespace + optional describe-backed field hints when connected.
 */
export async function buildOpenAIOrgContext(params: {
  instanceUrl?: string;
  accessToken?: string;
  gptfyNamespace?: string | null;
  useCase: string;
  notes?: string;
  intentResearchInstructions?: string;
}): Promise<{
  instanceUrl?: string;
  gptfyNamespace?: string;
  sfdcFieldHintsText?: string;
}> {
  const base: {
    instanceUrl?: string;
    gptfyNamespace?: string;
    sfdcFieldHintsText?: string;
  } = {
    instanceUrl: params.instanceUrl,
    gptfyNamespace: params.gptfyNamespace ?? undefined,
  };
  if (!params.instanceUrl?.trim() || !params.accessToken?.trim()) {
    return base;
  }
  const hints = await fetchSfdcFieldHintsForGeneration({
    instanceUrl: params.instanceUrl,
    accessToken: params.accessToken,
    useCase: params.useCase,
    notes: params.notes,
    intentResearchInstructions: params.intentResearchInstructions,
  });
  if (hints.text.trim()) {
    base.sfdcFieldHintsText = hints.text;
  }
  return base;
}
