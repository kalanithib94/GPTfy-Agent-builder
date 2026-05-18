import { NextResponse } from "next/server";
import { z } from "zod";
import { getSalesforceAuthBase } from "@/lib/sf-endpoints";
import { parseSalesforceTokenErrorBody } from "@/lib/sf-token-error";
import { saveTokenResponseToSession, type TokenResponse } from "@/lib/sf-token-session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().min(3).max(255),
  password: z.string().min(1).max(512),
  /** Appended to password when Salesforce requires it (IP not trusted) */
  securityToken: z.string().max(64).optional(),
  sandbox: z.boolean().optional(),
});

/**
 * Salesforce OAuth 2.0 Username-Password flow. Credentials are only used server-side.
 * Connected App must allow this flow (Setup → Connected App → OAuth policies).
 */
export async function POST(request: Request) {
  const clientId = process.env.SALESFORCE_CLIENT_ID?.trim();
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET must be set on the server." },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { username, password, securityToken, sandbox } = parsed.data;
  const env = sandbox ? "sandbox" : "production";
  const tokenBase = getSalesforceAuthBase(env);

  const pwd =
    securityToken && securityToken.length > 0
      ? `${password}${securityToken}`
      : password;

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username: username.trim(),
    password: pwd,
  });

  const tokenRes = await fetch(`${tokenBase}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    const parsed = parseSalesforceTokenErrorBody(tokenText);
    const hint =
      "If you use an External Client App, username-password OAuth is often not supported — use “Production” or “Sandbox” at the top of this page instead.";
    return NextResponse.json(
      {
        error: "salesforce_login_failed",
        message: parsed.userMessage,
        hint,
        detail: parsed.raw,
        salesforce_error: parsed.error,
      },
      { status: 401 }
    );
  }

  let tokenJson: TokenResponse;
  try {
    tokenJson = JSON.parse(tokenText) as TokenResponse;
  } catch {
    return NextResponse.json({ error: "invalid_token_response" }, { status: 502 });
  }

  await saveTokenResponseToSession(tokenJson, env);

  return NextResponse.json({ ok: true });
}
