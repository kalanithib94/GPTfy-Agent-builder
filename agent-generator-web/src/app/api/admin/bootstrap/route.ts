import { NextResponse } from "next/server";
import { isAdminPasswordConfigured } from "@/lib/admin-session";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai-server-config";

export const dynamic = "force-dynamic";

/** Public: whether admin UI is usable and whether OpenAI is available server-side (no secrets). */
export async function GET() {
  const key = await getOpenAIApiKey();
  return NextResponse.json({
    adminEnabled: isAdminPasswordConfigured(),
    openaiReady: Boolean(key),
    openaiModel: getOpenAIModel(),
  });
}
