import { NextResponse } from "next/server";
import { z } from "zod";
import { getSfSession } from "@/lib/session";

const bodySchema = z.union([
  z.object({
    mode: z.literal("session"),
    clientId: z.string().min(10).max(1024),
    clientSecret: z.string().min(10).max(2048),
    callbackUrl: z.string().url().max(2048),
  }),
  z.object({
    mode: z.literal("env"),
  }),
]);

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 });
  }

  const session = await getSfSession();
  if (parsed.data.mode === "env") {
    session.sfClientId = undefined;
    session.sfClientSecret = undefined;
    session.sfCallbackUrl = undefined;
    await session.save();
    return NextResponse.json({ ok: true, source: "env" as const });
  }

  const callback = new URL(parsed.data.callbackUrl.trim());
  if (callback.protocol !== "https:" && callback.protocol !== "http:") {
    return NextResponse.json({ error: "callback_protocol" }, { status: 400 });
  }

  session.sfClientId = parsed.data.clientId.trim();
  session.sfClientSecret = parsed.data.clientSecret.trim();
  session.sfCallbackUrl = parsed.data.callbackUrl.trim();
  await session.save();
  return NextResponse.json({ ok: true, source: "session" as const });
}

