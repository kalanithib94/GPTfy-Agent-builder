export function getSalesforceAuthBase(env: "production" | "sandbox"): string {
  return env === "sandbox"
    ? "https://test.salesforce.com"
    : "https://login.salesforce.com";
}

export function getTokenHostFromInstanceUrl(instanceUrl: string): string {
  try {
    const u = new URL(instanceUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes(".sandbox.")) return "https://test.salesforce.com";
    if (host.endsWith(".my.salesforce.com")) return "https://login.salesforce.com";
    return "https://login.salesforce.com";
  } catch {
    return "https://login.salesforce.com";
  }
}
