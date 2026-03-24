# CPQ Agent – Complete Use Case

## Overview

AI Agent for **full Salesforce CPQ (Steelbrick/SBQQ)** operations:

- **Pricebook lookup** – Find pricebooks and pricebook entries **before** creating quote lines.
- **Opportunity CRUD** – Create, find, update opportunities (with optional pricebook).
- **SBQQ Quote CRUD** – Create, find, update, delete `SBQQ__Quote__c`.
- **SBQQ Quote Line CRUD** – Create, update, delete `SBQQ__QuoteLine__c` with **bundle support** (`requiredByQuoteLineId` for parent/child lines).

All operations are implemented in a single handler: **CPQAgentHandler**.

---

## Prerequisites

- Salesforce org with **Salesforce CPQ** (Steelbrick) installed.
- Custom objects: `SBQQ__Quote__c`, `SBQQ__QuoteLine__c` (and standard CPQ fields).
- User has CRUD on Opportunity, Pricebook2, PricebookEntry, and CPQ quote/quote line objects.

---

## Folder Structure

```
CPQ_Agent/
├── AGENT_DESCRIPTION.txt
├── AGENT_SYSTEM_PROMPT.txt
├── README.md
├── CPQAgentHandler.apex
├── find_Pricebook_PromptCommand.json
├── find_PricebookEntry_PromptCommand.json
├── create_CPQ_Opportunity_PromptCommand.json
├── find_CPQ_Opportunity_PromptCommand.json
├── update_CPQ_Opportunity_PromptCommand.json
├── create_SBQQ_Quote_PromptCommand.json
├── find_SBQQ_Quote_PromptCommand.json
├── update_SBQQ_Quote_PromptCommand.json
├── delete_SBQQ_Quote_PromptCommand.json
├── create_SBQQ_QuoteLine_PromptCommand.json
├── update_SBQQ_QuoteLine_PromptCommand.json
└── delete_SBQQ_QuoteLine_PromptCommand.json
```

---

## Operations Summary

| Operation | Purpose |
|----------|--------|
| **find_Pricebook** | List pricebooks (optional name/standard filter). Use before creating quotes/lines. |
| **find_PricebookEntry** | Find entries by pricebookId + productName/productCode. **Use before create_SBQQ_QuoteLine.** |
| **create_CPQ_Opportunity** | Create opportunity (name, closeDate, stageName, account). |
| **find_CPQ_Opportunity** | Find by Id or name. |
| **update_CPQ_Opportunity** | Update stage, amount, closeDate, pricebook, etc. |
| **create_SBQQ_Quote** | Create CPQ quote. Required: name. Either link to existing opportunity (opportunityId/opportunityName). Or pass accountId/accountName to **automatically find pricebook, create opportunity, then create quote**. Optional for auto-create: closeDate, stageName, amount. |
| **find_SBQQ_Quote** | Find by quoteId, opportunityId, or name. |
| **update_SBQQ_Quote** | Update status, expiration, pricebook. |
| **delete_SBQQ_Quote** | Delete quote. |
| **create_SBQQ_QuoteLine** | Add line (quoteId, quantity, product/pricebookEntry). **Bundle:** use `requiredByQuoteLineId`. |
| **update_SBQQ_QuoteLine** | Update quantity, price, number. |
| **delete_SBQQ_QuoteLine** | Delete line. |

---

## Deployment

### 1. Deploy handler

- Deploy `CPQAgentHandler.apex` to the org (e.g. via Salesforce DX or Metadata API).

### 2. Create AI Prompt records

**⚠️ Prompt Name is case-sensitive.** Use the exact names in the table below. Avoid duplicate prompts with different casing – they can cause "Method is not defined" or wrong handler routing.

Create one **AI Prompt** record per operation (e.g. on `ccai_qa__AI_Prompt__c` or your org’s equivalent):

