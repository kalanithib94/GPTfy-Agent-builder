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

function stripNullOptionals(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => stripNullOptionals(v));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = stripNullOptionals(v);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return value;
}

function promptStemFromFileName(fileName: string): string {
  const base = fileName.replace(/\.json$/i, "");
  return base.replace(/(_prompt)?command$/i, "").replace(/_+$/, "").trim();
}

function sanitizeSkillStem(raw: string, fallback: string): string {
  let s = (raw || "").replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (!s) s = fallback;
  if (!/^[A-Za-z]/.test(s)) s = `S_${s}`;
  return s;
}

function ensureOrgUniquePromptCommands(
  promptCommands: { fileName: string; content: string }[],
  agentDeveloperName: string
): {
  commands: { fileName: string; content: string }[];
  stemMap: Map<string, string>;
} {
  const agentPrefix = `${sanitizeSkillStem(agentDeveloperName, "Agent")}_`;
  const used = new Set<string>();
  const seenOldStems = new Set<string>();
  const stemMap = new Map<string, string>();
  const commands: { fileName: string; content: string }[] = [];

  for (let i = 0; i < promptCommands.length; i++) {
    const pc = promptCommands[i];
    const oldStemRaw = promptStemFromFileName(pc.fileName) || `skill_${i + 1}`;
    const oldStem = sanitizeSkillStem(oldStemRaw, `skill_${i + 1}`);
    if (seenOldStems.has(oldStem)) continue;
    seenOldStems.add(oldStem);

    const localStem =
      oldStem.toLowerCase().startsWith(agentPrefix.toLowerCase()) ?
        oldStem
      : `${agentPrefix}${oldStem}`;
    let candidate = sanitizeSkillStem(localStem, `${agentPrefix}skill_${i + 1}`);
    if (used.has(candidate)) {
      let n = 2;
      while (used.has(`${candidate}_${n}`)) n++;
      candidate = `${candidate}_${n}`;
    }
    used.add(candidate);
    stemMap.set(oldStem, candidate);
    commands.push({
      fileName: `${candidate}_PromptCommand.json`,
      content: pc.content,
    });
  }
  return { commands, stemMap };
}

