/**
 * Merge generated handler Apex with the version already deployed in the org so
 * existing skills (when branches + helpers) are preserved when adding new ones.
 */

function extractBalancedBlock(text: string, openBraceIdx: number): { end: number; inner: string } | null {
  if (text[openBraceIdx] !== "{") return null;
  let depth = 0;
  for (let i = openBraceIdx; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { end: i, inner: text.slice(openBraceIdx + 1, i) };
    }
  }
  return null;
}

export function extractSwitchOnRequestParam(apex: string): {
  start: number;
  end: number;
  inner: string;
} | null {
  const re = /switch\s+on\s+requestParam\s*\{/i;
  const m = re.exec(apex);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const block = extractBalancedBlock(apex, open);
  if (!block) return null;
  return { start: m.index, end: block.end, inner: block.inner };
}

type WhenPart =
  | { kind: "skill"; name: string; raw: string }
  | { kind: "else"; raw: string };

function parseWhenParts(switchInner: string): WhenPart[] {
  const parts: WhenPart[] = [];
  let i = 0;
  const s = switchInner;
  while (i < s.length) {
    const idx = s.indexOf("when", i);
    if (idx === -1) break;
    if (idx > 0 && /[A-Za-z0-9_]/.test(s[idx - 1]!)) {
      i = idx + 4;
      continue;
    }
    const after = s.slice(idx).match(/^\s*when\s+/);
    if (!after) {
      i = idx + 4;
      continue;
    }
    let pos = idx + after[0].length;
    const tail = s.slice(pos);
    const elseM = tail.match(/^else\s*\{/);
    if (elseM) {
      const open = pos + elseM[0].length - 1;
      const b = extractBalancedBlock(s, open);
      if (!b) break;
      parts.push({ kind: "else", raw: s.slice(idx, b.end + 1) });
      i = b.end + 1;
      continue;
    }
    const skillM = tail.match(/^'([^']+)'\s*\{/);
    if (!skillM) {
      i = pos + 1;
      continue;
    }
    const name = skillM[1]!;
    const open = pos + skillM[0].length - 1;
    const b = extractBalancedBlock(s, open);
    if (!b) break;
    parts.push({ kind: "skill", name, raw: s.slice(idx, b.end + 1) });
    i = b.end + 1;
  }
  return parts;
}

function buildSwitchInner(parts: WhenPart[]): string {
  const lines: string[] = [];
  for (const p of parts) {
    lines.push(`                ${p.raw.trim()}`);
  }
  return `\n${lines.join("\n")}\n            `;
}

export type SkillMergeMode = {
  /** If true, incoming `when 'name'` replaces org for the same skill name. */
  overwriteMatchingSkills: boolean;
  /** If true, only skills present in the incoming bundle remain (org-only skills removed). */
  removeSkillsNotInBundle: boolean;
};

/**
 * Merge org + incoming switch bodies.
 * - Default additive: org wins on name collision; add only new names from incoming.
 * - overwriteMatchingSkills: incoming replaces org for same skill name.
 * - removeSkillsNotInBundle: incoming bundle is authoritative; org-only skills dropped.
 */
export function mergeSwitchInnerWithPolicy(
  orgInner: string,
  incomingInner: string,
  mode: SkillMergeMode
): string {
  const orgParts = parseWhenParts(orgInner);
  const incParts = parseWhenParts(incomingInner);

  let orgElse: string | null = null;
  let incElse: string | null = null;
  for (const p of orgParts) {
    if (p.kind === "else") orgElse = p.raw;
  }
  for (const p of incParts) {
    if (p.kind === "else") incElse = p.raw;
  }

  const incSkillNames = new Set(
    incParts.filter((p): p is WhenPart & { kind: "skill" } => p.kind === "skill").map((p) => p.name)
  );
  const incSkillMap = new Map(
    incParts.filter((p): p is WhenPart & { kind: "skill" } => p.kind === "skill").map((p) => [p.name, p] as const)
  );

  if (mode.removeSkillsNotInBundle) {
    const merged: WhenPart[] = [];
    for (const name of Array.from(incSkillNames)) {
      const p = incSkillMap.get(name);
      if (p) merged.push(p);
    }
    const elsePart = incElse ?? orgElse;
    if (elsePart) merged.push({ kind: "else", raw: elsePart });
    return buildSwitchInner(merged);
  }

  const merged: WhenPart[] = [];
  const seen = new Set<string>();

  for (const p of orgParts) {
    if (p.kind !== "skill") continue;
    const incoming = incSkillMap.get(p.name);
    if (incoming && mode.overwriteMatchingSkills) {
      merged.push(incoming);
    } else {
      merged.push(p);
    }
    seen.add(p.name);
  }

  for (const p of incParts) {
    if (p.kind === "skill" && !seen.has(p.name)) {
      merged.push(p);
      seen.add(p.name);
    }
  }

  const elsePart = mode.overwriteMatchingSkills ? incElse ?? orgElse : orgElse ?? incElse;
  if (elsePart) {
    merged.push({ kind: "else", raw: elsePart });
  }

  return buildSwitchInner(merged);
}

/** @deprecated use mergeSwitchInnerWithPolicy with defaults */
export function mergeSwitchInnerPreservingExisting(orgInner: string, incomingInner: string): string {
  return mergeSwitchInnerWithPolicy(orgInner, incomingInner, {
    overwriteMatchingSkills: false,
    removeSkillsNotInBundle: false,
  });
}

const PRIVATE_METHOD_RE =
  /private\s+String\s+([A-Za-z0-9_]+)\s*\(\s*Map\s*<\s*String\s*,\s*Object\s*>\s+[A-Za-z0-9_]+\s*\)\s*\{/g;

function extractPrivateHandlerMethods(apex: string): Map<string, string> {
  const map = new Map<string, string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PRIVATE_METHOD_RE.source, "g");
  while ((m = re.exec(apex)) !== null) {
    const name = m[1]!;
    const open = m.index + m[0].length - 1;
    const b = extractBalancedBlock(apex, open);
    if (!b) continue;
    const full = apex.slice(m.index, b.end + 1);
    map.set(name, full);
  }
  return map;
}

function methodNamesInWhenBlocks(switchInner: string): Set<string> {
  const names = new Set<string>();
  const re = /\b([A-Za-z0-9_]+)\s*\(\s*parameters\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(switchInner)) !== null) {
    const n = m[1]!;
    if (!/^(if|return|throw|new|super)$/i.test(n)) names.add(n);
  }
  return names;
}

