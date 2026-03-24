type ConnectConfigInput = {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  source?: "env" | "session";
};

/** Safe booleans for UI — never expose secret values. */
export function getSalesforceConnectConfig(input?: ConnectConfigInput) {
  const envClientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const envClientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  const envCallbackUrl = process.env.SALESFORCE_CALLBACK_URL?.trim();
  const clientId = input?.clientId?.trim() || envClientId;
  const clientSecret = input?.clientSecret?.trim() || envClientSecret;
  const callbackUrl = input?.callbackUrl?.trim() || envCallbackUrl;

  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasCallbackUrl: Boolean(callbackUrl),
    source: input?.source ?? "env",
    /** True when /api/salesforce/login can start OAuth */
    readyForAuthorize: Boolean(clientId && callbackUrl),
    /** True when callback can exchange the code */
    readyForToken: Boolean(clientId && clientSecret && callbackUrl),
    /** Username-password OAuth (needs Consumer Key + Secret only; no callback URL for the token POST) */
    readyForPassword: Boolean(clientId && clientSecret),
  };
}

export function buildSuggestedCallbackUrl(hostHeader: string | null, protoHeader: string | null): string {
  const host = hostHeader?.split(",")[0]?.trim() || "localhost:3000";
  const proto =
    protoHeader?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/salesforce/callback`;
}
