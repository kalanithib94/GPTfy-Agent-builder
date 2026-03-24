import { getSfSession } from "@/lib/session";

export type SalesforceClientConfig = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  callbackUrl: string | undefined;
  source: "session" | "env";
};

function normalize(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/**
 * Resolve OAuth client config from per-session override first, then env fallback.
 * This allows multi-org usage when each tenant has its own External Client App.
 */
export async function resolveSalesforceClientConfig(): Promise<SalesforceClientConfig> {
  const session = await getSfSession();
  const sessionId = normalize(session.sfClientId);
  const sessionSecret = normalize(session.sfClientSecret);
  const sessionCallback = normalize(session.sfCallbackUrl);

  const hasFullSessionConfig = Boolean(sessionId && sessionSecret && sessionCallback);
  if (hasFullSessionConfig) {
    return {
      clientId: sessionId,
      clientSecret: sessionSecret,
      callbackUrl: sessionCallback,
      source: "session",
    };
  }

  return {
    clientId: normalize(process.env.SALESFORCE_CLIENT_ID),
    clientSecret: normalize(process.env.SALESFORCE_CLIENT_SECRET),
    callbackUrl: normalize(process.env.SALESFORCE_CALLBACK_URL),
    source: "env",
  };
}

