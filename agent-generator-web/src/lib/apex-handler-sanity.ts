/**
 * Best-effort fixes and structural checks for LLM-generated GPTfy handler Apex.
 * Catches common deploy failures before Metadata API compile.
 */

/** Remove block comments so comment text does not confuse downstream checks. */
function stripBlockComments(apex: string): string {
  return apex.replace(/\/\*[\s\S]*?\*\//g, "");
}

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
  const noBlock = stripBlockComments(apex);
  return noBlock.split(/\r?\n/).map(stripLineSlashSlashComment).join("\n");
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
  // Raw newline before closing quote inside a '...' literal (ignore // comment apostrophes).
  if (/'[^']*\r?\n/.test(codeOnly)) {
    issues.push("Multi-line or unterminated string literal (newline before closing single quote)");
  }

  // Double-quoted string literals are not valid Apex (often pasted JSON or JS).
  if (/=\s*"[^"]*"\s*;/.test(codeOnly) || /\breturn\s+"[^"]*"\s*;/.test(codeOnly)) {
    issues.push('Double-quoted (") string literals are invalid in Apex; use single quotes');
  }

  return issues;
}
