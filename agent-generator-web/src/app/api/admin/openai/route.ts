import { NextResponse } from "next/server";
import { isAdminUnlocked } from "@/lib/admin-session";
import {
  clearOpenAIKeyFromRedis,
  getOpenAIKeyHint,
  getOpenAIKeySource,
  getOpenAIModel,
  isUpstashConfigured,
  setOpenAIKeyInRedis,
} from "@/lib/openai-server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUnlocked())) {
    return NextResponse.json({ error: "unlock_required" }, { status: 401 });
  }

  const source = await getOpenAIKeySource();
  const envBlocksRedis =
    Boolean(process.env.OPENAI_API_KEY?.trim()) && source === "env";

  return NextResponse.json({
    source,
    keyHint: await getOpenAIKeyHint(),
    model: getOpenAIModel(),
    redisConfigured: isUpstashConfigured(),
    envKeySet: Boolean(process.env.OPENAI_API_KEY?.trim()),
    note: envBlocksRedis
      ? "OPENAI_API_KEY is set in environment; that value is used for all users. Remove it on Vercel to use the key stored in Redis (set below)."
      : source === "redis"
        ? "Using shared key from Redis (all users)."
        : source === "env"
          ? "Using shared key from environment (all users)."
          : "No key configured — generation uses templates only.",
  });
}

export async function POST(request: Request) {
  if (!(await isAdminUnlocked())) {
    return NextResponse.json({ error: "unlock_required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const key =
    typeof body === "object" &&
    body !== null &&
    "openaiApiKey" in body &&
    typeof (body as { openaiApiKey: unknown }).openaiApiKey === "string"
      ? (body as { openaiApiKey: string }).openaiApiKey.trim()
      : "";

  if (!key.startsWith("sk-")) {
    return NextResponse.json(
      { error: "Key should start with sk- (OpenAI API key)." },
      { status: 400 }
    );
  }

  if (!isUpstashConfigured()) {
    return NextResponse.json(
      {
        error:
          "Vercel Redis (Upstash) is not configured. Add the Redis integration on Vercel (sets UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), or set OPENAI_API_KEY in Project → Environment Variables instead.",
      },
      { status: 400 }
    );
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is set in the environment and overrides Redis. Remove that variable on Vercel first if you want to use the key saved here.",
      },
      { status: 409 }
    );
  }

  try {
    await setOpenAIKeyInRedis(key);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "redis_write_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    keyHint: key.length >= 8 ? `…${key.slice(-4)}` : null,
  });
}

export async function DELETE() {
  if (!(await isAdminUnlocked())) {
    return NextResponse.json({ error: "unlock_required" }, { status: 401 });
  }

  await clearOpenAIKeyFromRedis();
  return NextResponse.json({ ok: true });
}
