import { NextResponse } from "next/server";
import { buildBundleForPipeline } from "@/lib/pipeline-build-bundle";
import {
  generateRequestSchema,
} from "@/lib/generation-types";
import { defaultIntentDeployPlan } from "@/lib/intent-deploy-types";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
import {
  deployBundleToConnectedOrg,
  type DeployBundleOptions,
} from "@/lib/sf-deploy-pipeline";
import { ndjsonDeployResponse } from "@/lib/deploy-ndjson";
import { getSfSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * One-shot: generate bundle from use case + deploy to the connected org
 * (Apex, prompts, agent, skills, activate, intents).
 *
 * When `streamDeploy: true`, responds with `application/x-ndjson`: status lines, step lines, then complete.
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

  const deployOpts: DeployBundleOptions = {
    mergeExistingHandler: p.mergeExistingHandler !== false,
    overwriteMatchingSkills: p.overwriteMatchingSkills === true,
    removeSkillsNotInBundle: p.removeSkillsNotInBundle === true,
    intentDeployMode: p.intentDeployMode,
    intentSyncDeleteOrgWhenBundleEmpty: p.intentSyncDeleteOrgWhenBundleEmpty === true,
    skipIntents: p.skipIntents === true,
    skillArtifactsOnly: p.skillArtifactsOnly === true,
  };

  const orgContext = {
    instanceUrl: session.instanceUrl,
    gptfyNamespace: session.gptfyNamespace,
  };

  async function runOrgValidation() {
    try {
      const val = await runGptfyOrgValidation(
        session.instanceUrl!,
        session.accessToken!,
        "v59.0"
      );
      session.gptfyNamespace = val.primaryPrefix ?? undefined;
      await session.save();
    } catch {
      /* ignore */
    }
  }

  if (p.streamDeploy === true) {
    return ndjsonDeployResponse(async (write) => {
      write({ type: "status", message: "Generating bundle…" });
      const { bundle, warnings, openaiConfigured } = await buildBundleForPipeline(p, orgContext);

      if (!bundle.intentDeployPlan?.length) {
        bundle.intentDeployPlan = defaultIntentDeployPlan(
          bundle.parameters.agentDeveloperName,
          bundle.parameters.agentName
        );
      }

      write({ type: "status", message: "Checking GPTfy org metadata…" });
      await runOrgValidation();

      write({ type: "status", message: "Deploying to Salesforce…" });
      const deploy = await deployBundleToConnectedOrg(
        session,
        bundle,
        async () => {
          await session.save();
        },
        {
          ...deployOpts,
          onDeployStep: (step) => write({ type: "step", step }),
          onDeployError: (message) => write({ type: "error", message }),
        }
      );

      write({
        type: "complete",
        bundle,
        warnings,
        deploy,
        openaiConfigured,
      });
    });
  }

  const { bundle, warnings, openaiConfigured } = await buildBundleForPipeline(p, orgContext);

  if (p.skipIntents === true || p.skillArtifactsOnly === true) {
    bundle.intentDeployPlan = [];
  } else if (!bundle.intentDeployPlan?.length) {
    bundle.intentDeployPlan = defaultIntentDeployPlan(
      bundle.parameters.agentDeveloperName,
      bundle.parameters.agentName
    );
  }

  await runOrgValidation();

  const deploy = await deployBundleToConnectedOrg(
    session,
    bundle,
    async () => {
      await session.save();
    },
    deployOpts
  );

  return NextResponse.json({
    bundle,
    warnings,
    deploy,
    openaiConfigured,
  });
}
