import { NextResponse } from "next/server";
import { getSfSession } from "@/lib/session";

export async function POST() {
  const session = await getSfSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
