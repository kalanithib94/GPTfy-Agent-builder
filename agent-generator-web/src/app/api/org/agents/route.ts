import { NextResponse } from "next/server";
import { listOrgAiAgents } from "@/lib/list-org-ai-agents";
import { getSfSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSfSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const agents = await listOrgAiAgents(session.instanceUrl, session.accessToken);
    return NextResponse.json({ agents });
  } catch (e) {
    const message = e instanceof Error ? e.message : "list_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
