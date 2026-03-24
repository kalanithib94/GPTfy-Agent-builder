import { getSfSession } from "@/lib/session";

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string;
  token_type: string;
};

type IdentityResponse = {
  user_id: string;
  organization_id: string;
  username?: string;
};

/** Persist OAuth token response in the iron-session cookie (same as web-server callback). */
export async function saveTokenResponseToSession(
  tokenJson: TokenResponse,
  sfEnv: "production" | "sandbox"
): Promise<void> {
  let username: string | undefined;
  let orgId: string | undefined;
  let userId: string | undefined;
  try {
    const idRes = await fetch(tokenJson.id, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (idRes.ok) {
      const idJson = (await idRes.json()) as IdentityResponse;
      username = idJson.username;
      orgId = idJson.organization_id;
      userId = idJson.user_id;
    }
  } catch {
    /* non-fatal */
  }

  const session = await getSfSession();
  session.accessToken = tokenJson.access_token;
  if (tokenJson.refresh_token) session.refreshToken = tokenJson.refresh_token;
  session.instanceUrl = tokenJson.instance_url;
  session.idUrl = tokenJson.id;
  session.username = username;
  session.orgId = orgId;
  session.userId = userId;
  session.sfEnv = sfEnv;
  session.gptfyNamespace = undefined;
  await session.save();
}
