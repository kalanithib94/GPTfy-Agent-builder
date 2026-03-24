import { NextResponse } from "next/server";
import { buildTemplateBundle } from "@/lib/generate-template-bundle";
import { generateWithOpenAI } from "@/lib/generate-openai";
import {
  generateRequestSchema,
  resolveGenerateParams,
} from "@/lib/generation-types";
import { defaultIntentDeployPlan } from "@/lib/intent-deploy-types";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
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
  const params = resolveGenerateParams(p);
  const useTemplate =
    p.useTemplateOnly === true || !process.env.OPENAI_API_KEY?.trim();

  const warnings: string[] = [];
  let bundle;

  if (!useTemplate) {
    const ai = await generateWithOpenAI(
      process.env.OPENAI_API_KEY!,
      params,
      p.useCase,
      p.notes,
      {
        instanceUrl: session.instanceUrl,
        gptfyNamespace: session.gptfyNamespace,
      }
    );
    if (ai.ok) {
      bundle = ai.bundle;
    } else {
      warnings.push(`OpenAI failed (${ai.error}). Used template bundle.`);
      bundle = buildTemplateBundle(params, p.useCase, p.notes);
    }
  } else {
    if (!p.useTemplateOnly && !process.env.OPENAI_API_KEY?.trim()) {
      warnings.push("OPENAI_API_KEY not set — template bundle.");
    }
    bundle = buildTemplateBundle(params, p.useCase, p.notes);
  }

  if (!bundle.intentDeployPlan?.length) {
    bundle.intentDeployPlan = defaultIntentDeployPlan(
      bundle.parameters.agentDeveloperName,
      bundle.parameters.agentName
    );
  }

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
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
