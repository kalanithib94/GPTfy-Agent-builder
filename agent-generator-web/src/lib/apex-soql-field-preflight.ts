/**
 * Validates custom field tokens in bracket SOQL ([SELECT ... FROM Obj ...]) against org describe
 * so deploy fails fast when the model invents __c fields that do not exist.
 */

import { describeSObject, type DescribeField } from "./gptfy-metadata";

/** Extract [SELECT ...] blocks (balanced brackets; subqueries use parentheses, not nested [). */
export function extractBracketSoqlBlocks(apex: string): { inner: string; fromObject: string }[] {
  const out: { inner: string; fromObject: string }[] = [];
  let i = 0;
  while (i < apex.length) {
    const start = apex.indexOf("[SELECT", i);
    if (start === -1) break;
    let depth = 0;
    let j = start;
    for (; j < apex.length; j++) {
      const c = apex[j];
      if (c === "[") depth++;
      else if (c === "]") {
        depth--;
        if (depth === 0) {
          const block = apex.slice(start, j + 1);
          const inner = block.slice(1, -1).trim();
          const fromMatch = /\bFROM\s+([A-Za-z_][A-Za-z0-9_]*)\b/i.exec(inner);
          if (fromMatch) {
            out.push({ inner, fromObject: fromMatch[1] });
          }
          i = j + 1;
          break;
        }
      }
    }
    if (j >= apex.length) {
      i = start + 7;
    }
  }
  return out;
}

function fieldNameSet(fields: DescribeField[]): Set<string> {
  return new Set(fields.map((f) => f.name.toLowerCase()));
}

function fieldFilterabilityMap(fields: DescribeField[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const f of fields) {
    out.set(f.name.toLowerCase(), Boolean(f.filterable));
  }
  return out;
}

/** Mask Apex string literals so field names mentioned inside quotes are not matched. */
function maskApexStringLiterals(s: string): string {
  return s.replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Custom fields: bare Token__c applies to FROM object; Related.Token__c is validated on Related.
 */
function collectCustomFieldReferences(soqlInner: string): { objectApi: string; field: string }[] {
  const refs: { objectApi: string; field: string }[] = [];

  const rel = /\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*__c)\b/g;
  let m: RegExpExecArray | null = null;
  while ((m = rel.exec(soqlInner)) !== null) {
    refs.push({ objectApi: m[1], field: m[2] });
  }

  const bare = /\b(?<![A-Za-z0-9_.])([A-Za-z][A-Za-z0-9_]*__c)\b/g;
  while ((m = bare.exec(soqlInner)) !== null) {
    refs.push({ objectApi: "", field: m[1] });
  }

  return refs;
}

/**
 * Returns human-readable issues for unknown custom fields referenced in bracket SOQL.
 */
