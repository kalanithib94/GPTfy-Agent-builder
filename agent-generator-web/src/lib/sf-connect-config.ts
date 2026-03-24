/** Safe booleans for UI — never expose secret values. */
export function getSalesforceConnectConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  const callbackUrl = process.env.SALESFORCE_CALLBACK_URL?.trim();

  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasCallbackUrl: Boolean(callbackUrl),
    /** True when /api/salesforce/login can start OAuth */
    readyForAuthorize: Boolean(clientId && callbackUrl),
    /** True when callback can exchange the code */
    readyForToken: Boolean(clientId && clientSecret && callbackUrl),
  };
}

export function buildSuggestedCallbackUrl(hostHeader: string | null, protoHeader: string | null): string {
  const host = hostHeader?.split(",")[0]?.trim() || "localhost:3000";
  const proto =
    protoHeader?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/salesforce/callback`;
}
