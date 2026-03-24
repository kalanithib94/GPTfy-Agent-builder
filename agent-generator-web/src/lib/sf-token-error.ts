/** Parse Salesforce /oauth2/token error JSON for display. */
export function parseSalesforceTokenErrorBody(tokenText: string): {
  raw: string;
  error?: string;
  errorDescription?: string;
  userMessage: string;
} {
  const raw = tokenText.slice(0, 800);
  try {
    const j = JSON.parse(tokenText) as { error?: string; error_description?: string };
    const desc = j.error_description?.trim();
    const code = j.error?.trim();
    if (desc) {
      return { raw, error: code, errorDescription: desc, userMessage: desc };
    }
    if (code) {
      return {
        raw,
        error: code,
        userMessage:
          code === "invalid_grant"
            ? "invalid_grant — wrong username/password/security token, or this client is not allowed to use this grant type (common for External Client Apps: use “Production / Sandbox” browser login instead)."
            : code,
      };
    }
  } catch {
    /* not JSON */
  }
  return {
    raw,
    userMessage: tokenText.trim().slice(0, 300) || "Unknown error from Salesforce token endpoint.",
  };
}
