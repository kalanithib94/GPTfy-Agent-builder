import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/generation-types";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
import { buildBundleForPipeline } from "@/lib/pipeline-build-bundle";
import { deployBundleToConnectedOrg } from "@/lib/sf-deploy-pipeline";
import { getSfSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * One-shot: generate bundle from use case + deploy to the connected org
 * (Apex, prompts, agent, skills, activate, intents).
 */
export async function POST(request: Request) {
  const session = await getSfSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "Connect Salesforce first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;
  const gen = await buildBundleForPipeline(p, {
    instanceUrl: session.instanceUrl,
    accessToken: session.accessToken,
    gptfyNamespace: session.gptfyNamespace,
  });

  if (gen.openaiError) {
    return NextResponse.json(
      {
        error: "openai_generation_failed",
        message: gen.openaiError,
        hint: "Generation failed before deploy. Adjust the use case or use Generate only to see the error, then Retry fix if needed.",
      },
      { status: 502 }
    );
  }

  const bundle = gen.bundle;
  const warnings = gen.warnings;

  try {
    const val = await runGptfyOrgValidation(
      session.instanceUrl,
      session.accessToken,
      "v59.0"
    );
    session.gptfyNamespace = val.primaryPrefix ?? undefined;
    await session.save();
  } catch {
    /* ignore */
  }

  const deploy = await deployBundleToConnectedOrg(
    session,
    bundle,
    async () => {
      await session.save();
    }
  );

  return NextResponse.json({
    bundle,
    warnings,
    deploy,
    openaiConfigured: gen.openaiConfigured,
  });
}
