/**
 * Salesforce Developer Name / Apex identifier rules (subset used by this app).
 */

const API_SAFE = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Returns a valid API identifier from messy org data (e.g. Developer_Name__c with spaces/slashes).
 * Prefers a leading alphanumeric segment (e.g. "Contact_agent" from "Contact_agent3/29/2026…").
 */
export function sanitizeSalesforceApiIdentifier(raw: string, fallbackLabel = "Agent"): string {
  const trimmed = (raw ?? "").trim();
  if (API_SAFE.test(trimmed)) return trimmed;

  const lead = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)/);
  if (lead && lead[1].length >= 2) return lead[1];

  let s = trimmed.replace(/[^A-Za-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!s) {
    s = fallbackLabel
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }
  if (!s) s = "Agent";
  if (!/^[A-Za-z]/.test(s)) s = `A_${s}`;
  if (s.length > 80) s = s.slice(0, 80);
  return s;
}