function rewriteHandlerSkillNames(
  apex: string,
  stemMap: Map<string, string>
): string {
  let out = apex;
  for (const [oldStem, newStem] of Array.from(stemMap.entries())) {
    if (!oldStem || oldStem === newStem) continue;
    const esc = oldStem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(when\\s+')${esc}(')`, "g"), `$1${newStem}$2`);
  }
  return out;
}

function repairCommonApexSyntax(apex: string): string {
  let out = apex;
  // Auto-repair common LLM slip: JSON-style map literals in Apex.
  out = out.replace(/'([A-Za-z0-9_]+)'\s*:/g, "'$1' =>");
  return out;
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

function humanizeName(v: string): string {
  return v
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCoverageSampleQueries(
  agentName: string,
  skillNames: string[],
  intents: IntentPlanItem[] | undefined
): string[] {
  const cleanSkills = Array.from(new Set(skillNames.filter(Boolean)));
  const cleanIntents = Array.from(
    new Set((intents ?? []).map((i) => (i.name ?? "").trim()).filter(Boolean))
  );
  const queries: string[] = [];

  // One query per skill.
  for (const skill of cleanSkills) {
    queries.push(`Use skill ${skill} to help with ${humanizeName(skill)} for me.`);
  }

  // One query per intent.
  for (const intent of cleanIntents) {
    queries.push(`Trigger intent ${intent} and execute its configured actions for this request.`);
  }

  // Five mixed queries (intent + skill in one ask).
  const mixCount = Math.max(5, cleanSkills.length && cleanIntents.length ? 5 : 0);
  for (let i = 0; i < mixCount; i++) {
    const s = cleanSkills[i % Math.max(cleanSkills.length, 1)] ?? "health_Check_Agent";
    const it = cleanIntents[i % Math.max(cleanIntents.length, 1)] ?? "out_of_scope";
    queries.push(
      `Use skill ${s} first, then apply intent ${it} follow-up action if risk or missing info is detected.`
    );
  }

  // Keep order, remove duplicates, ensure non-empty.
  const deduped = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
  if (!deduped.length) return buildDefaultSampleQueries(agentName, cleanSkills);
  return deduped;
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

function compactUseCaseForGeneration(useCase: string): string {
  const lines = useCase
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 2).join("\n");
  const one = lines[0] ?? useCase.trim();
  const parts = one.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`.trim();
  return one.slice(0, 320);
}

const DISALLOWED_REQUIRED_SKILL_FIELDS = new Set([
  "ownerid",
  "createdbyid",
  "lastmodifiedbyid",
  "lastmodifieddate",
  "createddate",
  "isdeleted",
  "systemmodstamp",
  "id",
]);

function sanitizePromptCommandContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as {
      properties?: Record<string, { description?: string }>;
      required?: string[];
      [k: string]: unknown;
    };
    if (!parsed || typeof parsed !== "object") return content;
    const props = parsed.properties ?? {};
    const required = Array.isArray(parsed.required) ? parsed.required : [];
    const cleanedRequired = required.filter((key) => {
      const k = String(key ?? "").trim();
      if (!k) return false;
      const norm = normalizeKey(k);
      if (DISALLOWED_REQUIRED_SKILL_FIELDS.has(norm)) return false;
      if (!Object.prototype.hasOwnProperty.call(props, k)) return false;
      const desc = String(props[k]?.description ?? "").toLowerCase();
      if (/\boptional\b|\bnot required\b/.test(desc)) return false;
      return true;
    });
    parsed.required = Array.from(new Set(cleanedRequired));
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

function isCannedActionType(v: string | undefined): boolean {
  return (v ?? "").trim().toLowerCase() === "canned response";
}

function normalizeKey(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function intentActionClassNameFromHandler(handlerClass: string, seed = "IntentAction"): string {
  let s = `Intent_${seed}_Action`.replace(/[^A-Za-z0-9_]/g, "");
  if (!/^[A-Za-z]/.test(s)) s = `A${s}`;
  if (s.length > 40) s = s.slice(0, 40);
  return s;
}

function buildProactiveIntent(
  idx: number,
  sequence: number | undefined,
  apexClass: string
): IntentPlanItem {
  const templates = [
    {
      name: `proactive_followup_${idx}`,
      description:
        "Trigger when user intent is unclear or partially specified. Collect missing context and create a follow-up task to ensure closure.",
    },
    {
      name: `customer_risk_escalation_${idx}`,
      description:
        "Trigger when user shows urgency, repeated failure, or frustration. Proactively escalate with business-safe handling and ownership.",
    },
    {
      name: `data_quality_guardrail_${idx}`,
      description:
        "Trigger when user input is conflicting or incomplete for a safe update. Apply guardrail logic and produce clear next steps.",
    },
  ];
  const t = templates[(idx - 1) % templates.length];
  const createTaskAction = (priority: "High" | "Normal") => ({
    seq: 1,
    actionType: "Create Record",
    objectApiName: "Task",
    details: [
      {
        fieldApiName: "Subject",
        type: "AI Extracted",
        valueOrInstruction:
          "Extract a concise task subject from user urgency/problem statement.",
      },
      {
        fieldApiName: "Description",
        type: "AI Extracted",
        valueOrInstruction:
          "Summarize the issue context and next best action for the task owner.",
      },
      {
        fieldApiName: "ActivityDate",
        type: "AI Extracted",
        valueOrInstruction:
          "Extract due date from conversation; if missing infer nearest practical follow-up date.",
      },
      {
        fieldApiName: "Priority",
        type: "Hardcoded",
        valueOrInstruction: priority,
      },
      {
        fieldApiName: "Status",
        type: "Hardcoded",
        valueOrInstruction: "Not Started",
      },
      {
        fieldApiName: "WhatId",
        type: "AI Extracted",
        valueOrInstruction:
          "Link to relevant Opportunity/Account context id when available.",
      },
    ],
  });

  const updateOpportunityAction = () => ({
    seq: 1,
    actionType: "Update Field",
    objectApiName: "Opportunity",
    details: [
      {
        fieldApiName: "StageName",
        type: "AI Extracted",
        valueOrInstruction:
          "Extract the target stage from the user request and map to a valid opportunity stage.",
      },
      {
        fieldApiName: "CloseDate",
        type: "AI Extracted",
        valueOrInstruction:
          "Extract or infer the new close date from conversation context in a valid date format.",
      },
    ],
  });

  const actionsByIntent = [
    [createTaskAction("High")],
    [updateOpportunityAction()],
    [
      {
        seq: 1,
        actionType: "Apex",
        apexClass,
        apexReturnType: "Map",
      },
    ],
  ];
  return {
    name: t.name,
    sequence,
    isActive: true,
    description: t.description,
    actions: actionsByIntent[(idx - 1) % actionsByIntent.length],
  };
}

function enforceIntentPlanStrictness(
  plan: z.infer<typeof llmShape>["intentDeployPlan"] | undefined,
  skillNames: string[],
  handlerClass: string
): z.infer<typeof llmShape>["intentDeployPlan"] | undefined {
  if (!plan?.length) return plan;

  const skillKeys = new Set(skillNames.map((s) => normalizeKey(s)).filter(Boolean));
  let proactiveIdx = 1;

  const rewritten: IntentPlanItem[] = plan.map((intent) => {
    const intentKey = normalizeKey(intent.name);
    const isGreeting = intentKey.includes("greeting");
    const isOutOfScope = intentKey.includes("outofscope");
    const isSystemIntent = isGreeting || isOutOfScope;
    const duplicatesSkill = Array.from(skillKeys).some(
      (k) => k && (intentKey === k || intentKey.includes(k) || k.includes(intentKey))
    );

    if (!isSystemIntent && duplicatesSkill) {
      const actionClass = intentActionClassNameFromHandler(
        handlerClass,
        `${intent.name}_${proactiveIdx}`
      );
      const replacement = buildProactiveIntent(
        proactiveIdx++,
        intent.sequence,
        actionClass
      );
      return replacement;
    }

    const cleanedActions = intent.actions.map((a) => {
      const canned = isCannedActionType(a.actionType);
      return {
        ...a,
        language: canned ? a.language : undefined,
        cannedText: canned ? a.cannedText : undefined,
        apexReturnType:
          lowerActionType(a.actionType) === "apex"
            ? a.apexReturnType || "Map"
            : undefined,
      };
    });

    return {
      ...intent,
      actions: cleanedActions,
    };
  });

  // Ensure domain intents have complete config when using Create/Update actions.
  for (const intent of rewritten) {
    const key = normalizeKey(intent.name);
    if (key.includes("greeting") || key.includes("outofscope")) continue;
    const repaired: typeof intent.actions = [];
    for (const a of intent.actions) {
      const t = lowerActionType(a.actionType);
      if ((t === "create record" || t === "update field") && (!a.objectApiName || !a.details?.length)) {
        const actionClass = intentActionClassNameFromHandler(
          handlerClass,
          `${intent.name}_${proactiveIdx}`
        );
        const fallback = buildProactiveIntent(proactiveIdx++, intent.sequence, actionClass);
        repaired.push(...fallback.actions);
        continue;
      }
      repaired.push(a);
    }
    intent.actions = repaired;
  }

  const domain = rewritten.filter((i) => {
    const k = normalizeKey(i.name);
    return !k.includes("greeting") && !k.includes("outofscope");
  });
  const domainNonCanned = domain.flatMap((i) => i.actions).filter((a) => !isCannedActionType(a.actionType)).length;

  if (domainNonCanned < 2) {
    const needed = 2 - domainNonCanned;
    for (let i = 0; i < needed; i++) {
      const actionClass = intentActionClassNameFromHandler(
        handlerClass,
        `proactive_${proactiveIdx}`
      );
      rewritten.push(buildProactiveIntent(proactiveIdx++, 100 + i, actionClass));
    }
  }

  return rewritten;
}

function lowerActionType(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase();
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
    const actionClass = intentActionClassNameFromHandler(
      handlerClass,
      `${intent.name}_${nextSeq}`
    );
    intent.actions.push({
      seq: nextSeq,
      actionType: "Apex",
      apexClass: actionClass,
      apexReturnType: "Map",
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
    // JS-style object maps in Apex are invalid (must use => in Map literal).
    if (/'[A-Za-z0-9_]+'\s*:/.test(apex)) {
      return "invalid map/object syntax with ':' detected; Apex map literals require '=>'";
    }
    // Apex boolean operators must be && and ||, not AND/OR in code conditions.
    if (/\bif\s*\([^)]*\bAND\b/i.test(apex) || /\bif\s*\([^)]*\bOR\b/i.test(apex)) {
      return "invalid boolean operator in Apex condition; use && / || instead of AND / OR";
    }
    // Invalid describe access pattern frequently hallucinated by LLMs.
    if (/Schema\.sObjectType\.get\s*\(/.test(apex)) {
      return "invalid Schema.sObjectType.get(...) usage";
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
- domain intents MUST be proactive (underlying meaning, escalation, retention, exception handling), not duplicates of skill operations.
- do NOT create intent names/descriptions that simply mirror skill names like find/update/create task.
- language field is ONLY for Canned Response actions. Do not include language for Apex/Flow/Create Record/Update Field/Invoke Agent.
- for Apex actions, prefer apexReturnType "Map".
- for Create Record / Update Field, ALWAYS include objectApiName and at least one detail row with fieldApiName + type + valueOrInstruction.
- prefer practical business actions (e.g., create follow-up Task with owner-facing context) over empty meta actions.

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
- Prefer standard Salesforce fields in handler SOQL (Id, Name, StageName, CloseDate, AccountId, OwnerId, Status, Priority, Subject, ActivityDate).
- Do not hardcode custom fields (anything ending in __c) in handler SOQL unless they are first resolved/validated from org metadata.
- Never use JS-style object syntax ('key': value) in Apex; use Map literals with =>.
- Never write if (...) conditions with AND / OR; use && / ||.

agentSystemPrompt quality requirements:
- Minimum 500 characters, with explicit sections for responsibilities, tool usage, safety, error handling, and response style.
- MUST state tools must be called for any Salesforce operation; never claim success without tool JSON showing success.
- MUST explain what to do when record not found / permission denied / invalid input.

promptCommands: array of { "fileName": "my_skill_PromptCommand.json", "content": "<pretty-printed JSON schema string>" }
- JSON schema: type object, properties with descriptions starting with "ONLY the" where applicable, required array.
- Skill names must be globally unique in org. Prefix every skill name with ${params.agentDeveloperName}_.
- Avoid generic stems like health_check, create_task, update_record without the agent prefix.
- In required[], include ONLY truly user-supplied mandatory inputs for that skill.
- Do NOT include system-managed fields in required[] (especially OwnerId, CreatedById, LastModifiedById, Id).
- If OwnerId is needed, default server-side or infer context; do not force user to provide it in prompt command.

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

  const compactUseCase = compactUseCaseForGeneration(useCase);
  const user = JSON.stringify({
    useCase: compactUseCase,
    originalUseCase: useCase,
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

    const normalizedInner = stripNullOptionals(inner);
    const shape = llmShape.safeParse(normalizedInner);
    if (!shape.success) {
      return {
        ok: false,
        error: `Invalid model output: ${shape.error.message}`,
      };
    }

    const d = shape.data;
    const uniquePrompting = ensureOrgUniquePromptCommands(
      d.promptCommands,
      params.agentDeveloperName
    );
    const rewrittenHandlerApex = rewriteHandlerSkillNames(d.handlerApex, uniquePrompting.stemMap);
    const repairedHandlerApex = repairCommonApexSyntax(rewrittenHandlerApex);
    const sanitizedPromptCommands = uniquePrompting.commands.map((pc) => ({
      ...pc,
      content: sanitizePromptCommandContent(pc.content),
    }));
    const handlerErr = validateHandlerApex(
      repairedHandlerApex,
      params.handlerClass,
      agenticInterface
    );
    if (handlerErr) {
      return { ok: false, error: `Invalid handlerApex: ${handlerErr}` };
    }

    const skillNames = sanitizedPromptCommands
      .map((pc) => promptStemFromFileName(pc.fileName))
      .filter(Boolean);
    const intentDeployPlanDraft = ensureIntentActionDiversity(
      d.intentDeployPlan,
      params.handlerClass
    );
    const intentDeployPlan = enforceIntentPlanStrictness(
      intentDeployPlanDraft,
      skillNames,
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
      handlerApex: repairedHandlerApex,
      handlerMetaXml: META_XML,
      agentDescription: d.agentDescription,
      agentSystemPrompt: finalSystemPrompt,
      intentsConfigMd: d.intentsConfigMd,
      promptCommands: sanitizedPromptCommands,
      specMarkdown:
        d.specMarkdown ??
        `# ${params.agentName}\n\nAI-generated bundle. Deploy handler then run pipeline.`,
      fullConfigStubApex:
        d.fullConfigStubApex ??
        `String targetAgentName = '${params.agentName.replace(/'/g, "\\'")}';\n// TODO: intent rows`,
      intentDeployPlan,
      sampleQueries: buildCoverageSampleQueries(params.agentName, skillNames, intentDeployPlan),
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
