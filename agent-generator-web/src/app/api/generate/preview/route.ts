import { NextResponse } from "next/server";
import {
  generateRequestSchema,
  resolveGenerateParams,
} from "@/lib/generation-types";
import { getSfSession } from "@/lib/session";

/**
 * Returns a structured checklist / spec for humans or a future LLM step.
 * Does not call OpenAI unless you extend this route with OPENAI_API_KEY.
 */
export async function POST(request: Request) {
  const session = await getSfSession();
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Connect Salesforce first to align output with your org." },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;
  const {
    agentName,
    agentDeveloperName: agentDev,
    handlerClass: handler,
    externalIdPrefix: extPrefix,
    connectionName: conn,
    agentModelConnectionName: agenticConn,
    dataMappingName: mapping,
  } = resolveGenerateParams(p);

  const markdown = `# Agent generation spec

## Use case
${p.useCase}

## Suggested Salesforce / GPTfy parameters
| Parameter | Value |
|-----------|-------|
| Agent name | ${agentName} |
| Agent Developer Name | ${agentDev} |
| Handler class | ${handler} |
| External Id prefix | ${extPrefix} |
| Prompt AI_Connection__c (name) | ${conn} |
| Agent AI_Model__c connection (Agentic name) | ${agenticConn} |
| AI_Data_Extraction_Mapping__c (name) | ${mapping} |

${p.notes ? `## Additional notes\n${p.notes}\n` : ""}
${p.intentResearchInstructions?.trim() ? `## Skills & intents research (sent to OpenAI)\n${p.intentResearchInstructions.trim()}\n` : ""}

## Org context (from session)
- Instance: ${session.instanceUrl ?? "(unknown)"}
- Detected GPTfy object prefix: ${session.gptfyNamespace === undefined || session.gptfyNamespace === "" ? "(unprefixed or not validated — run **Connection check**)" : session.gptfyNamespace}

## Next steps (in your repo)
1. Deploy handler to \`force-app/main/default/classes/${handler}.cls\`.
2. Add \`use-cases/${agentDev}/\` with \`*_PromptCommand.json\`, \`AGENT_SYSTEM_PROMPT.txt\`, \`AGENT_DESCRIPTION.txt\`, \`INTENTS_CONFIG.md\`, optional \`FullConfig_AnonymousApex.apex\`.
3. Run \`scripts/Deploy-GptfyUseCasePipeline.ps1\` with matching \`-HandlerClass\`, \`-ExternalIdPrefix\`, \`-AgentName\`, \`-AgentDeveloperName\`, \`-FullConfigPath\`.

See **docs/SALES_TASK_CAPTURE_BASELINE.md** and **docs/COMPLETE_USE_CASE_GENERATION_GUIDE.md** in the GPTfy agent repo.
`;

  return NextResponse.json({
    markdown,
    parameters: {
      agentName,
      agentDeveloperName: agentDev,
      handlerClass: handler,
      externalIdPrefix: extPrefix,
      connectionName: conn,
      agentModelConnectionName: agenticConn,
      dataMappingName: mapping,
    },
  });
}
