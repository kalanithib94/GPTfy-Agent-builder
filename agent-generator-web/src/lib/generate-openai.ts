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
  sampleQueries: z.array(z.string()).min(8).max(15).optional(),
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

type GenerateWithOpenAIOptions = {
  modelOverride?: string;
  previousHandlerApex?: string;
  deployErrorText?: string;
  retryNotes?: string;
};

type IntentPlanItem = NonNullable<z.infer<typeof llmShape>["intentDeployPlan"]>[number];

function promptStemFromFileName(fileName: string): string {
  const base = fileName.replace(/\.json$/i, "");
  return base.replace(/(_prompt)?command$/i, "").replace(/_+$/, "").trim();
}

function buildHighQualitySystemPrompt(
  agentName: string,
  useCase: string,
  notes: string | undefined,
  skillNames: string[]
): string {
  const skills = skillNames.length ? skillNames.join(", ") : "health_Check_Agent";
  return `You are ${agentName}, a Salesforce-first assistant.

CORE RESPONSIBILITIES:
- Execute this use case accurately and safely:
${useCase}
${notes?.trim() ? `\nBUSINESS NOTES:\n${notes.trim()}\n` : ""}
- Keep responses concise, factual, and action-oriented.

TOOL USAGE RULES (MANDATORY):
- For ANY Salesforce read/write operation, call the appropriate tool first.
- Never claim success unless tool JSON includes success=true.
- If a required parameter is missing, ask one focused follow-up question.
- Available skills in this build: ${skills}

SAFETY AND DATA INTEGRITY:
- Do not fabricate records, IDs, statuses, or outcomes.
- Do not perform destructive changes unless explicitly asked and authorized.
- If tool output indicates failure, explain the failure and next corrective step.

ERROR-HANDLING POLICY:
- If a tool returns validation errors, surface them clearly.
- If no matching record is found, state that explicitly and suggest a narrower query.
- If access is denied, tell the user they may need Salesforce permissions.

RESPONSE STYLE:
- Use plain language with short sections.
- After each completed tool action, summarize result and next action.
- If uncertain, say what is unknown and what you need next.
`;
}

function buildDefaultSampleQueries(agentName: string, skillNames: string[]): string[] {
  const queries: string[] = [
    "Hi, what can you do?",
    `What skills does ${agentName} have?`,
  ];
  for (const skill of skillNames.slice(0, 6)) {
    const readable = skill.replace(/_/g, " ");
    queries.push(`Can you ${readable}?`);
  }
  queries.push(
    "What happens if I give you wrong input?",
    "Can you help me with something outside your scope?"
  );
  return queries.slice(0, 10);
}

function validateSystemPromptQuality(systemPrompt: string): string | null {
  const p = systemPrompt.trim();
  if (p.length < 500) return "agentSystemPrompt too short; expected detailed operating policy";
  const mustContain = [
    /tool/i,
    /never claim success/i,
    /salesforce/i,
    /error/i,
    /responsibilit/i,
  ];
  if (mustContain.some((re) => !re.test(p))) {
    return "agentSystemPrompt missing critical behavioral sections";
  }
  return null;
}

function isCannedActionType(v: string | undefined): boolean {
  return (v ?? "").trim().toLowerCase() === "canned response";
}

function ensureIntentActionDiversity(
  plan: z.infer<typeof llmShape>["intentDeployPlan"] | undefined,
  handlerClass: string
): z.infer<typeof llmShape>["intentDeployPlan"] | undefined {
  if (!plan?.length) return plan;

  const cloned: IntentPlanItem[] = plan.map((intent) => ({
    ...intent,
    actions: intent.actions.map((a) => ({ ...a })),
  }));

  const domainIntents = cloned.filter((intent) => {
    const n = intent.name.toLowerCase();
    return !n.includes("greeting") && !n.includes("out_of_scope");
  });
  const pool = domainIntents.length ? domainIntents : cloned;

  const allActions = cloned.flatMap((intent) => intent.actions);
  const nonCannedCount = allActions.filter((a) => !isCannedActionType(a.actionType)).length;
  const minNonCanned = Math.min(2, Math.max(1, pool.length));
  if (nonCannedCount >= minNonCanned) return cloned;

  let added = 0;
  for (const intent of pool) {
    const hasNonCanned = intent.actions.some((a) => !isCannedActionType(a.actionType));
    if (hasNonCanned) continue;
    const nextSeq = (intent.actions.map((a) => a.seq).sort((a, b) => b - a)[0] ?? 0) + 1;
    intent.actions.push({
      seq: nextSeq,
      actionType: "Apex",
      apexClass: handlerClass,
      apexReturnType: "String",
    });
    added += 1;
    if (nonCannedCount + added >= minNonCanned) break;
  }

  return cloned;
}

