import { Redis } from "@upstash/redis";

const REDIS_KEY = "gptfy:openai_api_key";

function hasUpstashEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

async function getKeyFromRedis(): Promise<string | null> {
  if (!hasUpstashEnv()) return null;
  try {
    const redis = Redis.fromEnv();
    const v = await redis.get<string>(REDIS_KEY);
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    /* Redis unavailable or misconfigured */
  }
  return null;
}

/**
 * Shared OpenAI key for every user of this deployment.
 * Priority: `OPENAI_API_KEY` (Vercel env) → Vercel Redis / Upstash value set from /admin.
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;
  return getKeyFromRedis();
}

export async function getOpenAIKeySource(): Promise<"env" | "redis" | "none"> {
  if (process.env.OPENAI_API_KEY?.trim()) return "env";
  const fromRedis = await getKeyFromRedis();
  if (fromRedis) return "redis";
  return "none";
}

export function maskKeyHint(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null;
  return `…${key.slice(-4)}`;
}

export async function getOpenAIKeyHint(): Promise<string | null> {
  const key = await getOpenAIApiKey();
  return maskKeyHint(key);
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function isUpstashConfigured(): boolean {
  return hasUpstashEnv();
}

export async function setOpenAIKeyInRedis(apiKey: string): Promise<void> {
  if (!hasUpstashEnv()) {
    throw new Error("Redis not configured (UPSTASH_REDIS_REST_URL / TOKEN)");
  }
  const redis = Redis.fromEnv();
  await redis.set(REDIS_KEY, apiKey.trim());
}

export async function clearOpenAIKeyFromRedis(): Promise<void> {
  if (!hasUpstashEnv()) return;
  try {
    const redis = Redis.fromEnv();
    await redis.del(REDIS_KEY);
  } catch {
    /* ignore */
  }
}
