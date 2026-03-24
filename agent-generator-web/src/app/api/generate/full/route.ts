import { NextResponse } from "next/server";
import { buildTemplateBundle } from "@/lib/generate-template-bundle";
import { generateWithOpenAI } from "@/lib/generate-openai";
import {
  generateRequestSchema,
  resolveGenerateParams,
} from "@/lib/generation-types";
import { defaultIntentDeployPlan } from "@/lib/intent-deploy-types";
import { getSfSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSfSession();
  if (!session.accessToken) {
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
  const params = resolveGenerateParams(p);
  const useTemplate =
    p.useTemplateOnly === true || !process.env.OPENAI_API_KEY?.trim();

  let bundle;
  let warnings: string[] = [];

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
      warnings.push(`OpenAI failed (${ai.error}). Used template bundle instead.`);
      bundle = buildTemplateBundle(params, p.useCase, p.notes);
    }
  } else {
    if (!p.useTemplateOnly && !process.env.OPENAI_API_KEY?.trim()) {
      warnings.push(
        "OPENAI_API_KEY is not set — using built-in template (add key on Vercel for AI-generated code)."
      );
    }
    bundle = buildTemplateBundle(params, p.useCase, p.notes);
  }

  if (!bundle.intentDeployPlan?.length) {
    bundle.intentDeployPlan = defaultIntentDeployPlan(
      bundle.parameters.agentDeveloperName,
      bundle.parameters.agentName
    );
  }

  return NextResponse.json({
    bundle,
    warnings,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
