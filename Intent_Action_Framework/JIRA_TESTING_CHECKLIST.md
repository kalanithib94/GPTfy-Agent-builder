# Intent Action Framework — QA Testing Checklist

**Feature:** Intent Action Framework (Early Access)
**Objects:** `AI_Agent_Intent__c`, `AI_Intent_Action__c`, `AI_Intent_Action_Detail__c`
**JIRA Story:** Build Intent Action Framework for EF Implementation

---

## PRE-CONDITION

- [ ] Go to **Setup → Custom Settings → GPTfy Settings → Manage** (Org Default)
- [ ] Enable **"Enable Early Access Features"** checkbox
- [ ] Save
- [ ] Confirm the **Intents** section is now visible on an AI Agent record

---

## SECTION 1 — Intent Setup (UI)

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1.1 | Open an existing AI Agent record | Page loads successfully | | |
| 1.2 | Confirm "Intents" section is visible | Section appears on Agent page | | Requires Early Access enabled |
| 1.3 | Click "New Intent" | Intent creation form opens | | |
| 1.4 | Fill Name, Description, Sequence=1, Is Active=true → Save | Intent saved; appears in list | | |
| 1.5 | Edit the intent — change description → Save | Description updated; saves correctly | | |
| 1.6 | Set Is Active=false on the intent → Save | Intent no longer triggers in conversations | | Verify in Section 3 |
| 1.7 | Re-activate the intent (Is Active=true) | Intent fires again in conversations | | |

---

## SECTION 2A — Canned Response Action

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 2A.1 | On an active Intent, click + (Add Action) | Action creation modal opens | | |
| 2A.2 | Set Action Type = Canned Response | Language field appears | | |
| 2A.3 | Set Language = English, enter Canned Response text → Save | Action saved with Active=Yes | | |
| 2A.4 | In GPTfy chat, send a message matching the intent description | Chat displays the exact canned response text | | AI-generated message should be replaced |
| 2A.5 | Confirm the AI's original reply is NOT shown | Only canned text is visible in chat | | |
| 2A.6 | Add a second Canned Response action with Language = Spanish | Both language actions saved | | |
| 2A.7 | Send a message in Spanish that matches the intent | Spanish canned response is returned | | Verify language detection |

**EE Test Result:** Working fine (System Admin) ✓

---

## SECTION 2B — Update Field Action

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 2B.1 | Create Intent → Add Action (Type: Update Field) | Update Field Configuration section appears | | |
| 2B.2 | Set Object = Account (Account) | Field dropdown populates with Account fields | | |
| 2B.3 | Add field mapping: Field=Description, Type=AI Extracted, AI Description="Ask user for description" | Mapping row saved | | |
| 2B.4 | Add second field mapping: Field=\<any\>, Type=Hardcoded, Value=\<literal\> | Hardcoded mapping saved | | |
| 2B.5 | Activate intent and action → Test in chat | After trigger: open Account record, confirm fields updated | | |
| 2B.6 | Test with a **Custom Object** | Custom object fields also updated | | |
| 2B.7 | Test as **Standard User profile** | Update still works with proper FLS | | |
| 2B.8 | Test with AI Extracted field — verify AI prompts user or extracts from context | Field contains AI-determined value | | |
| 2B.9 | Test with Hardcoded field | Field contains exact hardcoded value | | |

**EE Test Result:** Both AI Extracted and Hardcoded — Working fine (System Admin + Standard User) ✓
Standard Object (Account) ✓ | Custom Object ✓

---

## SECTION 2C — Create Record Action

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 2C.1 | Create Intent with description: "Trigger when user says 'I am Crying'" → Add Action (Type: Create Record) | Create Record Configuration section appears | | |
| 2C.2 | Set Object = Case | Case field dropdown populates | | |
| 2C.3 | Add field: Subject, Type=AI Extracted, AI Description="Provide a suitable subject based on chat" | Mapping saved | | |
| 2C.4 | Add field: Account ID, Type=AI Extracted, AI Description="Link case to current account" | Mapping saved | | |
| 2C.5 | Add field: Description, Type=Hardcoded, Value="This is a hardcoded description" | Mapping saved | | |
| 2C.6 | Activate → Test in chat: type "Im crying" on an Account page | Case record created; confirmation message in chat | | |
| 2C.7 | Open Salesforce Cases — confirm new Case exists with correct Subject | Case visible in org | | |
| 2C.8 | Verify Account Name on Case matches the context Account | Case linked to correct Account | | |
| 2C.9 | Test with required fields omitted from mapping | Record still created (Salesforce defaults apply) | | Known behavior |
| 2C.10 | Test with **Custom Object** (e.g., Custom_Object_1__c) | Custom object record created | | |
| 2C.11 | Test as **Standard User profile** — Standard Object | Create works with proper FLS | | |
| 2C.12 | Test as **Standard User profile** — Custom Object | Create works with proper FLS | | |

**EE Test Result:**
- Case (Standard Object): Working fine ✓
- Custom Object 1 (Custom Object): Working fine ✓
- Standard User (both Standard + Custom object): Working fine ✓

---

## SECTION 2D — Flow Action

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 2D.1 | Create Intent → Add Action (Type: Flow) | Flow Configuration section appears | | |
| 2D.2 | Confirm only active, auto-launched Flows appear in dropdown | Inactive/screen Flows not shown | | |
| 2D.3 | Select Flow: Intent_Testing_Flow (or any active auto-launched Flow) | Flow API name saved | | |
| 2D.4 | Activate → Test in chat with matching message | Flow executes | | |
| 2D.5 | Verify Flow side effects (records created/updated by Flow) | Expected outcomes visible in org | | |
| 2D.6 | Test as **Standard User profile** | Flow executes with running-user context | | |
| 2D.7 | Test as **System Admin** | Flow executes successfully | | |

