import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSalesforceAuthBase } from "@/lib/sf-endpoints";

export async function GET(request: Request) {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const redirectUri = process.env.SALESFORCE_CALLBACK_URL;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing SALESFORCE_CLIENT_ID or SALESFORCE_CALLBACK_URL" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sandbox = searchParams.get("sandbox") === "1";
  const env = sandbox ? "sandbox" : "production";
  const state = randomBytes(24).toString("hex");

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

  const base = getSalesforceAuthBase(env);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "api refresh_token offline_access openid",
    prompt: "consent",
  });

  return NextResponse.redirect(`${base}/services/oauth2/authorize?${params}`);
}
