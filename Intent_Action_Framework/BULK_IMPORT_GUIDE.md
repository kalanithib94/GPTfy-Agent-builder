# Intent Action Framework — Bulk Import Guide

> **IMPORTANT — Read first.** This guide is based on the **verified, live object schema** queried directly from the `sgptQa` org (namespace prefix `ccai_qa`, package org). The actual field count is intentionally minimal — this is an Early Access feature and several configuration fields visible in the UI are NOT yet stored as Salesforce fields. See the gap table below.

---

## Namespace Rules

| Context | Object/Field prefix | Apex class/interface prefix |
|---------|--------------------|-----------------------------|
| Dev / QA / Package author org (`sgptQa`) | `ccai_qa__` | `ccai_qa.` |
| Any org with managed package installed | `ccai__` | `ccai.` |

The bulk insert Apex script in this folder auto-detects the correct prefix at runtime.

---

## Verified Object Model (from live org describe + SOQL)

### Hierarchy

```
ccai_qa__AI_Agent__c  ──────────────────── (exists, query to get IDs)
    └── ccai_qa__AI_Agent_Intent__c         (Level 1 — ONLY 2 fields)
            └── ccai_qa__AI_Intent_Action__c (Level 2 — ONLY 1 custom field)
                    └── ccai_qa__AI_Intent_Action_Detail__c (Level 3 — 3 custom fields)
```

---

### Object 1: `ccai_qa__AI_Agent_Intent__c`

**Confirmed fields (live describe on sgptQa):**

| Field | API Name | Type | Length | Notes |
|-------|----------|------|--------|-------|
| Intent Name | `Name` | Text | 80 | The intent keyword / hashtag — this is what the AI returns in `"intents": []` |
| AI Agent | `ccai_qa__AI_Agent__c` | Reference | 18 | Master-Detail to `ccai_qa__AI_Agent__c` |

**That's it.** No Description, Sequence, Is_Active fields exist on this object in the current package version.

---

### Object 2: `ccai_qa__AI_Intent_Action__c`

**Confirmed fields (live describe on sgptQa):**

| Field | API Name | Type | Length | Notes |
|-------|----------|------|--------|-------|
| Action Name | `Name` | Text | 80 | Auto-numbered by Salesforce (AIA-0000, AIA-0001…) |
| AI Agent Intent | `ccai_qa__AI_Agent_Intent__c` | Reference | 18 | Master-Detail to `ccai_qa__AI_Agent_Intent__c` |

**That's it.** No Action_Type, Description, Sequence, Is_Active, Language, Canned_Response, Object_Name, Flow_API_Name, Apex_Class_Name, Return_Type fields exist on this object.

---

### Object 3: `ccai_qa__AI_Intent_Action_Detail__c`

**Confirmed fields (live describe on sgptQa):**

| Field | API Name | Type | Length | Notes |
|-------|----------|------|--------|-------|
| Detail # | `Name` | Text | 80 | Auto-numbered (IAD-000000, IAD-000001…) |
| Intent Action | `ccai_qa__AI_Intent_Action__c` | Reference | 18 | Master-Detail to `ccai_qa__AI_Intent_Action__c` |
| Field API Name | `ccai_qa__Field_API_Name__c` | Text | 255 | The Salesforce field to update/set (e.g., `Subject`, `Priority`) |
| Type | `ccai_qa__Type__c` | Picklist | 255 | `AI Extracted` or `Hardcoded` |

**Missing (compared to the mature `ccai_qa__AI_Prompt_Action_Detail__c`):**
- `ccai_qa__Value__c` — the hardcoded value or AI extraction instruction. **Does not exist on this object yet.**

---

## Gap Analysis — UI Config vs Stored Fields

This table explains which UI fields are backed by Salesforce fields and which are not.

| UI Configuration | Stored in Salesforce? | Where? |
|------------------|-----------------------|--------|
| Intent Name (keyword) | **YES** | `AI_Agent_Intent__c.Name` |
| Intent → Agent link | **YES** | `AI_Agent_Intent__c.ccai_qa__AI_Agent__c` |
| Intent Description | **NOT in object** | Managed by UI/backend differently |
| Intent Sequence | **NOT in object** | Managed by UI/backend differently |
| Intent Is Active | **NOT in object** | Managed by UI/backend differently |
| Action Type (Canned Response / Update Field / etc.) | **NOT in object** | Managed by UI/backend differently |
| Action Description | **NOT in object** | Managed by UI/backend differently |
| Action Sequence | **NOT in object** | Managed by UI/backend differently |
| Action Is Active | **NOT in object** | Managed by UI/backend differently |
| Canned Response Language | **NOT in object** | Managed by UI/backend differently |
| Canned Response Text | **NOT in object** | Managed by UI/backend differently |
| Object API Name (Update Field / Create Record) | **NOT in object** | Managed by UI/backend differently |
| Flow API Name | **NOT in object** | Managed by UI/backend differently |
| Apex Class Name | **NOT in object** | Managed by UI/backend differently |
| Apex Return Type | **NOT in object** | Managed by UI/backend differently |
| Detail → Field API Name | **YES** | `AI_Intent_Action_Detail__c.ccai_qa__Field_API_Name__c` |
| Detail → Type (AI Extracted / Hardcoded) | **YES** | `AI_Intent_Action_Detail__c.ccai_qa__Type__c` |
| Detail → Hardcoded Value | **NOT in object** | `ccai_qa__Value__c` does not exist yet |
| Detail → AI Description / instruction | **NOT in object** | No field exists yet |

