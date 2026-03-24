# Documentation index

Start here to navigate GPTfy agentic use cases, intents, and automation in this repository.

## Baseline reference (start here for new agents)

| Document | Description |
|----------|-------------|
| **[SALES_TASK_CAPTURE_BASELINE.md](./SALES_TASK_CAPTURE_BASELINE.md)** | Canonical use case: folder layout, handler patterns, pipeline script, connections (prompt vs agentic model), logging, pitfalls. **Use as the template** for new work. |

## Core guides

| Document | Description |
|----------|-------------|
| [AGENTIC_ARCHITECTURE_COMPLETE_GUIDE.md](./AGENTIC_ARCHITECTURE_COMPLETE_GUIDE.md) | Architecture: `AI_Prompt__c`, Prompt Command JSON, `AIAgenticInterface`, execution flow |
| [COMPLETE_USE_CASE_GENERATION_GUIDE.md](./COMPLETE_USE_CASE_GENERATION_GUIDE.md) | Step-by-step checklist for generating a full use case (handler, JSON, agent text, intents, CSV snippets) |
| [INTENT_ACTION_FRAMEWORK_GUIDE.md](./INTENT_ACTION_FRAMEWORK_GUIDE.md) | Intent Action Framework: data model, action types, setup and testing |
| [LLM_GENERATOR_GUIDE.md](./LLM_GENERATOR_GUIDE.md) | Shorter generator-oriented instructions for LLM-assisted artifact creation |
| [TROUBLESHOOTING_AGENTIC_OPERATIONS.md](./TROUBLESHOOTING_AGENTIC_OPERATIONS.md) | “Success” with no DML, wrong records, debug logs, handler routing |

## Automation in repo (not in `docs/`)

- **`scripts/Deploy-GptfyUseCasePipeline.ps1`** — Builds Anonymous Apex from a use-case folder: agentic prompts, Active status, `AI_Agent__c`, `AI_Agent_Skill__c`, optional `FullConfig` intents
- **`Intent_Action_Framework/`** — CSV/Data Loader patterns for intents at scale

## Example use case folder

- **`use-cases/Sales_Task_Capture_Agent/`** — Matches **SALES_TASK_CAPTURE_BASELINE.md** line-for-line in the repo