/**
 * Merge incoming generated handler into org-deployed handler: preserve org switch branches
 * for skills that already exist; add new skills from incoming; keep org when else if any.
 * Appends private String helper methods from incoming that are referenced by newly added
 * when branches and not already present in org.
 */
export type HandlerMergeOptions = SkillMergeMode;

export function mergeHandlerApexWithOrg(
  orgBody: string,
  incomingBody: string,
  mergeOpts?: HandlerMergeOptions
): string {
  const orgSwitch = extractSwitchOnRequestParam(orgBody);
  const incSwitch = extractSwitchOnRequestParam(incomingBody);
  if (!incSwitch) return incomingBody;
  if (!orgSwitch) return incomingBody;

  const mode: SkillMergeMode = mergeOpts ?? {
    overwriteMatchingSkills: false,
    removeSkillsNotInBundle: false,
  };
  const mergedInner = mergeSwitchInnerWithPolicy(orgSwitch.inner, incSwitch.inner, mode);
  const newSwitchText = `switch on requestParam {${mergedInner}}`;

  let result =
    orgBody.slice(0, orgSwitch.start) + newSwitchText + orgBody.slice(orgSwitch.end + 1);

  const orgMethods = extractPrivateHandlerMethods(result);
  const incMethods = extractPrivateHandlerMethods(incomingBody);
  const needed = methodNamesInWhenBlocks(mergedInner);

  const toAppend: string[] = [];
  for (const name of Array.from(needed)) {
    if (orgMethods.has(name)) continue;
    const body = incMethods.get(name);
    if (body) toAppend.push(body);
  }

  if (toAppend.length === 0) return result;

  const lastBrace = result.lastIndexOf("}");
  if (lastBrace <= 0) return result;
  const insert = `\n    ${toAppend.join("\n\n    ")}\n`;
  return result.slice(0, lastBrace) + insert + result.slice(lastBrace);
}
