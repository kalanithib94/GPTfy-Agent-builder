# Sales Task Capture — Baseline Reference Use Case

This repository treats **`use-cases/Sales_Task_Capture_Agent/`** as the **canonical end-to-end example** for a GPTfy agent that combines agentic skills (tools), intent skeleton data, and scripted org setup. Copy this folder when starting a new agent; replace handler logic, JSON schemas, system prompt, and `FullConfig_AnonymousApex.apex` intents for your domain.

---

## What this use case demonstrates

| Layer | Purpose |
|--------|---------|
| **Agentic skills** | `AI_Prompt__c` rows (Type = Agentic) with `Prompt_Command__c` JSON + `SalesTaskCaptureAgenticHandler` |
| **Intents** | `AI_Agent_Intent__c` + `AI_Intent_Action__c` + details — conversational triggers (finish action types in GPTfy UI) |
| **Automation** | `scripts/Deploy-GptfyUseCasePipeline.ps1` creates/updates prompts, activates them, binds skills to `AI_Agent__c`, sets agent Active, optionally runs `FullConfig_AnonymousApex.apex` |

Skills and intents work together: skills are explicit tools the model calls; intents are patterns the platform can match for canned/create/flow/apex behavior.

---

## Folder layout (`use-cases/Sales_Task_Capture_Agent/`)

| File | Role |
|------|------|
| `SalesTaskCaptureAgenticHandler.cls` | Deployed from `force-app/main/default/classes/` — implements `AIAgenticInterface` |
| `*_PromptCommand.json` | JSON Schema per skill; **AI Prompt Name** = file base name with trailing `PromptCommand` / `Command` removed (see script rules) |
| `AGENT_SYSTEM_PROMPT.txt` | **Must** require calling tools for creates/searches; no fabricated record Ids |
| `AGENT_DESCRIPTION.txt` | Short description for `AI_Agent__c.Description__c` |
| `FullConfig_AnonymousApex.apex` | Inserts intent/action **skeleton** rows for this agent (uses placeholder `targetAgentName` replaced by pipeline) |
| `VerifyHandlerDebug_AnonymousApex.apex` | Optional: `sf apex run` to prove handler + logging (creates test data) |

---

## Handler patterns (copy into new use cases)

1. **`executeMethod(String requestParam, Map<String, Object> parameters)`** — `switch` on `requestParam`; each case must match **exactly** the **AI Prompt Name** (case-sensitive).

2. **Return JSON** — Prefer a consistent shape: `success`, `status`, `message`, plus payload fields (`taskId`, `accounts`, etc.).

3. **Resolve names in Apex when the LLM struggles** — Example: optional `accountName` on `create_Task_quick` resolves to `Task.WhatId` when exactly one `Account` matches; multiple matches return an error listing candidates so the model can ask the user or pass `whatId`.

4. **Natural-language dates** — Example: `activityDate` accepts `YYYY-MM-DD` plus words like `today`, `tomorrow`, `yesterday` (implemented in `parseFlexibleDate`). Document both in the Prompt Command `description` so the model can pass either computed ISO dates or keywords.

5. **Diagnostics** — `System.debug(LoggingLevel.ERROR, 'PREFIX | …')` is used so lines still appear when the org’s Debug Level sets **Apex Code** to INFO/WARN (which hides plain `System.debug()` / INFO). Search logs for your prefix (e.g. `STC_Agentic`).

6. **Apex pitfalls** — Do not use **`desc`** as a local variable name (parses like reserved context). Use `body`, `notes`, `taskDescription`, etc.

---

## Prompt Command + system prompt

- Descriptions should tell the model **when** to call the function and **how** to fill fields (required vs optional, enums, Id patterns).

- The **system prompt** should state explicitly: **do not claim a record was created or found unless the tool response confirms it.** This reduces “hallucinated” success cards when the model never invoked Apex.

---

## Automation: `scripts/Deploy-GptfyUseCasePipeline.ps1`

From the repo root (example for this use case):

```powershell
$fc = Join-Path (Get-Location) 'use-cases\Sales_Task_Capture_Agent\FullConfig_AnonymousApex.apex'
.\scripts\Deploy-GptfyUseCasePipeline.ps1 `
  -UseCasePath 'use-cases\Sales_Task_Capture_Agent' `
  -TargetOrg '<your-org-alias-or-username>' `
  -HandlerClass 'SalesTaskCaptureAgenticHandler' `
  -ExternalIdPrefix 'UC:SALES_TASK:' `
  -AgentName 'Sales Task Capture Agent' `
  -AgentDeveloperName 'Sales_Task_Capture_Agent' `
  -FullConfigPath $fc
```

**First run** creates intents; **reruns** skip duplicate intent names. Use **`-SkipIntents`** after the first successful run if you only need to refresh prompts/agent text.

Important parameters:

| Parameter | Meaning |
|-----------|---------|
| `-ConnectionName` | `AI_Connection__c.Name` for **`AI_Prompt__c`** (default `GPTfy (OpenAI)`) |
| `-AgentModelConnectionName` | Preferred **`AI_Connection__c.Name`** where **`Type__c = 'Agentic'`** for **`AI_Agent__c.AI_Model__c`** |
| `-DataMappingName` | `AI_Data_Extraction_Mapping__c.Name` for prompts |
| `-ExternalIdPrefix` | Stored on `AI_Prompt__c.External_Id__c` for idempotent upserts and skill junction cleanup |

The script embeds JSON and text into Anonymous Apex (UTF-8 without BOM). Deploy the handler **before** running the pipeline.

---

## GPTfy org reality checks

- **Object prefixes** — Some orgs use unprefixed `AI_Prompt__c`; others use a namespace. Anonymous Apex in `FullConfig` detects `ccai_qa__`, `ccai__`, or default.

- **`AI_Agent__c.AI_Model__c`** lookup often allows only connections with **`Type__c = 'Agentic'`**. Prompts may still use **GPTfy (OpenAI)**. The pipeline sets **prompt connection** and **agent model connection** separately.

- **Tool invocation** — Strong system prompts and schemas help; if the product supports stricter “always call tool” behavior for task creation, enable it for production.

---

## Debug logs and trace flags

- Create a **Trace Flag** for the **same user** that executes Apex (chat integration user vs your admin user).

- If the org is **over the debug log storage limit**, delete old `ApexLog` rows (Tooling API or Setup) before creating trace flags.

- See **`docs/TROUBLESHOOTING_AGENTIC_OPERATIONS.md`** for fabricated success vs missing logs.

---

## Related documentation

- **`docs/AGENTIC_ARCHITECTURE_COMPLETE_GUIDE.md`** — Full agentic architecture
- **`docs/COMPLETE_USE_CASE_GENERATION_GUIDE.md`** — File-by-file generation checklist
- **`docs/INTENT_ACTION_FRAMEWORK_GUIDE.md`** — Intent actions and UI completion
- **`docs/TROUBLESHOOTING_AGENTIC_OPERATIONS.md`** — Common failures
- **`Intent_Action_Framework/README.md`** — Bulk import templates
