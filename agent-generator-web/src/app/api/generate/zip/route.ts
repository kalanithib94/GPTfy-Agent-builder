import JSZip from "jszip";
import { NextResponse } from "next/server";
import { generatedBundleSchema } from "@/lib/generation-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = generatedBundleSchema.safeParse(
    (body as { bundle?: unknown })?.bundle
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_bundle", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const b = parsed.data;
  const zip = new JSZip();
  const dev = b.parameters.agentDeveloperName;
  const handler = b.parameters.handlerClass;

  const useCaseFolder = `use-cases/${dev}`;
  zip.file(`${useCaseFolder}/AGENT_DESCRIPTION.txt`, b.agentDescription);
  zip.file(`${useCaseFolder}/AGENT_SYSTEM_PROMPT.txt`, b.agentSystemPrompt);
  zip.file(`${useCaseFolder}/INTENTS_CONFIG.md`, b.intentsConfigMd);
  zip.file(`${useCaseFolder}/GENERATED_README.md`, b.specMarkdown);
  zip.file(`${useCaseFolder}/FullConfig_AnonymousApex.apex`, b.fullConfigStubApex);

  for (const pc of b.promptCommands) {
    zip.file(`${useCaseFolder}/${pc.fileName}`, pc.content);
  }

  const clsPath = `force-app/main/default/classes/${handler}`;
  zip.file(`${clsPath}.cls`, b.handlerApex);
  zip.file(`${clsPath}.cls-meta.xml`, b.handlerMetaXml);

  zip.file(
    "DEPLOY.md",
    `# Deploy ${b.parameters.agentName}

## 1. Salesforce metadata
Deploy the \`force-app/\` folder with Salesforce CLI or VS Code.

\`\`\`bash
sf project deploy start --source-dir force-app/main/default/classes --target-org YOUR_ORG
\`\`\`

## 2. GPTfy pipeline
From your main repo root (with \`scripts/Deploy-GptfyUseCasePipeline.ps1\`):

\`\`\`powershell
$fc = Join-Path (Get-Location) 'use-cases\\${dev}\\FullConfig_AnonymousApex.apex'
.\\scripts\\Deploy-GptfyUseCasePipeline.ps1 \`
  -UseCasePath 'use-cases\\${dev}' \`
  -TargetOrg YOUR_ORG \`
  -HandlerClass '${handler}' \`
  -ExternalIdPrefix '${b.parameters.externalIdPrefix}' \`
  -AgentName '${b.parameters.agentName.replace(/'/g, "''")}' \`
  -AgentDeveloperName '${dev}' \`
  -ConnectionName '${b.parameters.connectionName.replace(/'/g, "''")}' \`
  -AgentModelConnectionName '${b.parameters.agentModelConnectionName.replace(/'/g, "''")}' \`
  -DataMappingName '${b.parameters.dataMappingName.replace(/'/g, "''")}' \`
  -FullConfigPath $fc
\`\`\`

Source: **${b.source}** (${b.source === "openai" ? "review Apex before production" : "template stub — replace health_Check_Agent with real skills"}).
`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${dev}_gptfy_bundle.zip`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
