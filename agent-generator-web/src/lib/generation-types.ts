import { z } from "zod";
import { intentDeployPlanSchema } from "./intent-deploy-types";

export const generateRequestSchema = z.object({
  useCase: z.string().min(10, "Describe the use case in at least a few sentences"),
  agentName: z.string().min(2).optional(),
  agentDeveloperName: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .optional(),
  handlerClass: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .optional(),
  externalIdPrefix: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.string().regex(/^UC:[A-Za-z0-9_]+:$/).optional()
  ),
  connectionName: z.string().optional(),
  agentModelConnectionName: z.string().optional(),
  dataMappingName: z.string().optional(),
  notes: z.string().optional(),
  openaiModel: z
    .string()
    .regex(/^[A-Za-z0-9._:-]{2,80}$/)
    .optional(),
  /** Skip OpenAI and use built-in template */
  useTemplateOnly: z.boolean().optional(),
  /**
   * When true (default), deploy merges generated handler with existing Apex in org (additive skills).
   * Set false to replace entire handler class with generated code only.
   */
  mergeExistingHandler: z.boolean().optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const generatedBundleSchema = z.object({
  version: z.literal(1),
  source: z.enum(["template", "openai"]),
  parameters: z.object({
    agentName: z.string(),
    agentDeveloperName: z.string(),
    handlerClass: z.string(),
    externalIdPrefix: z.string(),
    connectionName: z.string(),
    agentModelConnectionName: z.string(),
    dataMappingName: z.string(),
  }),
  handlerApex: z.string(),
  handlerMetaXml: z.string(),
  agentDescription: z.string(),
  agentSystemPrompt: z.string(),
  intentsConfigMd: z.string(),
  promptCommands: z.array(
    z.object({
      fileName: z.string(),
      content: z.string(),
    })
  ),
  specMarkdown: z.string(),
  fullConfigStubApex: z.string(),
  /** Structured intents for org deploy (optional — defaults applied server-side) */
  intentDeployPlan: z.array(intentDeployPlanSchema).optional(),
  /** Sample queries users can ask this agent after deploy */
  sampleQueries: z.array(z.string()).optional(),
});

export type GeneratedBundle = z.infer<typeof generatedBundleSchema>;

export const zipRequestSchema = z.object({
  bundle: generatedBundleSchema,
});

export function resolveGenerateParams(
  p: GenerateRequest,
  defaults: { agentName: string; agentDev: string; extPrefix: string } = {
    agentName: "My Generated Agent",
    agentDev: "My_Generated_Agent",
    extPrefix: "UC:GENERATED:",
  }
) {
  const sanitizeApexClassName = (raw: string, fallback: string): string => {
    let s = (raw || "").replace(/[^A-Za-z0-9_]/g, "");
    if (!s) s = fallback;
    if (!/^[A-Za-z]/.test(s)) s = `A${s}`;
    if (s.length > 40) s = s.slice(0, 40);
    return s;
  };

  const agentName = p.agentName ?? defaults.agentName;
  const agentDev =
    p.agentDeveloperName ??
    (agentName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") ||
      defaults.agentDev);
  const fromDev = agentDev.replace(/_+/g, "") + "AgenticHandler";
  const handler = sanitizeApexClassName(
    p.handlerClass ?? fromDev,
    "GeneratedAgentHandler"
  );
  const extPrefix = p.externalIdPrefix ?? defaults.extPrefix;
  const conn = p.connectionName ?? "GPTfy (OpenAI)";
  const agenticConn = p.agentModelConnectionName ?? "Response API Agentic";
  const mapping = p.dataMappingName ?? "Prepackaged - Case";

  return {
    agentName,
    agentDeveloperName: agentDev,
    handlerClass: handler,
    externalIdPrefix: extPrefix,
    connectionName: conn,
    agentModelConnectionName: agenticConn,
    dataMappingName: mapping,
  };
}