| Prompt Name | Handler Class | Prompt Command JSON File |
|-------------|---------------|---------------------------|
| find_Pricebook | CPQAgentHandler | find_Pricebook_PromptCommand.json |
| find_PricebookEntry | CPQAgentHandler | find_PricebookEntry_PromptCommand.json |
| create_CPQ_Opportunity | CPQAgentHandler | create_CPQ_Opportunity_PromptCommand.json |
| find_CPQ_Opportunity | CPQAgentHandler | find_CPQ_Opportunity_PromptCommand.json |
| update_CPQ_Opportunity | CPQAgentHandler | update_CPQ_Opportunity_PromptCommand.json |
| create_SBQQ_Quote | CPQAgentHandler | create_SBQQ_Quote_PromptCommand.json |
| find_SBQQ_Quote | CPQAgentHandler | find_SBQQ_Quote_PromptCommand.json |
| update_SBQQ_Quote | CPQAgentHandler | update_SBQQ_Quote_PromptCommand.json |
| delete_SBQQ_Quote | CPQAgentHandler | delete_SBQQ_Quote_PromptCommand.json |
| create_SBQQ_QuoteLine | CPQAgentHandler | create_SBQQ_QuoteLine_PromptCommand.json |
| update_SBQQ_QuoteLine | CPQAgentHandler | update_SBQQ_QuoteLine_PromptCommand.json |
| delete_SBQQ_QuoteLine | CPQAgentHandler | delete_SBQQ_QuoteLine_PromptCommand.json |

### 3. Create AI Agent record

- Create one **AI Agent** record.
- Set **Description** from `AGENT_DESCRIPTION.txt`.
- Set **System Prompt** from `AGENT_SYSTEM_PROMPT.txt`.
- Associate all 12 AI Prompt records above with this agent.

---

## Create quote: automatic pricebook and opportunity

When **creating a quote** without an existing opportunity:

- Call **create_SBQQ_Quote** with **name** and **accountId** or **accountName** (and optionally closeDate, stageName, amount, description).
- The handler will:
  1. Find a pricebook (standard, or first active).
  2. Create an **Opportunity** with that pricebook and the given account.
  3. Create the **SBQQ Quote** linked to that opportunity and set the quote’s pricebook.

So a single create_SBQQ_Quote call can do: find pricebook → create opportunity → create quote. No separate find_Pricebook or create_CPQ_Opportunity needed.

## Pricebook for quote lines

Before **adding quote lines**, use **find_PricebookEntry** with the quote’s pricebook (returned when the quote was created or from find_SBQQ_Quote) and productName/productCode to get pricebookEntryId, then **create_SBQQ_QuoteLine**.

---

## Bundle quote line items

- **Parent line:** Create with `create_SBQQ_QuoteLine` (quoteId, quantity, product/pricebookEntry). Note the returned `quoteLineId`.
- **Child/option line:** Call `create_SBQQ_QuoteLine` again with the same quote, option product, quantity, and **requiredByQuoteLineId** = parent `quoteLineId`.

Handler sets `SBQQ__RequiredBy__c` when `requiredByQuoteLineId` is provided.

---

## Response format

- **Success:** `{ "success": true, "message": "...", ... }` with operation-specific data (e.g. `opportunityId`, `quoteId`, `quoteLineId`, `pricebooks`, `pricebookEntries`).
- **Error:** `{ "success": false, "error": "..." }`.

---

## Object and field notes

- **SBQQ Quote:** `SBQQ__Quote__c` – uses `SBQQ__Opportunity2__c`, `SBQQ__PriceBook__c`, `SBQQ__Status__c`, `SBQQ__ExpirationDate__c`, `SBQQ__Primary__c` where available.
- **SBQQ Quote Line:** `SBQQ__QuoteLine__c` – uses `SBQQ__Quote__c`, `SBQQ__Quantity__c`, `SBQQ__RequiredBy__c` (bundle parent), and optional `SBQQ__PricebookEntryId__c` / `SBQQ__Product__c` depending on CPQ version and schema.

Handler uses dynamic SOQL/SObject and field presence checks so it can run against different CPQ configurations.
