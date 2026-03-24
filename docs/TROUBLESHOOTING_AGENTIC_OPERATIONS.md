# Troubleshooting Agentic Operations

## Chat shows a perfect result, but no Salesforce record (Tasks, Cases, etc.)

### Symptoms
- UI summarizes a created Task (subject, due date, related account) but **SOQL shows no row** (or only unrelated rows like a manual verify script).
- Debug logs contain **no** lines from your handler (e.g. no `STC_Agentic` prefix).

### Root causes
1. **Model did not invoke the agentic function** — The LLM answered conversationally. Fix: tighten **AGENT_SYSTEM_PROMPT.txt** (must call `create_*` / `find_*` tools; never claim success without JSON `success: true`). Refresh the agent record via **`Deploy-GptfyUseCasePipeline.ps1`** or paste prompt in UI. Enable stricter tool use in GPTfy if available.
2. **Wrong Salesforce user traced** — Apex ran as the **integration user**, but the trace flag was on **your** admin user. Add a **USER_DEBUG** trace for the user that actually runs the agent.
3. **Verify script mistaken for chat** — `VerifyHandlerDebug_AnonymousApex.apex` creates rows with subjects like “verify — delete me”. That proves DML works; it is not the chat agent.

See **[SALES_TASK_CAPTURE_BASELINE.md](./SALES_TASK_CAPTURE_BASELINE.md)** for logging and pipeline notes.

---

## "Update successful" but no actual change in Salesforce

### Symptoms
- Agent reports "Opportunity Stage Updated" or similar success message
- Record in Salesforce did not change (stage still old value after refresh)
- Logs exist but contain no debug lines

### Root Causes & Fixes

#### 1. Agent fabricating success (did not call function)
**Cause:** The LLM generated a success response without invoking the `update_Opportunity` function or before receiving a response.

**Fix:**
- Ensure the Agent System Prompt instructs: **Never claim success unless the function returned `success: true`**
- Re-publish/sync the `AGENT_SYSTEM_PROMPT.txt` to the GPTfy Agent record
- Verify the agent has access to the update_Opportunity tool/function in its configuration

#### 2. Wrong opportunity updated (multiple matches)
**Cause:** When searching by name (e.g. "Q1 Solar Deal"), `ORDER BY CreatedDate DESC LIMIT 1` returns the most recent. If multiple opportunities share that name, the wrong one may be updated.

**Fix:**
- When the user is on an Opportunity record page, the GPTfy component may pass `opportunityId` in context. Ensure the agent uses it.
- Add `accountId` as a filter when the account is known: `update_Opportunity` with `name` + `accountId` narrows the search
- Instruct users to include unique identifiers: "Update opportunity 006xxxxxxxxxx to Qualification"

#### 3. Invalid stage name (picklist mismatch)
**Cause:** The stage value passed does not exactly match the org's Opportunity StageName picklist (custom picklists vary).

**Fix:**
- Handlers now validate stage against `Opportunity.StageName.getDescribe().getPicklistValues()` and return valid values on error
- If the handler returns "Invalid stage... Valid stages: X, Y, Z", retry with one of those exact values
- Update the Prompt Command JSON `stageName` enum to match your org's picklist, or remove the enum to allow any value (validation happens in Apex)

#### 4. Debug logs empty (or missing your `System.debug` lines)
**Cause:** Apex **Debug Level** may set **Apex Code** to **INFO** or **WARN**. That **filters out** plain `System.debug()` (DEBUG) and `System.debug(LoggingLevel.INFO, …)` — so you see almost no user code lines even when the handler ran.

**Fix:**
- Prefer handler diagnostics at **`System.debug(LoggingLevel.ERROR, 'PREFIX | …')`** so lines appear under typical levels (see **`SalesTaskCaptureAgenticHandler`** in the Sales Task Capture baseline).
- Alternatively set **Apex Code** = **FINEST** or **DEBUG** on the trace flag’s Debug Level.
- Confirm the trace flag **TracedEntityId** is the **User** that executes the chat/agent request.
- If the org exceeds **debug log storage**, delete old **`ApexLog`** records before creating trace flags (Tooling API delete or Setup).

**If logs are still empty:** the handler was likely **not invoked** — see “Chat shows a perfect result…” above.

#### 5. Different handler configured
**Cause:** The GPTfy agent may be configured with `update_Opportunity_Stage_CloseDate` (requires stageName + closeDate) instead of `update_Opportunity` (stageName only).

**Fix:**
- Check AI Prompt records: `update_Opportunity` → `OpportunityManagementHandler`; `update_Opportunity_Stage_CloseDate` → `UpdateOpportunityStageDateHandler`
- `update_Opportunity_Stage_CloseDate` now supports stage-only updates (closeDate optional)
- Ensure prompt names are spelled correctly and match handler `switch` cases

---

## Quick checks

| Check | Where |
|-------|-------|
| AI Prompt Name | Setup → Custom Metadata or `ccai_qa__AI_Prompt__c` |
| Handler class | Prompt record's `ccai_qa__Agentic_Function_Class__c` / `ccai_qa__Apex_Class_Name__c` |
| Valid stages | Run: `Schema.describeSObject('Opportunity').fields.getMap().get('StageName').getDescribe().getPicklistValues()` in Execute Anonymous |
| Debug log level | Setup → Debug Logs → Trace Flag → Apex Code = FINEST |
