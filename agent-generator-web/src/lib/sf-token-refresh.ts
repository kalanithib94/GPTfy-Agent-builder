import { getSalesforceAuthBase } from "./sf-endpoints";
import type { SfSessionData } from "./session";

export async function refreshSalesforceAccessToken(
  session: SfSessionData
): Promise<boolean> {
  const rt = session.refreshToken;
  const cid = process.env.SALESFORCE_CLIENT_ID;
  const sec = process.env.SALESFORCE_CLIENT_SECRET;
  if (!rt || !cid || !sec) return false;

  const env = session.sfEnv ?? "production";
  const tokenUrl = `${getSalesforceAuthBase(env)}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cid,
    client_secret: sec,
    refresh_token: rt,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) return false;

  try {
    const j = JSON.parse(text) as {
      access_token: string;
      refresh_token?: string;
    };
    session.accessToken = j.access_token;
    if (j.refresh_token) session.refreshToken = j.refresh_token;
    return true;
  } catch {
    return false;
  }
}
