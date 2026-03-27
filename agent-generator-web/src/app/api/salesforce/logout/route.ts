import { NextResponse } from "next/server";
import { getSfSession } from "@/lib/session";

export async function POST() {
  const session = await getSfSession();
  // Keep per-session client config so next login does not fall back to env defaults.
  session.accessToken = undefined;
  session.refreshToken = undefined;
  session.instanceUrl = undefined;
  session.idUrl = undefined;
  session.userId = undefined;
  session.orgId = undefined;
  session.username = undefined;
  session.gptfyNamespace = undefined;
  session.sfEnv = undefined;
  await session.save();
  return NextResponse.json({ ok: true });
}