**EE Test Result (System Admin + Standard User):** Working fine ✓

---

## SECTION 2E — Apex Action

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 2E.1 | Deploy `GPTfyWelcome` class to org (implements `ccai_qa.AIIntentActionInterface`) | Class active with no compile errors | | See APEX_INTERFACE_REFERENCE.apex |
| 2E.2 | Create Intent → Add Action (Type: Apex) | Apex Configuration section appears | | |
| 2E.3 | Set Apex Class Name = GPTfyWelcome, Return Type = Replace Message | Configuration saved | | |
| 2E.4 | Activate → Test in chat with matching message | Chat shows only the Apex-returned message | | AI reply replaced |
| 2E.5 | Change Return Type to Append to Message → Test again | Chat shows AI reply + Apex message appended | | Both messages visible |
| 2E.6 | Verify Apex-returned message appears correctly in both return modes | Correct behavior for each mode | | |

**EE Test Result:**
- Replace Message: Working fine ✓ — only Apex class message shown
- Append to Message: Working fine ✓ — AI reply + Apex message shown together

---

## SECTION 3 — End-to-End Conversation Tests

| # | Test Step | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.1 | Send a message that MATCHES a configured active intent | Correct action fires; response reflects intent | |
| 3.2 | Verify: no error message shown to user | Chat response is clean | |
| 3.3 | If Update Field — open related record, confirm field updated | Field contains new value | |
| 3.4 | If Create Record — confirm new record created in target object | Record visible in Salesforce | |
| 3.5 | If Flow — verify expected side effects of Flow execution | Flow outcomes verified | |
| 3.6 | If Apex — verify Apex side effects and message display | Correct message shown per Return Type | |
| 3.7 | Send a message that does NOT match any intent | Normal AI response; no action fires | |
| 3.8 | Deactivate intent (Is Active=false) → send matching message again | Action does NOT fire; normal AI response | |

---

## SECTION 4 — Permissions Check

| # | Profile | Test Action | Expected Result | Status |
|---|---------|-------------|-----------------|--------|
| 4.1 | GPTfy Admin | Create `AI_Agent_Intent__c` record | Allowed | |
| 4.2 | GPTfy Admin | Edit `AI_Agent_Intent__c` record | Allowed | |
| 4.3 | GPTfy Admin | Delete `AI_Agent_Intent__c` record | Allowed | |
| 4.4 | GPTfy Admin | Create `AI_Intent_Action__c` record | Allowed | |
| 4.5 | GPTfy Admin | Edit `AI_Intent_Action__c` record | Allowed | |
| 4.6 | GPTfy Admin | Delete `AI_Intent_Action__c` record | Allowed | |
| 4.7 | GPTfy User | Attempt to create `AI_Agent_Intent__c` | Denied / read-only | |
| 4.8 | GPTfy User | Read `AI_Agent_Intent__c` | Allowed | |
| 4.9 | GPTfy User | Run agentic conversation (actions fire) | Actions fire normally | |
| 4.10 | GPTfy Portal User | Attempt to create/edit intent records | Denied / read-only | |
| 4.11 | GPTfy Portal User | Read intent records | Allowed | |
| 4.12 | GPTfy Portal User | Run agentic conversation (actions fire) | Actions fire normally | |

---

## SECTION 5 — Negative / Error Cases

| # | Scenario | Expected Behavior | Status |
|---|----------|------------------|--------|
| 5.1 | Apex action — set Apex Class Name to a non-existent class | Graceful failure; AI response still returned; no crash | |
| 5.2 | Flow action — set an invalid Flow API name | Graceful failure; AI response still returned; no unhandled exception | |
| 5.3 | Update Field — set Field API Name that does not exist on the object | Graceful failure; no 500 error thrown | |
| 5.4 | Disable "Enable Early Access Features" in GPTfy Settings | Intents section disappears from AI Agent page entirely | |
| 5.5 | Disable Early Access while conversation is in progress | Existing session behavior — verify no crash | |
| 5.6 | Intent with no active actions — trigger in chat | No action fires; normal AI response | |

---

## SECTION 6 — Einstein Bot Integration (Advanced)

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 6.1 | Einstein Bot → Invocable Apex (GPTfy Agent V2) | Bot triggers GPTfy agentic flow | | V2-7165 POC |
| 6.2 | Agent → AI Model (type=Agent, model=Dialog Flow) | Dialog Flow connector called | | |
| 6.3 | Response from Dialog Flow returned to GPTfy Agent | Response propagated back correctly | | |
| 6.4 | GPTfy Agent returns response to Einstein Bot | End-to-end response received in Bot | | |

---

## Test Summary

| Action Type | Standard Object | Custom Object | System Admin | Standard User | Status |
|-------------|----------------|---------------|-------------|--------------|--------|
| Canned Response | N/A | N/A | Working | Working | ✓ |
| Update Field | Account | Custom Object 1 | Working | Working | ✓ |
| Create Record | Case | Custom Object 1 | Working | Working | ✓ |
| Flow | Account (360 Flow) | — | Working | Working | ✓ |
| Apex (Replace) | N/A | N/A | Working | — | ✓ |
| Apex (Append) | N/A | N/A | Working | — | ✓ |

---

## Reference

- [INTENT_ACTION_FRAMEWORK_GUIDE.md](../../docs/INTENT_ACTION_FRAMEWORK_GUIDE.md) — Full architecture and configuration guide
- [APEX_INTERFACE_REFERENCE.apex](./APEX_INTERFACE_REFERENCE.apex) — Apex implementation examples
- [INTENT_SYSTEM_PROMPT_ADDITION.txt](./INTENT_SYSTEM_PROMPT_ADDITION.txt) — AI prompt injection reference