---

## Comparison with Mature Object (`AI_Prompt_Action__c`)

The Intent Action Framework mirrors the older Prompt Action system. The mature `ccai_qa__AI_Prompt_Action__c` has these fields that are **missing from `AI_Intent_Action__c`**:

| Field | Mature Prompt Action | Intent Action |
|-------|----------------------|---------------|
| Action Type | `ccai_qa__Action__c` (picklist) | ❌ missing |
| Description | `ccai_qa__Description__c` | ❌ missing |
| Sequence | `ccai_qa__Sequence__c` | ❌ missing |
| Object Name | `ccai_qa__Object_Name__c` | ❌ missing |
| Flow API Name | `ccai_qa__Flow_API_Name__c` | ❌ missing |
| Apex Class Name | `ccai_qa__Apex_Class_Name__c` | ❌ missing |
| Action Label / JSON | `ccai_qa__Action_Label__c` | ❌ missing |

The mature `ccai_qa__AI_Prompt_Action_Detail__c` has `ccai_qa__Value__c` (131,072 char textarea) which is **missing from `AI_Intent_Action_Detail__c`**.

---

## What CAN Be Bulk Imported Right Now

Only the structural skeleton can be imported — the Intent name, its agent parent, the Action record (a container only), and the Detail rows (field name + type, but NOT the value).

**The rich configuration (action type, canned response, language, object, flow, apex, values, AI instructions) must be completed through the GPTfy UI after the structural import.**

---

## Import Method — Anonymous Apex (Recommended)

**File:** `import-templates/IntentsBulkInsert_AnonymousApex.apex`

Creates the structural skeleton (Intent + Action + Detail containers) for all 6 agents. After running, open each record in the GPTfy UI to complete the Action Type and configuration.

**Steps:**
1. Developer Console → Debug → Open Execute Anonymous Window
2. Run `SchemaDiscovery_RunFirst.apex` first to confirm agent Names in your org
3. Update `targetAgentNames` in the insert script to match your org's agent Names exactly
4. Paste and Execute the insert script
5. Check Logs for `✅` confirmations
6. In GPTfy UI: open each created Intent → open each Action → complete the Action Type and config fields

---

## Import Method — Data Loader (CSV)

**Files:** `import-templates/Step1_Intents.csv`, `Step2_Intent_Actions.csv`, `Step3_Action_Details.csv`

Import in strict order. After each step, export the inserted IDs for use as parent references in the next step.

**Namespace for installed orgs:** Replace all column header prefixes `ccai_qa__` → `ccai__`.

---

## Live Object Prefixes (Confirmed from sgptQa)

| Object | Record ID prefix | Autonumber format |
|--------|-----------------|-------------------|
| `AI_Agent_Intent__c` | `a0w` | _(Name set by user)_ |
| `AI_Intent_Action__c` | `a0y` | `AIA-0000` |
| `AI_Intent_Action_Detail__c` | `a0x` | `IAD-000000` |
| `AI_Agent__c` | `a0q` | _(Name set by user)_ |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `No such column 'ccai_qa__Action_Type__c'` | Field doesn't exist — use UI instead | This field is not in the object. Set Action Type via GPTfy UI. |
| `No such column 'ccai_qa__Value__c'` | Field doesn't exist on Detail | Value/AI Description must be set via GPTfy UI. |
| `REQUIRED_FIELD_MISSING` on `ccai_qa__AI_Agent__c` | Missing parent Agent ID | Query `AI_Agent__c` first using `SchemaDiscovery_RunFirst.apex` |
| `FIELD_INTEGRITY_EXCEPTION` | Parent record doesn't exist | Import Level 1 before Level 2, Level 2 before Level 3 |
| Namespace mismatch | Wrong prefix | Swap `ccai_qa__` ↔ `ccai__` in field names |
