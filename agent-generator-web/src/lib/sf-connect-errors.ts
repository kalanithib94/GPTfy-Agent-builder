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
  if (lower.includes("token_exchange_failed")) {
    return `Token exchange failed. Check SALESFORCE_CLIENT_SECRET matches the Connected App Consumer Secret, and the callback URL matches exactly. ${decoded.slice(0, 200)}`;
  }
  if (lower.includes("oauth is not configured") || lower.includes("missing salesforce")) {
    return decoded;
  }
  if (lower.includes("access_denied")) {
    return "Salesforce login was cancelled or access was denied. Try again and approve the app.";
  }

  return decoded.length > 500 ? `${decoded.slice(0, 500)}…` : decoded;
}
