import type { GeneratedBundle } from "./generation-types";
import { intentDeployPlanSchema } from "./intent-deploy-types";
import { z } from "zod";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Fields returned by the model — server merges trusted \`parameters\` */
const llmShape = z.object({
  handlerApex: z.string().min(80),
  agentDescription: z.string().min(10),
  agentSystemPrompt: z.string().min(80),
  intentsConfigMd: z.string().min(30),
  promptCommands: z
    .array(
      z.object({
        fileName: z.string().min(8),
        content: z.string().min(4),
      })
    )
    .min(1),
  specMarkdown: z.string().optional(),
  fullConfigStubApex: z.string().optional(),
  intentDeployPlan: z.array(intentDeployPlanSchema).max(12).optional(),
});

const META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <status>Active</status>
</ApexClass>
`;

type OpenAIResult =
  | { ok: true; bundle: GeneratedBundle }
  | { ok: false; error: string };

export async function generateWithOpenAI(
  apiKey: string,
  params: GeneratedBundle["parameters"],
  useCase: string,
  notes: string | undefined,
  orgContext: {
    instanceUrl?: string;
    gptfyNamespace?: string;
  }
): Promise<OpenAIResult> {
  const resolveAgenticInterfaceSymbol = (gptfyNamespace?: string): string => {
    const raw = gptfyNamespace?.trim();
    if (!raw) return "AIAgenticInterface";
    const noSuffix = raw.replace(/__$/, "");
    if (!noSuffix) return "AIAgenticInterface";
    return `${noSuffix}.AIAgenticInterface`;
  };
  const agenticInterface = resolveAgenticInterfaceSymbol(orgContext.gptfyNamespace);

  const validateHandlerApex = (
    apex: string,
    expectedClass: string,
    expectedInterface: string
  ): string | null => {
    if (!new RegExp(`global\\s+with\\s+sharing\\s+class\\s+${expectedClass}\\b`).test(apex)) {
      return "missing required global class signature";
    }
    if (!apex.includes(`implements ${expectedInterface}`)) {
      return `missing expected interface ${expectedInterface}`;
    }
    if (!/global\s+String\s+executeMethod\s*\(/.test(apex)) {
      return "missing required global executeMethod signature";
    }
    // Guard against Java-style switch syntax that breaks Apex.
    if (/case\s+'[^']+'\s*:/.test(apex) || /\bcase\s+[A-Za-z0-9_]+\s*:/.test(apex)) {
      return "invalid Apex switch syntax (case:) — use switch on ... when ... { }";
    }
    if (expectedClass.length > 40) {
      return "handler class name exceeds Apex 40 char limit";
    }
    return null;
  };

  const system = `You are an expert Salesforce Apex developer for GPTfy-style agentic agents.
Return ONLY valid JSON (no markdown) with keys:
handlerApex, agentDescription, agentSystemPrompt, intentsConfigMd, promptCommands, specMarkdown (optional), fullConfigStubApex (optional), intentDeployPlan (optional array).

intentDeployPlan: 2–8 intents. Each: name (snake_case), sequence, isActive, description (trigger text), actions[] with seq, actionType (use "Canned Response" for canned), language, cannedText for canned rows. Prefer mostly Canned Response for reliability; add Create Record / Update Field only with full details[] when justified.

handlerApex requirements:
- global with sharing class ${params.handlerClass} implements ${agenticInterface}
- Method: global String executeMethod(String requestParam, Map<String, Object> parameters)
- switch on requestParam — each when value MUST match the skill name used in promptCommands file names (stem before _PromptCommand.json per Deploy-GptfyUseCasePipeline.ps1)
- private helpers err(String), ok(Map) returning JSON.serialize with success/status/message pattern
- System.debug(LoggingLevel.ERROR, 'PREFIX | ...') for diagnostics; never use variable name desc
- CRUD checks via Schema.sObjectType or isAccessible/isCreateable as appropriate
- with sharing

agentSystemPrompt: MUST state tools must be called for any Salesforce operation; never claim success without tool JSON showing success.

promptCommands: array of { "fileName": "my_skill_PromptCommand.json", "content": "<pretty-printed JSON schema string>" }
- JSON schema: type object, properties with descriptions starting with "ONLY the" where applicable, required array.

intentsConfigMd: markdown, include greeting and out_of_scope intents at minimum.

fullConfigStubApex: optional Apex snippet as string with String targetAgentName = '${params.agentName.replace(/'/g, "\\'")}'; and TODO comments.`;

  const user = JSON.stringify({
    useCase,
    notes: notes ?? null,
    org: orgContext,
    handlerClass: params.handlerClass,
    agentDeveloperName: params.agentDeveloperName,
  });

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const bodyPayload = JSON.stringify({
    model,
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 16000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const callOnce = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutMs = 120_000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: bodyPayload,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let res = await callOnce();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500));
      res = await callOnce();
    }

    const raw = await res.text();
    if (!res.ok) {
      return { ok: false, error: `OpenAI HTTP ${res.status}: ${raw.slice(0, 500)}` };
    }

    let outer: unknown;
    try {
      outer = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid JSON from OpenAI" };
    }

    const content = (outer as { choices?: { message?: { content?: string } }[] })
      .choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "No message content from OpenAI" };
    }

    let inner: unknown;
    try {
      inner = JSON.parse(content);
    } catch (e) {
      return {
        ok: false,
        error: `Model returned non-JSON body: ${(e as Error).message}`,
      };
    }

    const shape = llmShape.safeParse(inner);
    if (!shape.success) {
      return {
        ok: false,
        error: `Invalid model output: ${shape.error.message}`,
      };
    }

    const d = shape.data;
    const handlerErr = validateHandlerApex(
      d.handlerApex,
      params.handlerClass,
      agenticInterface
    );
    if (handlerErr) {
      return { ok: false, error: `Invalid handlerApex: ${handlerErr}` };
    }

    const bundle: GeneratedBundle = {
      version: 1,
      source: "openai",
      parameters: params,
      handlerApex: d.handlerApex,
      handlerMetaXml: META_XML,
      agentDescription: d.agentDescription,
      agentSystemPrompt: d.agentSystemPrompt,
      intentsConfigMd: d.intentsConfigMd,
      promptCommands: d.promptCommands,
      specMarkdown:
        d.specMarkdown ??
        `# ${params.agentName}\n\nAI-generated bundle. Deploy handler then run pipeline.`,
      fullConfigStubApex:
        d.fullConfigStubApex ??
        `String targetAgentName = '${params.agentName.replace(/'/g, "\\'")}';\n// TODO: intent rows`,
      intentDeployPlan: d.intentDeployPlan,
    };

    return { ok: true, bundle };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "The operation was aborted." || msg.includes("aborted")) {
      return {
        ok: false,
        error: "OpenAI request timed out (120s). Try again or shorten the use case.",
      };
    }
    return { ok: false, error: msg };
  }
}
