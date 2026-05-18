import { buildTemplateBundle } from "@/lib/generate-template-bundle";
import { generateWithOpenAI } from "@/lib/generate-openai";
import type { GenerateRequest, GeneratedBundle } from "@/lib/generation-types";
import { resolveGenerateParams } from "@/lib/generation-types";
import { defaultIntentDeployPlan } from "@/lib/intent-deploy-types";
import { getOpenAIApiKey, resolveOpenAIModel } from "@/lib/openai-server-config";
import { buildOpenAIOrgContext } from "@/lib/org-sfdc-field-hints";

export type PipelineBundleResult = {
  bundle: GeneratedBundle;
  warnings: string[];
  openaiConfigured: boolean;
  /** Set when OpenAI was requested but generation failed (no silent template fallback). */
  openaiError?: string;
};

/**
 * Generate bundle from use case (OpenAI or template). Used by /api/generate/full and /api/pipeline/run.
 */
export async function buildBundleForPipeline(
  p: GenerateRequest,
  orgContext: { instanceUrl: string; gptfyNamespace?: string; accessToken: string }
): Promise<PipelineBundleResult> {
  const params = resolveGenerateParams(p);
  const openaiKey = await getOpenAIApiKey();
  const useTemplate = p.useTemplateOnly === true || !openaiKey;

  const warnings: string[] = [];
  let bundle: GeneratedBundle;

  const openAiOrgContext = await buildOpenAIOrgContext({
    instanceUrl: orgContext.instanceUrl,
    accessToken: orgContext.accessToken,
    gptfyNamespace: orgContext.gptfyNamespace,
    useCase: p.useCase,
    notes: p.notes,
    intentResearchInstructions: p.intentResearchInstructions,
  });

  const model = resolveOpenAIModel(p.openaiModel);

  if (!useTemplate) {
    const ai = await generateWithOpenAI(
      openaiKey!,
      params,
      p.useCase,
      p.notes,
      openAiOrgContext,
      {
        modelOverride: model,
        intentResearchInstructions: p.intentResearchInstructions,
        skipIntents: p.skipIntents === true,
        skillArtifactsOnly: p.skillArtifactsOnly === true,
      }
    );
    if (ai.ok) {
      bundle = ai.bundle;
    } else {
      return {
        bundle: buildTemplateBundle(params, p.useCase, p.notes, {
          gptfyNamespace: orgContext.gptfyNamespace,
        }),
        warnings: [],
        openaiConfigured: true,
        openaiError: ai.error,
      };
    }
  } else {
    if (!p.useTemplateOnly && !openaiKey) {
      warnings.push(
        "No OpenAI API key on server — using built-in template. Set OPENAI_API_KEY on Vercel or save a key in /admin (Redis)."
      );
    }
    bundle = buildTemplateBundle(params, p.useCase, p.notes, {
      gptfyNamespace: orgContext.gptfyNamespace,
    });
  }

  if (p.skipIntents === true || p.skillArtifactsOnly === true) {
    bundle.intentDeployPlan = [];
  } else if (!bundle.intentDeployPlan?.length && bundle.source === "template") {
    bundle.intentDeployPlan = defaultIntentDeployPlan(
      bundle.parameters.agentDeveloperName,
      bundle.parameters.agentName
    );
  }

  return { bundle, warnings, openaiConfigured: Boolean(openaiKey) };
}
