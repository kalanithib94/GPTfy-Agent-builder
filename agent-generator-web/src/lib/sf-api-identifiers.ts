/**
 * Salesforce Developer Name / Apex identifier rules (subset used by this app).
 */

const API_SAFE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Turn agent display Name (e.g. "Contact agent") into a stable API stem (Contact_agent). */
export function slugFromAgentLabel(label: string): string {
  let s = label
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!s) s = "Agent";
  if (!/^[A-Za-z]/.test(s)) s = `A_${s}`;
  return s.length > 80 ? s.slice(0, 80) : s;
}

/**
 * Returns a valid API identifier from messy org data (e.g. Developer_Name__c with spaces/slashes).
 * When the org value includes dates/slashes or looks like `Contact_agent` + stray digits from `3/29/…`,
 * prefers {@link slugFromAgentLabel} from the agent **Name** so handler class stems match the real agent.
 */
export function sanitizeSalesforceApiIdentifier(raw: string, fallbackLabel = "Agent"): string {
  const trimmed = (raw ?? "").trim();
  if (API_SAFE.test(trimmed)) {
    const slug = slugFromAgentLabel(fallbackLabel);
    if (
      slug.length >= 2 &&
      trimmed.startsWith(slug) &&
      trimmed !== slug &&
      /^\d/.test(trimmed.slice(slug.length))
    ) {
      return slug;
    }
    return trimmed;
  }

  const looksMessy =
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed) ||
    /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(trimmed);

  if (looksMessy && fallbackLabel.trim().length >= 2) {
    return slugFromAgentLabel(fallbackLabel);
  }

  const beforeSlash = (trimmed.split(/[/\\]/)[0] ?? trimmed).trim();
  const lead = beforeSlash.match(/^([A-Za-z][A-Za-z0-9_]*)/);
  if (lead && lead[1].length >= 2) return lead[1];

  let s = trimmed.replace(/[^A-Za-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!s) {
    s = slugFromAgentLabel(fallbackLabel);
  }
  if (!s) s = "Agent";
  if (!/^[A-Za-z]/.test(s)) s = `A_${s}`;
  if (s.length > 80) s = s.slice(0, 80);
  return s;
}
