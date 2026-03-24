# Intent Action Framework — Use Case Reference

This folder contains reference implementations, system prompt additions, and testing artifacts for the **GPTfy Intent Action Framework** — an enhancement to the Agentic platform that enables pattern-triggered, intent-based actions inside GPTfy conversations.

---

## What Is an Intent?

An **Intent** is a conversational trigger. When a user sends a message that matches an intent's description, GPTfy automatically fires one or more **Actions** — without the user explicitly asking for a specific function.

Think of it as:
> "Whenever a user says X (or something like X), do Y automatically."

---

## Quick-Reference: Intent Action Types

| Action Type | What It Does | Key Config |
|-------------|-------------|------------|
| **Canned Response** | Replaces AI reply with a pre-written static text | Language, Response Text |
| **Update Field** | Updates a field on the context record | Object, Field, Type (AI Extracted/Hardcoded) |
| **Create Record** | Creates a new record in any Salesforce object | Object, Field Mappings |
| **Flow** | Invokes an active auto-launched Salesforce Flow | Flow API Name |
| **Apex** | Calls a custom Apex class via `AIIntentActionInterface` | Class Name, Return Type |
| **Invoke Agent** | Routes conversation to another GPTfy Agent | Target Agent |

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `README.md` | This file — overview and quick reference |
| `APEX_INTERFACE_REFERENCE.apex` | Reference Apex implementation for custom Intent Actions |
| `INTENT_SYSTEM_PROMPT_ADDITION.txt` | System prompt block auto-injected when intents are active |
| `JIRA_TESTING_CHECKLIST.md` | Complete QA checklist based on JIRA testing instructions |

---

## Objects

| Object | API Name | Purpose |
|--------|----------|---------|
| Agent Intent | `AI_Agent_Intent__c` | Defines a conversational trigger pattern |
| Intent Action | `AI_Intent_Action__c` | Defines what happens when an intent fires |
| Intent Action Detail | `AI_Intent_Action_Detail__c` | Field mappings for Update Field / Create Record |

---

## Tested Working Scenarios (EE Verified)

| Action Type | Standard Object | Custom Object | System Admin | Standard User |
|-------------|----------------|---------------|-------------|--------------|
| Canned Response | N/A | N/A | Working | Working |
| Update Field | Account (Description) | Custom_Object__c | Working | Working |
| Create Record | Case | Custom_Object_1__c | Working | Working |
| Flow | Account 360 Flow | N/A | Working | Working |
| Apex (Replace Message) | N/A | N/A | Working | — |
| Apex (Append to Message) | N/A | N/A | Working | — |

---

## Full Documentation

See [INTENT_ACTION_FRAMEWORK_GUIDE.md](../../docs/INTENT_ACTION_FRAMEWORK_GUIDE.md) for the complete architecture guide, configuration reference, and troubleshooting steps.
