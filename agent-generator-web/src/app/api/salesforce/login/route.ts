import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSalesforceClientConfig } from "@/lib/sf-client-config";
import { getSalesforceAuthBase } from "@/lib/sf-endpoints";
import { createPkceChallengeS256, createPkceVerifier } from "@/lib/sf-pkce";

function redirectConnectError(request: Request, message: string) {
  const u = new URL(request.url);
  const target = new URL("/connect", `${u.protocol}//${u.host}`);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const cfg = await resolveSalesforceClientConfig();
  const clientId = cfg.clientId;
  const redirectUri = cfg.callbackUrl;
  if (!clientId || !redirectUri) {
    return redirectConnectError(
      request,
      "OAuth is not configured: set SALESFORCE_CLIENT_ID and SALESFORCE_CALLBACK_URL on the server, or save per-org client config in /connect."
    );
  }

  const { searchParams } = new URL(request.url);
  const sandbox = searchParams.get("sandbox") === "1";
  const env = sandbox ? "sandbox" : "production";
  const state = randomBytes(24).toString("hex");
  /** Opt-in: set SALESFORCE_USE_PKCE=true when the External Client App requires PKCE. */
  const usePkce = process.env.SALESFORCE_USE_PKCE === "true";

  const jar = cookies();
  jar.set("sf_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  jar.set("sf_oauth_env", env, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  let codeChallenge: string | null = null;
  if (usePkce) {
    const codeVerifier = createPkceVerifier();
    codeChallenge = createPkceChallengeS256(codeVerifier);
    jar.set("sf_oauth_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

  const base = getSalesforceAuthBase(env);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "api refresh_token offline_access openid",
    prompt: "consent",
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return NextResponse.redirect(`${base}/services/oauth2/authorize?${params}`);
}
