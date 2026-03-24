import { z } from "zod";

export const intentActionDetailSchema = z.object({
  fieldApiName: z.string(),
  type: z.string(),
  valueOrInstruction: z.string().optional(),
});

export const intentActionDeploySchema = z.object({
  seq: z.number(),
  actionType: z.string(),
  language: z.string().optional(),
  cannedText: z.string().optional(),
  objectApiName: z.string().optional(),
  flowApiName: z.string().optional(),
  apexClass: z.string().optional(),
  apexReturnType: z.string().optional(),
  details: z.array(intentActionDetailSchema).optional(),
});

export const intentDeployPlanSchema = z.object({
  name: z.string(),
  sequence: z.number().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
  actions: z.array(intentActionDeploySchema),
});

export type IntentDeployPlan = z.infer<typeof intentDeployPlanSchema>;
export type IntentActionDeploy = z.infer<typeof intentActionDeploySchema>;

export function defaultIntentDeployPlan(
  agentDeveloperName: string,
  agentName: string
): IntentDeployPlan[] {
  const dev = agentDeveloperName;
  return [
    {
      name: `${dev}_greeting`,
      sequence: 1,
      isActive: true,
      description:
        "User sends a greeting or opens chat — hi hello hey good morning good afternoon",
      actions: [
        {
          seq: 1,
          actionType: "Canned Response",
          language: "English",
          cannedText: `Hello! I'm ${agentName}. Tell me what you'd like to do and I'll use the right tools to help.`,
        },
      ],
    },
    {
      name: `${dev}_out_of_scope`,
      sequence: 10,
      isActive: true,
      description:
        "User asks for something this agent cannot do — unrelated topics or unsupported operations",
      actions: [
        {
          seq: 1,
          actionType: "Canned Response",
          language: "English",
          cannedText:
            "I can't help with that here. Please use Salesforce directly or contact your administrator for that type of request.",
        },
      ],
    },
  ];
}
