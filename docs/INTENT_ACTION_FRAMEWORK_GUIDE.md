# GPTfy Intent Action Framework — Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Pre-Condition: Enabling Early Access](#pre-condition-enabling-early-access)
4. [Architecture & Process Flow](#architecture--process-flow)
5. [AI Response Format](#ai-response-format)
6. [Action Types — Configuration Reference](#action-types--configuration-reference)
   - [Canned Response](#1-canned-response)
   - [Update Field](#2-update-field)
   - [Create Record](#3-create-record)
   - [Flow](#4-flow)
   - [Apex](#5-apex)
   - [Invoke Agent](#6-invoke-agent)
7. [Setting Up an Intent — Step-by-Step](#setting-up-an-intent--step-by-step)
8. [Apex Interface Reference](#apex-interface-reference)
9. [Permissions Matrix](#permissions-matrix)
10. [Testing Guide](#testing-guide)
11. [Negative / Error Cases](#negative--error-cases)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The **Intent Action Framework** is an enhancement to GPTfy's existing Agentic Function Architecture. Where Agentic Functions handle explicit user requests via tool/function calls, **Intents** handle *pattern-matched conversational triggers* — when a user says something that matches a defined intent, one or more actions fire automatically without the user needing to invoke a specific function.

**Key distinction:**

| | Agentic Functions (Skills) | Intent Actions |
|---|---|---|
| **Trigger** | User explicitly requests an action | AI detects a conversational pattern / keyword |
| **Configuration** | `AI_Prompt__c` + Apex handler | `AI_Agent_Intent__c` + `AI_Intent_Action__c` |
| **AI Role** | Calls function and passes parameters | Identifies matching intent(s), system processes actions |
| **Use Case** | "Create a case for Account X" | "I am crying" → auto-creates a support case |

Both capabilities co-exist on the same AI Agent record. Intents are sent to the AI model alongside the system prompt at the start of each conversation.

### Automated intent skeleton (optional)

For repeatable org setup, maintain a **`FullConfig_AnonymousApex.apex`** file per use case (see **`use-cases/Sales_Task_Capture_Agent/FullConfig_AnonymousApex.apex`**). The PowerShell script **`scripts/Deploy-GptfyUseCasePipeline.ps1`** can run it after creating the agent, replacing `targetAgentName` with your **`AI_Agent__c.Name`**.

That script only creates **structure** (`AI_Agent_Intent__c`, `AI_Intent_Action__c`, `AI_Intent_Action_Detail__c`). You still complete **Action Type**, **Language** (e.g. `en` for English picklists), canned text, and object mappings in the GPTfy UI — same as manual setup.

Full narrative for skills + connections + logging: **[SALES_TASK_CAPTURE_BASELINE.md](./SALES_TASK_CAPTURE_BASELINE.md)**.

---

## Data Model

### Object 1: `AI_Agent_Intent__c` — Agent Intent

Represents a single intent that the AI can detect.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Name | `Name` | Text | The intent name / hashtag / keyword trigger |
| Description | `Description__c` | Long Text | Natural language description of WHEN this intent should fire — this is sent to the AI model to match against |
| Sequence | `Sequence__c` | Number | Order of evaluation when multiple intents match |
| Is Active | `Is_Active__c` | Checkbox | Only active intents participate in AI calls |
| Agent | `AI_Agent__c` | Master-Detail | Parent AI Agent (`AI_Agent__c`) |

> **Important:** The `Description` field is the primary signal sent to the AI model. Write it as a clear natural language trigger rule, e.g.: *"Trigger this intent when the user expresses distress, sadness, or says phrases like 'I am crying' or 'I need help'."*

---

### Object 2: `AI_Intent_Action__c` — Intent Action

Defines what happens when an intent is triggered. Each intent can have multiple actions (run in Sequence order).

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Action Type | `Action_Type__c` | Picklist | Canned Response, Update Field, Create Record, Invoke Agent, Flow, Apex |
| Description | `Description__c` | Text | Internal description; also sent to AI for parameter extraction on Update Field / Create Record |
| Sequence | `Sequence__c` | Number | Execution order within the intent |
| Language | `Language__c` | Picklist | Only applicable for **Canned Response** type; enables multi-language responses |
| Is Active | `Is_Active__c` | Checkbox | Only active actions are executed |
| Agent Intent | `AI_Agent_Intent__c` | Master-Detail | Parent Intent |

---

### Object 3: `AI_Intent_Action_Detail__c` — Intent Action Detail

Stores field mapping rows for **Update Field** and **Create Record** action types.

| Field | Type | Notes |
|-------|------|-------|
| Field API Name | Text | The field to set on the target object |
| Type | Picklist | `AI Extracted` — AI pulls value from conversation context; `Hardcoded` — fixed value |
| Value / AI Description | Text | For `Hardcoded`: the literal value. For `AI Extracted`: instructions to the AI on what to extract |
| Intent Action | Master-Detail | Parent `AI_Intent_Action__c` |

---

## Pre-Condition: Enabling Early Access

The Intents section is hidden by default behind a feature flag.

1. Go to **Setup → Custom Settings → GPTfy Settings → Manage** (Org Default)
2. Enable the **"Enable Early Access Features"** checkbox
3. Save

The **Intents** section will now be visible on all AI Agent records.

---

## Architecture & Process Flow

```
User Sends Message
        │
        ▼
GPTfy Agent (System Prompt + All Active Intents injected at start of session)
        │
        ▼
AI Model evaluates message against intent descriptions
        │
        ▼
AI returns structured JSON response:
  {
    "message": "...",       // Reply shown to user
    "intents": ["intent1"], // Matched intent names (hashtags)
    "language": "en"        // Detected language code
  }
        │
        ▼
GPTfy Backend processes matched intents (in Sequence order)
        │
        ├──► Canned Response  → Replace AI message with canned text (language-matched)
        ├──► Update Field     → SOQL/DML update on related record field
        ├──► Create Record    → DML insert on target object
        ├──► Flow             → Invocable Flow execution (record ID passed as input)
        ├──► Apex             → AIIntentActionInterface.invokeApex() called
        └──► Invoke Agent     → Route to another GPTfy Agent
        │
        ▼
Final response returned to user in chat UI
```

### How Intents Are Injected into the System Prompt

Before the first user message, GPTfy appends the following to the agent's system prompt:

```
INTENT ACTION FRAMEWORK
You have the following intents configured. When a user's message matches an intent's description,
include the intent's Name in the "intents" array of your JSON response.

[For each active intent:]
- Intent Name: <Name>
  Description: <Description>

ALWAYS respond in the following JSON format:
{
  "message": "<your conversational reply>",
  "intents": ["<intent_name_1>", "<intent_name_2>"],
  "language": "<ISO 639-1 language code>"
}

If no intents match, return an empty array for "intents".
```

---

## AI Response Format

When the Intent Action Framework is active, the AI **must** respond in this exact JSON structure:

```json
{
  "message": "I understand you are feeling upset. I have created a support case for you.",
  "intents": ["create_support_case"],
  "language": "en"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `message` | String | The conversational reply shown to the user in the chat UI |
| `intents` | Array\<String\> | List of intent `Name` values (not descriptions) that matched this message |
| `language` | String | ISO 639-1 language code detected from the conversation (e.g., `en`, `es`, `fr`) |

> The `language` field drives **Canned Response** language matching. If the AI returns `"language": "es"`, and a Canned Response action has `Language = Spanish`, the Spanish canned response will be used.

---

## Action Types — Configuration Reference

### 1. Canned Response

Replaces the AI's conversational reply with a pre-written, static text message.

**When to use:** Compliance-required responses, greetings, legal disclaimers, or any response that must be word-for-word accurate.

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Canned Response` |
| Language | Select the language for this response (e.g., English, Spanish) |
| Canned Response Text | The exact text to display to the user |

**Behavior:**
- The AI's `message` field is **discarded**
- The canned response text is shown in the chat UI instead
- If multiple Canned Response actions exist on the same intent (different languages), the one matching `language` in the AI response is used
- If no language match is found, the first active Canned Response action is used as fallback

**Example:**

```
Intent Name:    welcome_greeting
Description:    Trigger when a user first greets the agent with "hi", "hello", or "hey"
Action Type:    Canned Response
Language:       English
Response Text:  Welcome to GPTfy! How can I assist you today?
```

---

### 2. Update Field

Updates a specific field on a Salesforce record related to the current context (e.g., the Account record the agent is open on).

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Update Field` |
| Object | Target Salesforce object API name (e.g., `Account`, `Case`, `Custom_Object__c`) |
| Field Mappings | One or more rows (see below) |

**Field Mapping rows:**

| Column | Options |
|--------|---------|
| Field | API name of the field to update (e.g., `Description`) |
| Type | `AI Extracted` or `Hardcoded` |
| AI Description (if AI Extracted) | Instruction to AI: "Ask user to enter a professional description and update it" |
| Value (if Hardcoded) | A fixed literal value, e.g., `"Reviewed"` |

**Behavior:**
- `AI Extracted`: The AI uses its description instruction to pull the value from the conversation (or prompt the user for it)
- `Hardcoded`: The exact value is written to the field regardless of conversation content
- Supports both **standard** and **custom** objects
- Uses the **context record ID** (e.g., the Account page the user is on) to identify which record to update

**Example:**

```
Intent Name:    update_account_description
Description:    Whenever a user tries to update account description or says "update description"
Action Type:    Update Field
Object:         Account (Account)
Field:          Description
Type:           AI Extracted
AI Description: Ask the user to provide a professional business description and use it to update the field.
```

---

### 3. Create Record

Creates a new record in a target Salesforce object when the intent fires.

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Create Record` |
| Object | Target object (e.g., `Case`, `Custom_Object__c`) |
| Field Mappings | One or more rows (same AI Extracted / Hardcoded pattern as Update Field) |

**Behavior:**
- A new record is **inserted** (DML `insert`) in the specified object
- If required fields are omitted from the mapping, the record is still created (Salesforce defaults apply for required fields with defaults; fields without defaults may cause an error — add them to the mapping)
- The AI can link the new record to a contextual parent (e.g., linking a Case to the current Account) using `AI Extracted` with the instruction: *"Analyze the chat context and link the case to the current account"*
- Supports both **standard** and **custom** objects

**Example: Create a support Case when user expresses distress**

```
Intent Name:    create_support_case
Description:    Trigger this intent when the user says "I am Crying" or expresses distress
Action Type:    Create Record
Object:         Case (Case)

Field Mappings:
  Field: Subject      | Type: AI Extracted | AI Description: Analyze the chat and provide a suitable subject
  Field: Account ID   | Type: AI Extracted | AI Description: Analyze context and link to current account
  Field: Description  | Type: Hardcoded    | Value: This is a hardcoded description
```

---

### 4. Flow

Invokes an **active, auto-launched Salesforce Flow** when the intent fires.

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Flow` |
| Flow API Name | API name of the auto-launched Flow (searchable dropdown; only active auto-launched Flows shown) |

**Behavior:**
- GPTfy invokes the Flow using `Flow.Interview` or the Invocable Actions framework
- The **context record ID** is passed as an input variable to the Flow (use variable name `recordId` in your Flow to receive it)
- Any Salesforce Flow element is supported: Create Records, Update Records, Send Email, call Apex, sub-flows, etc.
- On graceful failure (inactive Flow, wrong API name), the AI response is still returned without crashing

**Example:**

```
Intent Name:    account_360
Description:    When a customer asks for account 360 or wants a full account summary
Action Type:    Flow
Flow API Name:  Intent_Testing_Flow
```

---

### 5. Apex

Invokes a custom Apex class that implements `ccai_qa.AIIntentActionInterface`.

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Apex` |
| Apex Class Name | API name of the class implementing `AIIntentActionInterface` |
| Return Type | `Replace Message` — replaces the AI's reply with the Apex return message; `Append to Message` — appends the Apex message to the AI's reply |

**Behavior:**
- The class's `invokeApex(Map<String, Object> request)` method is called
- `request` map contains: `agentId`, `responseBody` (the AI's message), `recordId`, `intentName`, and other context
- Return map must include `'success' => true/false` and `'message' => 'Text to show'`
- On **Replace Message**: the `message` value from the return map is shown to the user instead of the AI reply
- On **Append to Message**: the `message` is concatenated to the AI reply
- Graceful failure: if the class doesn't exist or throws, the original AI response is still returned

**Reference Implementation:**

```apex
global class GPTfyWelcome implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String agentId     = (String) request.get('agentId');
        String responseBody = (String) request.get('responseBody');

        return new Map<String, Object>{
            'success' => true,
            'message' => 'Welcome to GPTfy, EE teams welcomes you!!'
        };
    }
}
```

**Example:**

```
Intent Name:    welcome_apex
Description:    Trigger when user greets the agent
Action Type:    Apex
Apex Class:     GPTfyWelcome
Return Type:    Replace Message
```

---

### 6. Invoke Agent

Routes the conversation to a different GPTfy AI Agent.

**Configuration fields:**

| Field | Value |
|-------|-------|
| Action Type | `Invoke Agent` |
| Target Agent | The target `AI_Agent__c` record |

**Use Case:** Skill-based routing — e.g., a general-purpose agent detects a billing intent and routes to a dedicated Billing Agent.

---

## Setting Up an Intent — Step-by-Step

### Step 1: Enable Early Access

Setup → Custom Settings → GPTfy Settings → Manage → Enable **"Enable Early Access Features"** → Save

### Step 2: Open an AI Agent Record

Navigate to the AI Agent you want to add intents to (Agents tab in GPTfy app).

### Step 3: Create the Intent

1. In the **Intents** section, click **New Intent**
2. Fill in:
   - **Name**: Short hashtag-style identifier (e.g., `update_account_description`)
   - **Description**: Natural language trigger rule (this is what the AI reads)
   - **Sequence**: Numeric order (lower = higher priority)
   - **Is Active**: `true`
3. Save

### Step 4: Add Actions to the Intent

1. On the saved Intent record, in the **Actions** section, click **+** (Add Action)
2. Select the **Action Type**
3. Fill in all required configuration fields for that type
4. Set **Is Active = true**
5. Save

### Step 5: Repeat for Additional Actions

Multiple actions can be added to a single intent. They execute in **Sequence** order.

### Step 6: Test

Open a GPTfy chat tied to the AI Agent. Send a message that should trigger the intent. Verify the action(s) fire correctly.

---

## Apex Interface Reference

To create a custom Apex action, implement the following global interface:

```apex
// Namespace: ccai_qa
// Interface: AIIntentActionInterface

global interface AIIntentActionInterface {
    Map<String, Object> invokeApex(Map<String, Object> request);
}
```

### Request Map Keys

| Key | Type | Description |
|-----|------|-------------|
| `agentId` | String | Salesforce ID of the `AI_Agent__c` record |
| `responseBody` | String | The AI model's original response message |
| `recordId` | String | Salesforce ID of the context record (e.g., the Account the chat is on) |
| `intentName` | String | Name of the intent that triggered this action |
| `userId` | String | ID of the running user |
| `sessionId` | String | GPTfy chat session ID |

### Response Map Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `success` | Boolean | Yes | `true` = action succeeded; `false` = action failed (graceful) |
| `message` | String | Yes | Text to display or append in the chat |

### Full Example with All Request Fields

```apex
global class MyIntentHandler implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String agentId      = (String) request.get('agentId');
        String responseBody = (String) request.get('responseBody');
        String recordId     = (String) request.get('recordId');
        String intentName   = (String) request.get('intentName');
        String userId       = (String) request.get('userId');

        try {
            // Custom business logic here
            // e.g., query records, update fields, send emails

            return new Map<String, Object>{
                'success' => true,
                'message' => 'Action completed successfully.'
            };
        } catch (Exception e) {
            return new Map<String, Object>{
                'success' => false,
                'message' => 'An error occurred: ' + e.getMessage()
            };
        }
    }
}
```

---

## Permissions Matrix

| Action | GPTfy Admin | GPTfy User | GPTfy Portal User |
|--------|-------------|------------|-------------------|
| Create `AI_Agent_Intent__c` | Yes | No | No |
| Edit `AI_Agent_Intent__c` | Yes | No | No |
| Delete `AI_Agent_Intent__c` | Yes | No | No |
| Read `AI_Agent_Intent__c` | Yes | Yes | Yes |
| Create `AI_Intent_Action__c` | Yes | No | No |
| Edit `AI_Intent_Action__c` | Yes | No | No |
| Delete `AI_Intent_Action__c` | Yes | No | No |
| Read `AI_Intent_Action__c` | Yes | Yes | Yes |
| Create `AI_Intent_Action_Detail__c` | Yes | No | No |
| Read `AI_Intent_Action_Detail__c` | Yes | Yes | Yes |
| **Intent actions fire in conversation** | Yes | Yes | Yes |

> GPTfy Users and Portal Users can participate in intent-driven conversations (actions still fire) but cannot administer intent records.

---

## Testing Guide

### Section 1 — Intent Setup (UI)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable Early Access (Custom Settings) | Intents section visible on AI Agent |
| 2 | Create Intent (Name, Description, Sequence, Active=true) | Intent appears in Intents list |
| 3 | Edit Intent — change description | Saves correctly |
| 4 | Deactivate Intent (Active=false) | Intent does NOT fire in conversations |

### Section 2 — Action Type Tests

#### Canned Response
1. Create Intent → Add Action (Type: Canned Response) → Set language + response text → Save → Activate
2. Send a message matching the intent description
3. **Expected:** Chat displays the canned response text (not the AI's generated reply)

#### Update Field
1. Create Intent → Add Action (Type: Update Field) → Select Object → Map fields (one AI Extracted, one Hardcoded) → Save → Activate
2. Send a matching message
3. **Expected:** Open the related record — the mapped fields are updated
4. Test with both **standard** objects (e.g., Account) and **custom** objects
5. Test with both **System Admin** and **Standard User** profiles

#### Create Record
1. Create Intent → Add Action (Type: Create Record) → Select Object → Map fields → Save → Activate
2. Send a matching message
3. **Expected:** New record created in target object, linked to context record where applicable
4. Test with **Case** (standard) and a custom object
5. Note: Even if required fields are omitted from the mapping, the record is still created

#### Flow
1. Create Intent → Add Action (Type: Flow) → Select auto-launched Flow → Save → Activate
2. Send a matching message
3. **Expected:** Flow executes; verify side effects (records created/updated, emails sent, etc.)
4. Only active, auto-launched Flows appear in the dropdown

#### Apex
1. Deploy `ccai_qa.AIIntentActionInterface` implementation class to org
2. Create Intent → Add Action (Type: Apex) → Set Class Name + Return Type → Save → Activate
3. Send a matching message
4. **Expected (Replace Message):** Chat shows only the Apex class `message` return value
5. **Expected (Append to Message):** Chat shows AI reply + Apex `message` appended

### Section 3 — End-to-End Conversation

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Message matches intent | Action fires, correct response shown |
| 2 | Message does NOT match any intent | Normal AI response, no action fires |
| 3 | Intent is deactivated, send matching message | No action fires; normal AI response |

### Section 4 — Profiles

| Profile | Can Admin Intents | Actions Fire in Chat |
|---------|-------------------|----------------------|
| GPTfy Admin | Yes | Yes |
| GPTfy User | No (read only) | Yes |
| GPTfy Portal User | No (read only) | Yes |

### Section 5 — Negative / Error Cases

| Scenario | Expected Behavior |
|----------|------------------|
| Apex class name is invalid / does not exist | Graceful failure; AI response still returned; no crash |
| Flow API name is invalid / Flow is inactive | Graceful failure; AI response still returned |
| Update Field — field does not exist on object | Graceful failure; no unhandled exception |
| "Enable Early Access" disabled | Intents section disappears from AI Agent page entirely |

---

## Troubleshooting

### Intent is not triggering

**Possible causes:**
1. `Is Active` is `false` on either the Intent or the Action
2. The Intent's `Description` is too vague — rewrite it to be more specific and explicit about trigger phrases
3. The AI Agent was not re-published after adding the intent (try Save & Publish on the Agent)
4. The Early Access flag is not enabled (Intents section hidden but check Custom Settings)

**Debug steps:**
- Check the AI's raw JSON response — is `intents` array populated?
- Inspect `AI_Agent_Intent__c` and `AI_Intent_Action__c` records for `Is_Active__c = true`
- Verify the intent's `Agent__c` lookup points to the correct AI Agent

---

### Canned Response not replacing the message

- Verify the Language field on the action matches the language the AI is detecting
- Check that the Canned Response action has `Is Active = true`
- If multi-language setup, ensure each language has its own Canned Response action row with the correct Language picklist value

---

### Update Field / Create Record not persisting

- Confirm the running user has **edit/create** FLS on the target object fields
- Verify the `recordId` context is being passed to the agent (i.e., the GPTfy component is on a record page, not a global page)
- Check the AI's `intents` array — if the intent name is missing, the backend never processes the action
- Review Apex debug logs for DML exceptions (`Setup → Debug Logs`)

---

### Flow is not executing

- Confirm the Flow is in **Active** state and is **Auto-launched** type
- Verify the Flow API name is spelled correctly (case-sensitive)
- Check that `recordId` is a valid variable name in the Flow if you're using it as an input
- Review the Flow's run history in **Setup → Flows → [Flow Name] → Debug** or check debug logs

---

### Apex action not firing / wrong response

- Confirm the class name exactly matches `ccai_qa.AIIntentActionInterface` (namespace-qualified)
- Verify the class is globally accessible (`global class ... implements ccai_qa.AIIntentActionInterface`)
- Ensure the `invokeApex` method signature matches exactly: `global Map<String, Object> invokeApex(Map<String, Object> request)`
- Check that the class is deployed and not in a failed/compile-error state (`Setup → Apex Classes`)

---

## Related Documentation

- [Agentic Architecture Complete Guide](./AGENTIC_ARCHITECTURE_COMPLETE_GUIDE.md) — Agentic Functions (Skills) architecture
- [Complete Use Case Generation Guide](./COMPLETE_USE_CASE_GENERATION_GUIDE.md) — How to build new use cases
- [LLM Generator Guide](./LLM_GENERATOR_GUIDE.md) — Using AI to generate Prompt Commands and Apex handlers
- [Troubleshooting Agentic Operations](./TROUBLESHOOTING_AGENTIC_OPERATIONS.md) — Debugging agentic function issues
