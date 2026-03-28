/**
 * Best-effort fixes and structural checks for LLM-generated GPTfy handler Apex.
 * Catches common deploy failures before Metadata API compile.
 */

/**
 * Strip // comments from one line without treating apostrophes inside strings as delimiters.
 * Apex uses '' (doubled quote) for a literal single quote inside a string.
 */
function stripLineSlashSlashComment(line: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < line.length) {
    if (!inString && i + 1 < line.length && line[i] === "/" && line[i + 1] === "/") {
      break;
    }
    const c = line[i];
    if (c === "'") {
      if (inString && i + 1 < line.length && line[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      inString = !inString;
    }
    out += c;
    i++;
  }
  return out;
}

/** Code-only view for heuristics (avoids false positives from "don't" in // comments). */
function apexCodeOnlyForStringChecks(apex: string): string {
  return apex.split(/\r?\n/).map(stripLineSlashSlashComment).join("\n");
}

/** Repair patterns that are safe to apply without parsing Apex. */
export function repairHandlerApexCommonIssues(apex: string): string {
  let s = apex;
  // Models sometimes emit void helpers though the contract is JSON String responses.
  s = s.replace(/\bprivate\s+void\s+err\s*\(/g, "private String err(");
  s = s.replace(/\bprivate\s+void\s+ok\s*\(/g, "private String ok(");
  s = s.replace(/\bglobal\s+void\s+err\s*\(/g, "global String err(");
  s = s.replace(/\bglobal\s+void\s+ok\s*\(/g, "global String ok(");
  // Markdown headings accidentally pasted into Apex.
  s = s.replace(/^\s*#{1,6}\s+[^\r\n]*\r?\n/gm, "");
  s = s.replace(/^\s*#{1,6}\s+[^\r\n]*$/gm, "");
  return s;
}

/**
 * Structural problems that usually cause Tooling/deploy compile errors.
 * Run after {@link repairHandlerApexCommonIssues} for best results.
 */
export function getHandlerStructuralIssues(apex: string): string[] {
  const issues: string[] = [];

  if (/\bprivate\s+void\s+(err|ok)\s*\(/.test(apex) || /\bglobal\s+void\s+(err|ok)\s*\(/.test(apex)) {
    issues.push("err/ok helpers must be private String (or global String), not void");
  }

  if (/^\s*#\s/m.test(apex)) {
    issues.push("Markdown-style # lines are not valid Apex outside comments");
  }

  const codeOnly = apexCodeOnlyForStringChecks(apex);
  // Note: we do not flag multiline '...' strings here — regex checks were prone to false
  // positives (e.g. block-comment stripping inside strings) and to apostrophe edge cases.
  // Salesforce compile remains the source of truth for string literals.

  // Double-quoted string literals are not valid Apex (often pasted JSON or JS).
  if (/=\s*"[^"]*"\s*;/.test(codeOnly) || /\breturn\s+"[^"]*"\s*;/.test(codeOnly)) {
    issues.push('Double-quoted (") string literals are invalid in Apex; use single quotes');
  }

  // LLM uses `desc` as variable — breaks parsing / ORDER BY confusion; forbidden in our prompts.
  if (/\bString\s+desc\b/.test(apex) || /\b(desc)\s*[=;)]/.test(apex)) {
    issues.push(
      "Do not use 'desc' as a variable name — use descriptionText or msg; keep ORDER BY ... DESC as SOQL keywords"
    );
  }

  if (/\bString\.isBlank\s*\(\s*\)/.test(apex)) {
    issues.push("String.isBlank() requires one argument — use String.isBlank(value)");
  }

  // MAX(ActivityDate) often fails compile on Task; prefer ORDER BY ActivityDate DESC LIMIT 1.
  if (/\bMAX\s*\(\s*ActivityDate\s*\)/i.test(apex)) {
    issues.push(
      "Avoid MAX(ActivityDate) in aggregate SOQL — use ORDER BY ActivityDate DESC LIMIT 1 or another field that supports aggregates"
    );
  }

  return issues;
}
