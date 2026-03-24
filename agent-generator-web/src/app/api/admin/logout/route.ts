import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getAdminSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
