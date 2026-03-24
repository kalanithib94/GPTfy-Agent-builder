# Data Loader Import Guide — Intent Action Framework
## Master CSV Files (All 7 Agents)

---

## Files in this folder

| File | Records | Purpose |
|------|---------|---------|
| `Master_Step1_Intents.csv` | 57 rows | All Intent records — one per intent across all agents |
| `Master_Step2_Intent_Actions.csv` | 99 rows | All Action containers — one per action, linked to parent Intent |
| `Master_Step3_Action_Details.csv` | 118 rows | All field mappings — for Create Record / Update Field actions only |

---

## Column conventions

| Column prefix | Imported? | Purpose |
|---------------|-----------|---------|
| No prefix (e.g. `Name`) | **YES — map this** | Actual Salesforce field — import it |
| `ccai_qa__...` | **YES — map this** | Namespaced Salesforce field — import it |
| `_...` (underscore prefix) | **NO — do not map** | Reference/config notes — human-readable only |
| `Ext_ID` | **NO — do not map** | Human tracking key — cross-references parent rows across steps |
| `Intent_Ext_ID` | **NO — do not map** | Tracks which Step 1 row this Action belongs to |
| `Action_Ext_ID` | **NO — do not map** | Tracks which Step 2 row this Detail belongs to |

> **Namespace rule:** If importing to an org where the managed package is installed (not the dev/QA org), replace all `ccai_qa__` prefixes with `ccai__` in column headers before loading.

---

## Step 1 — Import Intents (`Master_Step1_Intents.csv`)

**Object:** `ccai_qa__AI_Agent_Intent__c`

### Columns to MAP in Data Loader

| CSV Column | Maps To | Notes |
|------------|---------|-------|
| `Name` | `Name` | Intent keyword — e.g. `crm_greeting` or `#Arrest#` |
| `ccai_qa__AI_Agent__r:Name` | Relationship field | Looks up Agent by Name — avoids needing Agent ID |

### Columns to SKIP (do not map)
`Ext_ID`, `_Sequence`, `_Is_Active`, `_Description`

> These fields (Description, Sequence, Is Active) do NOT exist as Salesforce fields on this object in the current package version. Set them manually in the GPTfy UI after import.

### After import
- Export the success file from Data Loader
- Note the new `Id` column — you do NOT need it for Step 2 (we use Intent Name as the lookup)
- Open GPTfy UI → each imported Intent → set: **Description** (copy from `_Description`), **Sequence** (from `_Sequence`), **Is Active = true**

---

## Step 2 — Import Actions (`Master_Step2_Intent_Actions.csv`)

**Object:** `ccai_qa__AI_Intent_Action__c`

### Columns to MAP in Data Loader

| CSV Column | Maps To | Notes |
|------------|---------|-------|
| `ccai_qa__AI_Agent_Intent__r:Name` | Relationship field | Looks up parent Intent by Name — no ID needed |

> **That's the only real field.** Action Name is auto-numbered by Salesforce (`AIA-0000`). All other config (Action Type, Language, Canned Text, Object, Flow, Apex) do not exist as Salesforce fields yet.

### Columns to SKIP (do not map)
All columns starting with `_`, plus `Ext_ID` and `Intent_Ext_ID`

### After import
- **Export the Step 2 success file** — this gives you the auto-generated Action IDs (`AIA-0000` format)
- Match the returned IDs to `Ext_ID` values using the `ccai_qa__AI_Agent_Intent__r:Name` column as the join key
- Paste the real Salesforce IDs into the `ccai_qa__AI_Intent_Action__c` column of Step 3 before loading
- Then open GPTfy UI → each Action → set **Action Type** and all type-specific config using the `_` note columns as your guide

#### How to match Step 2 IDs to Step 3 rows
After Step 2 export, you'll have a success file like:
```
Id,ccai_qa__AI_Agent_Intent__c,...
a0y000000000001,a0w000000000001,...  ← AIA-0001 belongs to crm_greeting's first action
a0y000000000002,a0w000000000001,...  ← AIA-0002 belongs to crm_greeting's second action
```
The order of rows in the export matches the order you imported. Use `Action_Ext_ID` in Step 3 plus the sequential order to match them. A VLOOKUP or Python/Excel script can automate this.

---

## Step 3 — Import Action Details (`Master_Step3_Action_Details.csv`)

**Object:** `ccai_qa__AI_Intent_Action_Detail__c`

### Columns to MAP in Data Loader

| CSV Column | Maps To | Notes |
|------------|---------|-------|
| `ccai_qa__AI_Intent_Action__c` | `ccai_qa__AI_Intent_Action__c` | **Must be filled with real Action ID from Step 2 export** |
| `ccai_qa__Field_API_Name__c` | `ccai_qa__Field_API_Name__c` | The Salesforce field to map (e.g. `Subject`, `Priority`) |
| `ccai_qa__Type__c` | `ccai_qa__Type__c` | `AI Extracted` or `Hardcoded` |

