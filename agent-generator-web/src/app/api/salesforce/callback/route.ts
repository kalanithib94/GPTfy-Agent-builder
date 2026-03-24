import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSalesforceAuthBase } from "@/lib/sf-endpoints";
import { getSfSession } from "@/lib/session";

type TokenResponse = {
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
  display_name?: string;
};

export async function GET(request: Request) {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const redirectUri = process.env.SALESFORCE_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Salesforce OAuth env vars are not configured" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  if (err) {
    return NextResponse.redirect(
      new URL(
        `/connect?error=${encodeURIComponent(errDesc ?? err)}`,
        url.origin
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/connect?error=missing_code_or_state", url.origin)
    );
  }

  const jar = cookies();
  const expected = jar.get("sf_oauth_state")?.value;
  const envCookie = jar.get("sf_oauth_env")?.value;
  jar.delete("sf_oauth_state");
  jar.delete("sf_oauth_env");

  if (!expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/connect?error=invalid_oauth_state", url.origin)
    );
  }

  const env = envCookie === "sandbox" ? "sandbox" : "production";
  const tokenBase = getSalesforceAuthBase(env);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await fetch(`${tokenBase}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL(
        `/connect?error=${encodeURIComponent("token_exchange_failed: " + tokenText.slice(0, 200))}`,
        url.origin
      )
    );
  }

  let tokenJson: TokenResponse;
  try {
    tokenJson = JSON.parse(tokenText) as TokenResponse;
  } catch {
    return NextResponse.redirect(
      new URL("/connect?error=invalid_token_json", url.origin)
    );
  }

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
    // non-fatal
  }

  const session = await getSfSession();
  session.accessToken = tokenJson.access_token;
  if (tokenJson.refresh_token) session.refreshToken = tokenJson.refresh_token;
  session.instanceUrl = tokenJson.instance_url;
  session.idUrl = tokenJson.id;
  session.username = username;
  session.orgId = orgId;
  session.userId = userId;
  session.sfEnv = env;
  session.gptfyNamespace = undefined;
  await session.save();

  return NextResponse.redirect(new URL("/status", url.origin));
}
