import { NextResponse } from "next/server";
import { z } from "zod";
import { generatedBundleSchema } from "@/lib/generation-types";
import { runGptfyOrgValidation } from "@/lib/gptfy-metadata";
import { deployBundleToConnectedOrg } from "@/lib/sf-deploy-pipeline";
import { getSfSession } from "@/lib/session";

const deployBodySchema = z.object({
  bundle: generatedBundleSchema,
  mergeExistingHandler: z.boolean().optional(),
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
  const { bundle: bundleData, mergeExistingHandler } = parsed.data;

  try {
    const val = await runGptfyOrgValidation(
      session.instanceUrl,
      session.accessToken,
      "v59.0"
    );
    session.gptfyNamespace = val.primaryPrefix ?? undefined;
    await session.save();
  } catch {
    // non-fatal — deploy will describe objects anyway
  }

  const result = await deployBundleToConnectedOrg(
    session,
    bundleData,
    async () => {
      await session.save();
    },
    { mergeExistingHandler: mergeExistingHandler !== false }
  );

  return NextResponse.json(result);
}
