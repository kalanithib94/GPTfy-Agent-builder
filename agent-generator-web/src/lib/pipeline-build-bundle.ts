import { buildTemplateBundle } from "@/lib/generate-template-bundle";
import { generateWithOpenAI } from "@/lib/generate-openai";
import type { GenerateRequest, GeneratedBundle } from "@/lib/generation-types";
import { resolveGenerateParams } from "@/lib/generation-types";
import { getOpenAIApiKey } from "@/lib/openai-server-config";

export type PipelineBundleResult = {
  bundle: GeneratedBundle;
  warnings: string[];
  openaiConfigured: boolean;
};

/**
 * Generate bundle from use case (OpenAI or template). Used by /api/pipeline/run (stream + JSON).
 */
export async function buildBundleForPipeline(
  p: GenerateRequest,
  orgContext: { instanceUrl: string; gptfyNamespace?: string }
): Promise<PipelineBundleResult> {
  const params = resolveGenerateParams(p);
  const openaiKey = await getOpenAIApiKey();
  const useTemplate = p.useTemplateOnly === true || !openaiKey;

  const warnings: string[] = [];
  let bundle: GeneratedBundle;

  if (!useTemplate) {
    const ai = await generateWithOpenAI(
      openaiKey!,
      params,
      p.useCase,
      p.notes,
      orgContext,
      {
        modelOverride: p.openaiModel,
        intentResearchInstructions: p.intentResearchInstructions,
      }
    );
    if (ai.ok) {
      bundle = ai.bundle;
    } else {
      warnings.push(`OpenAI failed (${ai.error}). Used template bundle.`);
      bundle = buildTemplateBundle(params, p.useCase, p.notes, {
        gptfyNamespace: orgContext.gptfyNamespace,
      });
    }
  } else {
    if (!p.useTemplateOnly && !openaiKey) {
      warnings.push("No OpenAI API key on server — template bundle.");
    }
    bundle = buildTemplateBundle(params, p.useCase, p.notes, {
      gptfyNamespace: orgContext.gptfyNamespace,
    });
  }

  return { bundle, warnings, openaiConfigured: Boolean(openaiKey) };
}
