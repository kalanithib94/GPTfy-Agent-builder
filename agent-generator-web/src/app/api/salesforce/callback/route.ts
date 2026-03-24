import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSalesforceClientConfig } from "@/lib/sf-client-config";
import { getSalesforceAuthBase } from "@/lib/sf-endpoints";
import { saveTokenResponseToSession, type TokenResponse } from "@/lib/sf-token-session";

function redirectConnectError(requestUrl: string, message: string) {
  const u = new URL(requestUrl);
  const target = new URL("/connect", `${u.protocol}//${u.host}`);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const cfg = await resolveSalesforceClientConfig();
  const clientId = cfg.clientId;
  const clientSecret = cfg.clientSecret;
  const redirectUri = cfg.callbackUrl;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectConnectError(
      request.url,
      "OAuth is not configured: set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, and SALESFORCE_CALLBACK_URL on the server, or save per-org client config in /connect."
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
  const codeVerifier = jar.get("sf_oauth_code_verifier")?.value;
  jar.delete("sf_oauth_state");
  jar.delete("sf_oauth_env");
  jar.delete("sf_oauth_code_verifier");

  if (!expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/connect?error=invalid_oauth_state", url.origin)
    );
  }

  const pkceExpected = process.env.SALESFORCE_USE_PKCE === "true";
  if (pkceExpected && !codeVerifier) {
    return NextResponse.redirect(
      new URL("/connect?error=missing_pkce_verifier", url.origin)
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
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const tokenRes = await fetch(`${tokenBase}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    let detail = tokenText.slice(0, 400);
    try {
      const j = JSON.parse(tokenText) as { error?: string; error_description?: string };
      if (j.error_description) detail = j.error_description;
      else if (j.error) detail = j.error;
    } catch {
      /* keep raw slice */
    }
    return NextResponse.redirect(
      new URL(
        `/connect?error=${encodeURIComponent(`token_exchange_failed: ${detail}`)}`,
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

  await saveTokenResponseToSession(tokenJson, env);

  return NextResponse.redirect(new URL("/status", url.origin));
}
