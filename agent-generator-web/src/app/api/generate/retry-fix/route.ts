import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWithOpenAI } from "@/lib/generate-openai";
import { generatedBundleSchema } from "@/lib/generation-types";
import { getOpenAIApiKey } from "@/lib/openai-server-config";
import { buildOpenAIOrgContext } from "@/lib/org-sfdc-field-hints";
import { getSfSession } from "@/lib/session";

const retryFixSchema = z.object({
  bundle: generatedBundleSchema,
  useCase: z.string().min(10),
  notes: z.string().optional(),
  intentResearchInstructions: z.string().optional(),
  deployErrorText: z.string().min(3),
  retryNotes: z.string().optional(),
  openaiModel: z.string().regex(/^[A-Za-z0-9._:-]{2,80}$/).optional(),
  skipIntents: z.boolean().optional(),
  skillArtifactsOnly: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = retryFixSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const openaiKey = await getOpenAIApiKey();
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing; retry fix requires OpenAI." },
      { status: 400 }
    );
  }

  const session = await getSfSession();
  const p = parsed.data;
  const openAiOrgContext = await buildOpenAIOrgContext({
    instanceUrl: session.instanceUrl ?? undefined,
    accessToken: session.accessToken ?? undefined,
    gptfyNamespace: session.gptfyNamespace,
    useCase: p.useCase,
    notes: p.notes,
    intentResearchInstructions: p.intentResearchInstructions,
  });
  const ai = await generateWithOpenAI(
    openaiKey,
    p.bundle.parameters,
    p.useCase,
    p.notes,
    openAiOrgContext,
    {
      modelOverride: p.openaiModel,
      previousHandlerApex: p.bundle.handlerApex,
      deployErrorText: p.deployErrorText,
      retryNotes: p.retryNotes,
      intentResearchInstructions: p.intentResearchInstructions,
      skipIntents: p.skipIntents === true,
      skillArtifactsOnly: p.skillArtifactsOnly === true,
    }
  );

  if (!ai.ok) {
    return NextResponse.json({ error: ai.error }, { status: 502 });
  }

  return NextResponse.json({
    bundle: ai.bundle,
    warnings: ["Retry fix generated using previous Apex and deploy errors."],
  });
}
