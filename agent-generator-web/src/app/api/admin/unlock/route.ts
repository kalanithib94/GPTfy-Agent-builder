import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAdminSession, isAdminPasswordConfigured } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

function hashSecret(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

function safeEqualString(a: string, b: string): boolean {
  try {
    const ha = hashSecret(a);
    const hb = hashSecret(b);
    return ha.length === hb.length && timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: "Set GEN_ADMIN_SECRET (16+ chars) on the server to enable admin." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  const expected = process.env.GEN_ADMIN_SECRET!.trim();
  if (!password || !safeEqualString(password, expected)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const session = await getAdminSession();
  session.unlockedUntil = Date.now() + 8 * 60 * 60 * 1000;
  await session.save();

  return NextResponse.json({ ok: true });
}