export async function preflightValidateHandlerSoqlCustomFields(
  instanceUrl: string,
  accessToken: string,
  apiVersion: string,
  apex: string
): Promise<string[]> {
  const blocks = extractBracketSoqlBlocks(apex);
  if (blocks.length === 0) {
    return [];
  }

  const issues: string[] = [];
  const cache = new Map<string, Set<string>>();

  async function fieldsFor(obj: string): Promise<Set<string> | null> {
    const k = obj.toLowerCase();
    if (cache.has(k)) return cache.get(k)!;
    const d = await describeSObject(instanceUrl, accessToken, apiVersion, obj);
    if (!d.ok) {
      issues.push(`Could not describe ${obj} (${d.status}) — skipped field validation for that object`);
      return null;
    }
    const set = fieldNameSet(d.body.fields);
    cache.set(k, set);
    return set;
  }

  for (const { inner, fromObject } of blocks) {
    const refs = collectCustomFieldReferences(maskApexStringLiterals(inner));
    const seen = new Set<string>();

    for (const r of refs) {
      const targetObj = r.objectApi || fromObject;
      const key = `${targetObj}.${r.field}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const fs = await fieldsFor(targetObj);
      if (!fs) continue;
      if (!fs.has(r.field.toLowerCase())) {
        issues.push(`Unknown custom field ${targetObj}.${r.field} — not on ${targetObj} in this org (remove or add the field)`);
      }
    }
  }

  return issues;
}

/**
 * Extract likely field tokens from WHERE clause (bare fields or relationship.field).
 * Intentionally conservative: false positives are filtered by describe field sets.
 */
function collectWhereFieldReferences(whereClause: string): { objectApi?: string; field: string }[] {
  const refs: { objectApi?: string; field: string }[] = [];
  const rel = /\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null = null;
  while ((m = rel.exec(whereClause)) !== null) {
    refs.push({ objectApi: m[1], field: m[2] });
  }
  const bare = /\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  while ((m = bare.exec(whereClause)) !== null) {
    refs.push({ field: m[1] });
  }
  return refs;
}

const SOQL_KEYWORDS = new Set([
  "and",
  "or",
  "not",
  "null",
  "true",
  "false",
  "like",
  "in",
  "includes",
  "excludes",
  "with",
  "without",
  "toLabel",
  "convertCurrency",
]);

function whereSegment(soqlInner: string): string | null {
  const m = /\bWHERE\b([\s\S]*?)(\bGROUP\s+BY\b|\bORDER\s+BY\b|\bLIMIT\b|\bOFFSET\b|\bFOR\b|\bWITH\b|$)/i.exec(
    soqlInner
  );
  return m?.[1]?.trim() || null;
}

/**
 * Validates WHERE-filtered fields are actually filterable in the connected org.
 * Prevents common deploy/runtime issues like filtering on Case/Task Description.
 */
export async function preflightValidateHandlerSoqlFilterability(
  instanceUrl: string,
  accessToken: string,
  apiVersion: string,
  apex: string
): Promise<string[]> {
  const blocks = extractBracketSoqlBlocks(apex);
  if (blocks.length === 0) return [];

  const issues: string[] = [];
  const fieldSetCache = new Map<string, Set<string>>();
  const filterableCache = new Map<string, Map<string, boolean>>();

  async function ensureDescribe(obj: string): Promise<boolean> {
    const key = obj.toLowerCase();
    if (fieldSetCache.has(key) && filterableCache.has(key)) return true;
    const d = await describeSObject(instanceUrl, accessToken, apiVersion, obj);
    if (!d.ok) {
      issues.push(`Could not describe ${obj} (${d.status}) — skipped filterability validation.`);
      return false;
    }
    fieldSetCache.set(key, fieldNameSet(d.body.fields));
    filterableCache.set(key, fieldFilterabilityMap(d.body.fields));
    return true;
  }

  for (const { inner, fromObject } of blocks) {
    const where = whereSegment(maskApexStringLiterals(inner));
    if (!where) continue;
    if (!(await ensureDescribe(fromObject))) continue;
    const baseFields = fieldSetCache.get(fromObject.toLowerCase())!;
    const baseFilterable = filterableCache.get(fromObject.toLowerCase())!;
    const refs = collectWhereFieldReferences(where);
    const seen = new Set<string>();
    for (const ref of refs) {
      const f = ref.field;
      if (!f || SOQL_KEYWORDS.has(f.toLowerCase())) continue;
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(f)) continue;
      if (/^[A-Z0-9_]+$/.test(f)) continue; // likely enum/literal token

      if (ref.objectApi) {
        // Relationship filterability varies; skip cross-object checks to avoid false positives.
        continue;
      }
      const key = `${fromObject}.${f}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!baseFields.has(f.toLowerCase())) continue;
      if (!baseFilterable.get(f.toLowerCase())) {
        issues.push(
          `Non-filterable field in SOQL WHERE: ${fromObject}.${f}. Remove it from WHERE or use SOSL/text search strategy.`
        );
      }
    }
  }

  return issues;
}
