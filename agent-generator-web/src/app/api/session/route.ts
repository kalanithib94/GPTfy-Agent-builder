import { NextResponse } from "next/server";
import { getSfSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSfSession();
  return NextResponse.json({
    connected: Boolean(session.accessToken && session.instanceUrl),
    instanceUrl: session.instanceUrl,
    username: session.username,
    orgId: session.orgId,
    gptfyNamespace: session.gptfyNamespace ?? null,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
