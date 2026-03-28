/**
 * Curated Salesforce platform facts for LLM prompts. Keeps generation aligned with real
 * metadata behavior (relationships, DML, Apex syntax) — "Salesforce first", not generic code.
 */
export const SALESFORCE_FIRST_LLM_CONTEXT = `
SALESFORCE-FIRST PLATFORM RULES (read before writing SOQL, DML, or any object graph):
- **Metadata truth:** Field and relationship names must match Salesforce, not other databases. When unsure of a lookup name, prefer standard objects/fields from Describe patterns or stick to well-known APIs below — do not invent fields like CaseId on CaseComment.
- **CaseComment:** Links to Case via **ParentId** (set to the Case Id). **CommentBody** holds text. Optional **IsPublished** for portal visibility. There is **no** CaseId field on CaseComment.
- **Case:** Common updates: Status, Priority, Subject, Description, ContactId, AccountId, OwnerId. Use the Case **Id** as the record identifier.
- **Task:** Uses **WhatId** (polymorphic related record) and/or **WhoId** (Contact/Lead). Subject, ActivityDate, Status, Priority are typical.
- **EmailMessage:** Relates to Case/Email threads via **ParentId** and related fields per API version — do not assume a generic CaseId field name without checking object.
- **Queries:** Use **List<SObject>** + **isEmpty()** for "maybe zero rows". Assigning **[SELECT ... LIMIT 1]** to a single SObject throws if no row exists — avoid that pattern.
- **Apex shape:** **switch on** value **{ when 'x' { } when else { } }** — not Java **switch / case:**.
- **Maps:** Apex map literals use **=>**, not JSON **:** for keys.
- **Conditions:** Use **&&** and **||** in Apex — not AND/OR keywords inside expressions.
- **Custom fields (__c):** Only use when the use case or user explicitly requires them; otherwise prefer standard fields so deploy succeeds in more orgs.
- **CRUD:** Check **Schema.sObjectType.X.isAccessible()** / **isCreateable()** / **isUpdateable()** before SOQL/DML where appropriate; handler class should be **with sharing** unless the use case demands otherwise.
- **Ids:** Treat Ids as opaque 15/18-char strings; validate **String.isBlank** before use; never fabricate Ids in tool responses.
- **Deploy / same agent record:** GPTfy **AI_Agent__c** is matched by **Agent Developer Name** (API developer name), not the display **Name**. Reusing the exact same Developer Name (and typically the same handler class + external id prefix) **updates** that agent; a different Developer Name creates a **new** agent even if the label is also "Master Agent". The connected-org UI lists agents so users can pick the correct row for **any** scenario — not a one-off for a single named agent.
- **Find by name:** For Account, Contact, Case, Lead, Opportunity, agents should expose **find_{Object}_by_Name** (SOQL search) so users are not forced to supply raw record Ids when they only know a name; follow-on tools use Ids from the find result.
`.trim();

/** Block inserted into the model system prompt so rules are always visible next to user research. */
export function getSalesforceFirstPromptBlock(): string {
  return `

${SALESFORCE_FIRST_LLM_CONTEXT}

Think from a **Salesforce-first** perspective: correct object/field API names, governor-friendly patterns, and deployable Apex. If the user describes a workflow (e.g. "add a case comment when frustrated"), map it to real objects (Case, CaseComment) and real fields (ParentId, CommentBody) — not generic SQL or invented columns.
`.trimStart();
}
