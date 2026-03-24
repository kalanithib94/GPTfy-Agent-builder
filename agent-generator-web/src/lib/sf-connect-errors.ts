/** Turn raw `?error=` values into short, actionable copy for the Connect page. */
export function describeConnectError(raw: string | undefined): string {
  if (!raw) return "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  const lower = decoded.toLowerCase();

  if (lower.includes("redirect_uri_mismatch") || lower.includes("redirect uri")) {
    return "Salesforce rejected the callback URL. In your Connected App, the callback must exactly match SALESFORCE_CALLBACK_URL on the server (same https host and path).";
  }
  if (decoded === "missing_code_or_state") {
    return "Salesforce did not return an authorization code. Try again, or use a private window if cookies are blocked.";
  }
  if (decoded === "invalid_oauth_state") {
    return "OAuth state did not match (session expired or another tab). Click Production or Sandbox again and finish login within a few minutes.";
  }
  if (decoded === "missing_pkce_verifier") {
    return "OAuth PKCE cookie was missing (blocked cookies, expired step, or old deployment). Click Production or Sandbox again from /connect in the same browser.";
  }
  if (lower.includes("token_exchange_failed")) {
    const after = decoded.includes(":") ? decoded.split(":").slice(1).join(":").trim() : decoded;
    return `Token exchange failed — Salesforce said: ${after.slice(0, 500)}. Typical fixes: Consumer Secret and Callback URL match the External Client App; turn off “Require user credentials in the POST body” for Authorization Code if you did not send username/password on the token step; ensure Authorization Code flow is enabled.`;
  }
  if (lower.includes("oauth is not configured") || lower.includes("missing salesforce")) {
    return decoded;
  }
  if (lower.includes("access_denied")) {
    return "Salesforce login was cancelled or access was denied. Try again and approve the app.";
  }
  if (lower.includes("cross-org oauth flows are not supported")) {
    return "This External Client App is org-scoped and cannot be used cross-org. Save the target org's client ID/secret/callback in Connect (session config) or use that org's own app credentials.";
  }

  return decoded.length > 500 ? `${decoded.slice(0, 500)}…` : decoded;
}
