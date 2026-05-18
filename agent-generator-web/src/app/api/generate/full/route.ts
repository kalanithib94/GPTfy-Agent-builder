import { NextResponse } from "next/server";
import {
  generateRequestSchema,
} from "@/lib/generation-types";
import { buildBundleForPipeline } from "@/lib/pipeline-build-bundle";
import { getSfSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSfSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json(
      { error: "Connect Salesforce first." },
      { status: 401 }
    );
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
  const result = await buildBundleForPipeline(p, {
    instanceUrl: session.instanceUrl,
    accessToken: session.accessToken,
    gptfyNamespace: session.gptfyNamespace,
  });

  if (result.openaiError) {
    return NextResponse.json(
      {
        error: "openai_generation_failed",
        message: result.openaiError,
        hint: "Fix the use case description, check OPENAI_MODEL, or use Retry fix after a partial deploy. Template fallback is not used when OpenAI was requested.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    bundle: result.bundle,
    warnings: result.warnings,
    openaiConfigured: result.openaiConfigured,
  });
}
