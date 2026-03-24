import { NextResponse } from "next/server";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
import { getSfSession } from "@/lib/session";

export async function GET() {
  const session = await getSfSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const result = await runGptfyOrgValidation(
      session.instanceUrl,
      session.accessToken,
      "v59.0"
    );
    session.gptfyNamespace = result.primaryPrefix ?? undefined;
    await session.save();

    const allOk =
      result.items.every((i) => i.status === "ok") &&
      result.items.length > 0;

    return NextResponse.json({
      connected: true,
      instanceUrl: session.instanceUrl,
      username: session.username,
      orgId: session.orgId,
      userId: session.userId,
      detectedNamespace: result.primaryPrefix,
      namespaceHelp:
        result.primaryPrefix === ""
          ? "Objects appear unprefixed (common in scratch / unpackaged dev orgs)."
          : `Objects use the ${result.primaryPrefix} prefix (typical managed-package install).`,
      items: result.items,
      summary: {
        allOk,
        okCount: result.items.filter((i) => i.status === "ok").length,
        total: result.items.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "validation_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
