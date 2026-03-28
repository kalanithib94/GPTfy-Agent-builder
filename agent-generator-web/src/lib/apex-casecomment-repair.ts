/**
 * Salesforce CaseComment links to Case via ParentId (the Case Id).
 * Models often emit CaseId, which does not exist on CaseComment → deploy fails.
 */

export function repairCaseCommentCaseIdToParentId(apex: string): string {
  let s = apex;

  // DML constructors
  s = s.replace(/\bnew\s+CaseComment\s*\(\s*CaseId\s*=/gi, "new CaseComment(ParentId =");
  s = s.replace(/\bINSERT\s+new\s+CaseComment\s*\(\s*CaseId\s*=/gi, "INSERT new CaseComment(ParentId =");

  // SELECT list for CaseComment queries (including subqueries)
  s = s.replace(
    /\b(SELECT\s+)([\s\S]*?)(\s+FROM\s+CaseComment\b)/gi,
    (_m, sel, fields, fromPart) =>
      `${sel}${String(fields).replace(/\bCaseId\b/g, "ParentId")}${fromPart}`
  );

  // WHERE ParentId is the lookup; models often write WHERE CaseId
  s = s.replace(/\bFROM\s+CaseComment\s+WHERE\s+CaseId\b/gi, "FROM CaseComment WHERE ParentId");
  s = s.replace(/\bFROM\s+CaseComment\s+WHERE\s+CaseId\s*=/gi, "FROM CaseComment WHERE ParentId =");

  // Instance fields: CaseComment cc = ...; cc.CaseId =
  const declRe = /\bCaseComment\s+(\w+)\s*=/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(s)) !== null) {
    names.add(m[1]!);
  }
  for (const name of Array.from(names)) {
    const re = new RegExp(`\\b${name}\\.CaseId\\b`, "g");
    s = s.replace(re, `${name}.ParentId`);
  }

  return s;
}
