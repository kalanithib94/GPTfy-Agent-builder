/**
 * Best-effort rewrites for a frequent LLM mistake:
 * Case has no standard Name field.
 */
export function repairCaseSoqlNameUsage(apex: string): string {
  let s = apex;

  // SELECT Name FROM Case -> SELECT Subject FROM Case
  s = s.replace(/\bSELECT\s+Name(\s+FROM\s+Case\b)/gi, "SELECT Subject$1");
  // SELECT Id, Name, ... FROM Case -> replace Name token only in the select list tail pattern.
  s = s.replace(/(\bSELECT[\s\S]{0,1200}?\b),\s*Name(\s+FROM\s+Case\b)/gi, "$1, Subject$2");

  // WHERE Name ... FROM/ORDER BY/LIMIT -> WHERE Subject ...
  s = s.replace(
    /(\bFROM\s+Case\b[\s\S]{0,1200}?\bWHERE\s+)Name(\s*(?:=|!=|LIKE|IN|NOT IN|>|<|>=|<=))/gi,
    "$1Subject$2"
  );

  return s;
}

/**
 * Some objects are not filterable by Description in SOQL WHERE.
 * Remove Description LIKE predicates while preserving the rest of the clause.
 */
export function repairNonFilterableDescriptionLike(apex: string): string {
  let s = apex;

  // Parenthesized OR groups.
  s = s.replace(/\(\s*([^()]*?)\s+OR\s+Description\s+LIKE\s+([^)]+)\)/gi, "($1)");
  s = s.replace(/\(\s*Description\s+LIKE\s+([^)]+)\s+OR\s+([^()]*?)\)/gi, "($2)");

  // Non-parenthesized boolean fragments.
  s = s.replace(/\s+OR\s+Description\s+LIKE\s+(:?[^\s)\]]+|'[^']*')/gi, "");
  s = s.replace(/\bDescription\s+LIKE\s+(:?[^\s)\]]+|'[^']*')\s+OR\s+/gi, "");
  s = s.replace(/\s+AND\s+Description\s+LIKE\s+(:?[^\s)\]]+|'[^']*')/gi, "");
  s = s.replace(/\bDescription\s+LIKE\s+(:?[^\s)\]]+|'[^']*')\s+AND\s+/gi, "");

  return s;
}