export async function generateWithOpenAI(
  apiKey: string,
  params: GeneratedBundle["parameters"],
  useCase: string,
  notes: string | undefined,
  orgContext: {
    instanceUrl?: string;
    gptfyNamespace?: string;
  },
  options?: GenerateWithOpenAIOptions
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
    if (!/if\s*\(\s*parameters\s*==\s*null\s*\)/.test(apex)) {
      return "executeMethod must guard for null parameters";
    }
    if (!/private\s+String\s+err\s*\(/.test(apex) || !/private\s+String\s+ok\s*\(/.test(apex)) {
      return "missing private err/ok helper methods";
    }
    // Enforce maintainability: keep skill logic in private helper methods, not giant switch branches.
    if (!/private\s+String\s+[A-Za-z0-9_]+\s*\(\s*Map<\s*String\s*,\s*Object\s*>\s+[A-Za-z0-9_]+\s*\)/.test(apex)) {
      return "missing private skill helper methods (Map<String, Object> parameters)";
    }
    if (!/catch\s*\(\s*Exception\b/.test(apex)) {
      return "missing exception handling";
    }
    if (!/switch\s+on\s+requestParam\s*\{/.test(apex)) {
      return "missing required switch on requestParam block";
    }
    // Require at least one concrete skill branch.
    if (!/\bwhen\s+'[^']+'\s*\{/.test(apex)) {
      return "switch block has no concrete when branches";
    }
    // Require fallback branch and return to prevent missing-return compile errors.
    if (!/\bwhen\s+else\s*\{/.test(apex)) {
      return "switch block is missing when else fallback";
    }
    if (!/\bwhen\s+else\s*\{[\s\S]*?\breturn\b/.test(apex)) {
      return "when else block must return a String";
    }
    // Guard against Java-style switch syntax that breaks Apex.
    if (/case\s+'[^']+'\s*:/.test(apex) || /\bcase\s+[A-Za-z0-9_]+\s*:/.test(apex)) {
      return "invalid Apex switch syntax (case:) — use switch on ... when ... { }";
    }
    // SOQL assignment with LIMIT 1 throws QueryException when no rows; null check afterward is ineffective.
    if (
      /=\s*\[\s*SELECT[\s\S]{0,300}?LIMIT\s+1\s*\];\s*if\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*==\s*null\s*\)/.test(
        apex
      )
    ) {
      return "invalid single-row SOQL null-check pattern; use list query + isEmpty()";
    }
    if (expectedClass.length > 40) {
      return "handler class name exceeds Apex 40 char limit";
    }
    return null;
  };

  const retryMode =
    Boolean(options?.previousHandlerApex?.trim()) &&
    Boolean(options?.deployErrorText?.trim());

  const system = `You are an expert Salesforce Apex developer for GPTfy-style agentic agents.
Return ONLY valid JSON (no markdown) with keys:
handlerApex, agentDescription, agentSystemPrompt, intentsConfigMd, promptCommands, specMarkdown (optional), fullConfigStubApex (optional), intentDeployPlan (optional array).

intentDeployPlan: 2–8 intents. Each: name (snake_case), sequence, isActive, description (trigger text), actions[] with seq, actionType (use "Canned Response" for canned), language, cannedText for canned rows.
Action mix rules:
- greeting and out_of_scope can use Canned Response.
- domain intents MUST include non-canned actions (Create Record / Update Field / Apex / Flow / Invoke Agent) where applicable.
- avoid "mostly canned" plans; target at least 2 non-canned actions across domain intents.

handlerApex requirements:
- global with sharing class ${params.handlerClass} implements ${agenticInterface}
- Method: global String executeMethod(String requestParam, Map<String, Object> parameters)
- switch on requestParam — each when value MUST match the skill name used in promptCommands file names (stem before _PromptCommand.json per Deploy-GptfyUseCasePipeline.ps1)
- private helpers err(String), ok(Map) returning JSON.serialize with success/status/message pattern
- if parameters == null, initialize new Map<String, Object>()
- System.debug(LoggingLevel.ERROR, 'PREFIX | ...') for diagnostics; never use variable name desc
- CRUD checks via Schema.sObjectType or isAccessible/isCreateable as appropriate
- with sharing
- NEVER output Java-style "case ...:" syntax; Apex must use "switch on ... { when ... { ... } when else { ... } }".
- Ensure switch on requestParam includes at least one concrete when branch and a when else branch that returns String.
- For "find by Id" queries, do NOT use "SObject x = [SELECT ... LIMIT 1]; if (x == null)". Use list query + isEmpty() and return friendly error when not found.
- Validate required input parameters in each skill and return err(...) when missing.
- Keep each skill branch small by delegating to private helper methods (e.g., handleFindOpportunity(parameters)).

agentSystemPrompt quality requirements:
- Minimum 500 characters, with explicit sections for responsibilities, tool usage, safety, error handling, and response style.
- MUST state tools must be called for any Salesforce operation; never claim success without tool JSON showing success.
- MUST explain what to do when record not found / permission denied / invalid input.

promptCommands: array of { "fileName": "my_skill_PromptCommand.json", "content": "<pretty-printed JSON schema string>" }
- JSON schema: type object, properties with descriptions starting with "ONLY the" where applicable, required array.

intentsConfigMd: markdown, include greeting and out_of_scope intents at minimum.

fullConfigStubApex: optional Apex snippet as string with String targetAgentName = '${params.agentName.replace(/'/g, "\\'")}'; and TODO comments.

sampleQueries: array of 10 example questions a user can ask this agent after deploy. Mix skill-based queries (triggering handler tools), intent-based queries (triggering intent actions), greetings, and edge cases.

EXAMPLES (follow these patterns exactly):
1) Handler branch pattern:
global String executeMethod(String requestParam, Map<String, Object> parameters) {
  try {
    if (parameters == null) parameters = new Map<String, Object>();
    switch on requestParam {
      when 'find_opportunity' { return handleFindOpportunity(parameters); }
      when else { return err('Unsupported skill: ' + requestParam); }
    }
  } catch (Exception ex) {
    System.debug(LoggingLevel.ERROR, 'AGENT | EXCEPTION | ' + ex.getMessage());
    return err(ex.getMessage());
  }
}
private String handleFindOpportunity(Map<String, Object> parameters) {
  String oppName = (String) parameters.get('opportunity_name');
  if (String.isBlank(oppName)) return err('Missing required parameter: opportunity_name');
  if (!Schema.sObjectType.Opportunity.isAccessible()) return err('Opportunity is not accessible.');
  List<Opportunity> opps = [SELECT Id, Name, StageName, CloseDate FROM Opportunity WHERE Name = :oppName LIMIT 5];
  if (opps.isEmpty()) return err('No opportunity found for provided name.');
  return ok(new Map<String, Object>{ 'status' => 'found', 'records' => opps });
}

2) Prompt command JSON pattern:
{
  "type": "object",
  "properties": {
    "opportunity_name": {
      "type": "string",
      "description": "ONLY the exact opportunity name to search."
    }
  },
  "required": ["opportunity_name"]
}

3) System prompt quality pattern:
Include sections for:
- CORE RESPONSIBILITIES
- TOOL USAGE RULES (MANDATORY)
- SAFETY AND DATA INTEGRITY
- ERROR-HANDLING POLICY
- RESPONSE STYLE
and explicitly state "Never claim success without tool JSON showing success=true".`;

  const user = JSON.stringify({
    useCase,
    notes: notes ?? null,
    org: orgContext,
    handlerClass: params.handlerClass,
    agentDeveloperName: params.agentDeveloperName,
    mode: retryMode ? "retry_fix" : "fresh_generate",
    retry: retryMode
      ? {
          deployErrors: options?.deployErrorText ?? "",
          previousHandlerApex: options?.previousHandlerApex ?? "",
          retryNotes: options?.retryNotes ?? "",
          instruction:
            "Fix the previous handler using deployErrors. Keep working skills, repair compile/runtime issues, and return deploy-ready Apex.",
        }
      : null,
  });

  const model =
    options?.modelOverride?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini";
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

    const skillNames = d.promptCommands.map((pc) => promptStemFromFileName(pc.fileName)).filter(Boolean);
    const intentDeployPlan = ensureIntentActionDiversity(
      d.intentDeployPlan,
      params.handlerClass
    );
    const systemPromptErr = validateSystemPromptQuality(d.agentSystemPrompt);
    const finalSystemPrompt =
      systemPromptErr ?
        buildHighQualitySystemPrompt(params.agentName, useCase, notes, skillNames)
      : d.agentSystemPrompt;

    const bundle: GeneratedBundle = {
      version: 1,
      source: "openai",
      parameters: params,
      handlerApex: d.handlerApex,
      handlerMetaXml: META_XML,
      agentDescription: d.agentDescription,
      agentSystemPrompt: finalSystemPrompt,
      intentsConfigMd: d.intentsConfigMd,
      promptCommands: d.promptCommands,
      specMarkdown:
        d.specMarkdown ??
        `# ${params.agentName}\n\nAI-generated bundle. Deploy handler then run pipeline.`,
      fullConfigStubApex:
        d.fullConfigStubApex ??
        `String targetAgentName = '${params.agentName.replace(/'/g, "\\'")}';\n// TODO: intent rows`,
      intentDeployPlan,
      sampleQueries: d.sampleQueries?.length
        ? d.sampleQueries
        : buildDefaultSampleQueries(params.agentName, skillNames),
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
