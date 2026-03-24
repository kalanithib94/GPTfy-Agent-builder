import { NextResponse } from "next/server";
import {
  getOpenAIApiKey,
  getOpenAIKeyHint,
  getOpenAIKeySource,
  getOpenAIModel,
} from "@/lib/openai-server-config";
import { getSfSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSfSession();
  const openaiKey = await getOpenAIApiKey();
  return NextResponse.json({
    connected: Boolean(session.accessToken && session.instanceUrl),
    instanceUrl: session.instanceUrl,
    username: session.username,
    orgId: session.orgId,
    gptfyNamespace: session.gptfyNamespace ?? null,
    openaiConfigured: Boolean(openaiKey),
    openaiKeyHint: await getOpenAIKeyHint(),
    openaiSource: await getOpenAIKeySource(),
    openaiModel: getOpenAIModel(),
  });
}
