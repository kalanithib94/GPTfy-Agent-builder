import { NextResponse } from "next/server";
import { z } from "zod";
import { generatedBundleSchema } from "@/lib/generation-types";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
import {
  deployBundleToConnectedOrg,
  type DeployBundleOptions,
} from "@/lib/sf-deploy-pipeline";
import { ndjsonDeployResponse } from "@/lib/deploy-ndjson";
import { getSfSession } from "@/lib/session";

const deployBodySchema = z.object({
  bundle: generatedBundleSchema,
  mergeExistingHandler: z.boolean().optional(),
  overwriteMatchingSkills: z.boolean().optional(),
  removeSkillsNotInBundle: z.boolean().optional(),
  intentDeployMode: z.enum(["create_only", "upsert", "sync"]).optional(),
  intentSyncDeleteOrgWhenBundleEmpty: z.boolean().optional(),
  /** When true, response is NDJSON stream with live deploy steps + final complete event. */
  stream: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  const parsed = deployBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const {
    bundle: bundleData,
    mergeExistingHandler,
    overwriteMatchingSkills,
    removeSkillsNotInBundle,
    intentDeployMode,
    intentSyncDeleteOrgWhenBundleEmpty,
    stream,
  } = parsed.data;

  const deployOpts: DeployBundleOptions = {
    mergeExistingHandler: mergeExistingHandler !== false,
    overwriteMatchingSkills: overwriteMatchingSkills === true,
    removeSkillsNotInBundle: removeSkillsNotInBundle === true,
    intentDeployMode,
    intentSyncDeleteOrgWhenBundleEmpty: intentSyncDeleteOrgWhenBundleEmpty === true,
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
      // non-fatal — deploy will describe objects anyway
    }
  }

  if (stream === true) {
    return ndjsonDeployResponse(async (write) => {
      write({ type: "status", message: "Checking GPTfy org metadata…" });
      await runOrgValidation();

      write({ type: "status", message: "Deploying bundle to Salesforce…" });
      const result = await deployBundleToConnectedOrg(
        session,
        bundleData,
        async () => {
          await session.save();
        },
        {
          ...deployOpts,
          onDeployStep: (step) => write({ type: "step", step }),
          onDeployError: (message) => write({ type: "error", message }),
        }
      );

      write({ type: "complete", deploy: result });
    });
  }

  await runOrgValidation();

  const result = await deployBundleToConnectedOrg(
    session,
    bundleData,
    async () => {
      await session.save();
    },
    deployOpts
  );

  return NextResponse.json(result);
}