### Columns to SKIP
`Ext_ID`, `Action_Ext_ID`, `_Hardcoded_Value_Or_AI_Instruction`

> `ccai_qa__Value__c` (the hardcoded value or AI instruction) does **not** exist as a Salesforce field on this object in the current package. Set it in the GPTfy UI after import using the `_Hardcoded_Value_Or_AI_Instruction` column as your reference.

### Before importing Step 3
The `ccai_qa__AI_Intent_Action__c` column is **blank** in the CSV. You must fill it before loading:

1. Open Step 2 success export
2. For each `Action_Ext_ID` in Step 3, find the matching Action record by cross-referencing the Intent Name and action sequence
3. Paste the real Salesforce ID (starts with `a0y`) into the `ccai_qa__AI_Intent_Action__c` column
4. Save and load to Data Loader

---

## Full Agent Coverage

| Agent | Intents | Actions | Details |
|-------|---------|---------|---------|
| Salesforce CRM Agent | 4 | 8 | 10 |
| Update Opportunity Stage CloseDate | 6 | 11 | 13 |
| CPQ Agent | 7 | 9 | 8 |
| Document Intelligence Agent | 6 | 8 | 5 |
| Find Opportunity by Probability | 6 | 9 | 9 |
| Update Case Status | 7 | 11 | 13 |
| SP Energy Bot | 21 | 43 | 60 |
| **TOTAL** | **57** | **99** | **118** |

---

## Action Types used across all agents

| Action Type | Count | Intents |
|-------------|-------|---------|
| Canned Response | 72 | Nearly all intents |
| Create Record (Case/Task) | 32 | Crisis and urgent intents |
| Update Field (Account/Opportunity/Case) | 10 | Risk flagging, stalled deals, complaints |
| Flow | 3 | #Emergency#, #Missing Ambulance#, #Mental Health# |
| Apex | 3 | #Assault# (HighRiskNotifier), #Agent# (LiveAgentTransfer), #Presidential# (ExecutiveNotifier) |

---

## UI configuration reference

After Data Loader import, open GPTfy → each Intent → configure in this order:

### For each Intent
1. Set **Description** — copy from `_Description` column in Step 1 CSV
2. Set **Sequence** — copy from `_Sequence`
3. Set **Is Active = true**

### For each Action (using `_Action_Type` column from Step 2 as guide)
| Action Type | Fields to set in UI |
|-------------|---------------------|
| Canned Response | Action Type, Language (from `_Language`), Canned Response Text (from `_Canned_Response_Text`) |
| Create Record | Action Type, Object API Name (from `_Object_API_Name`) |
| Update Field | Action Type, Object API Name (from `_Object_API_Name`) |
| Flow | Action Type, Flow API Name (from `_Flow_API_Name`) |
| Apex | Action Type, Apex Class Name (from `_Apex_Class_Name`), Return Type (from `_Apex_Return_Type`) |

### For each Detail (using `_Hardcoded_Value_Or_AI_Instruction` from Step 3)
- For **Hardcoded** type: paste the exact value from `_Hardcoded_Value_Or_AI_Instruction`
- For **AI Extracted** type: paste the AI instruction text from `_Hardcoded_Value_Or_AI_Instruction`

---

## Namespace quick-reference

| Org type | Object/Field prefix | Interface |
|----------|--------------------|-----------| 
| Dev / QA / Package author org | `ccai_qa__` | `ccai_qa.AIIntentActionInterface` |
| Managed package installed org | `ccai__` | `ccai.AIIntentActionInterface` |

To switch namespace: do a Find & Replace of `ccai_qa__` → `ccai__` in all CSV column headers before loading to a managed package org.

---

## Recommended order of operations

```
1. Run SchemaDiscovery_RunFirst.apex  ← confirm agent Names in org
2. Load Master_Step1_Intents.csv      ← creates 57 Intent records
3. Export Step 1 success file         ← not needed for Step 2 (we use Name lookup)
4. Load Master_Step2_Intent_Actions.csv ← creates 99 Action containers
5. Export Step 2 success file         ← CRITICAL — you need Action IDs for Step 3
6. Fill in ccai_qa__AI_Intent_Action__c in Step 3 CSV using Step 2 IDs
7. Load Master_Step3_Action_Details.csv ← creates 118 Detail rows
8. In GPTfy UI: open each Intent → complete Description, Sequence, Is Active
9. In GPTfy UI: open each Action → set Action Type + all type-specific config
10. In GPTfy UI: open each Detail → set Hardcoded Value or AI Description
```
