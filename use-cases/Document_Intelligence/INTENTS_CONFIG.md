# Document Intelligence Agent — Intent Action Configurations

**Agent:** Document Intelligence Agent
**Capabilities:** Read-only — find Salesforce Files by name (`find_Document_by_Name`), optionally filtered by linked record ID. No create, update, or delete.

Because this agent is strictly read-only, most intents handle the gap between what users expect (upload, share, edit) and what the agent actually does (search and locate). Intents provide immediate, accurate redirection rather than a confusing non-answer.

---

## Intent 1: `doc_greeting`

| Field | Value |
|-------|-------|
| **Intent Name** | `doc_greeting` |
| **Description** | Trigger when the user sends a greeting or opening message — "hi", "hello", "I need a document", "help me find a file", "can you find", or starts with no specific document request yet. |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Hello! I'm your Document Intelligence Agent. I can search for Salesforce Files by name across your org. For more precise results, I can also filter by a specific record — just tell me the document name, and optionally the Account, Opportunity, or Case it's linked to. What are you looking for? |

---

## Intent 2: `document_not_found`

| Field | Value |
|-------|-------|
| **Intent Name** | `document_not_found` |
| **Description** | Trigger when the user says a document cannot be found, is missing, was deleted, or they've already searched and found nothing — phrases like "document is missing", "I can't find it", "it should be there", "the file is gone", "already searched and nothing came up", "it's not showing up", "document doesn't exist". |
| **Sequence** | 2 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | If the document isn't appearing in search results, it may not have been uploaded to Salesforce, may be linked to a different record than expected, or may have been deleted. Try searching with a partial filename or a different record context. If you believe the file existed and was removed, contact your Salesforce admin to check the recycle bin or audit logs. |

### Action 2 — Create Record (Case — Missing Document Report)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Case (Case) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Missing Document Report — requires admin investigation |
| Description | AI Extracted | Capture the name of the missing document, the record it should be linked to, and any context about when it was last seen or who uploaded it |
| Priority | Hardcoded | Normal |
| Status | Hardcoded | New |

---

## Intent 3: `upload_or_edit_request`

| Field | Value |
|-------|-------|
| **Intent Name** | `upload_or_edit_request` |
| **Description** | Trigger when the user asks to upload, attach, create, edit, update, delete, or share a document or file — phrases like "upload a file", "attach a document", "add a file", "can you upload this", "edit the document", "delete this file", "share this document". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I'm a read-only Document Intelligence Agent — I can search and locate files but cannot upload, edit, delete, or share documents. To upload a file, navigate to the relevant Salesforce record, scroll to the Files section, and click "Upload Files" (or drag and drop). For sharing and permissions, use the file's sharing settings in Salesforce. |

---

## Intent 4: `search_tips`

| Field | Value |
|-------|-------|
| **Intent Name** | `search_tips` |
| **Description** | Trigger when the user asks how to search more effectively, gets too many results, or asks about search options — phrases like "how do I search", "too many results", "can I filter by record", "how does the search work", "search isn't working". |
| **Sequence** | 4 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Here are some tips for better document searches: (1) Use a partial filename — I'll match any file containing those words. (2) Narrow results by record — tell me the Account, Opportunity, or Case name and I'll only show files linked to that record. (3) Limit results — you can ask for "the top 5 files" or "the most recent 3 documents". Example: "Find the contract linked to GasLume Energy, limit 3." |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `doc_greeting` | 1 | Canned Response | "hi", "hello", "help me find a file" |
| `document_not_found` | 2 | Canned Response + Create Case | "missing", "can't find", "not showing up" |
| `upload_or_edit_request` | 3 | Canned Response | "upload", "attach", "edit", "delete file" |
| `search_tips` | 4 | Canned Response | "how to search", "too many results", "filter by record" |

---

## Design Notes

- This agent has only one skill (`find_Document_by_Name`), so intents carry significant responsibility for UX quality. Without them, users attempting uploads or edits would get a confusing non-response from the AI.
- `document_not_found` creates a Case as an audit trail when a file genuinely can't be located — admin teams can investigate deletion, permission issues, or upload failures without needing the user to manually create a ticket.
- `upload_or_edit_request` is the most important intent for this agent. It prevents user frustration by immediately explaining the read-only limitation and giving them the exact steps to do what they need in Salesforce directly.
- `search_tips` improves search precision by coaching the user on partial name matching and record-scoped filtering — reducing the chance of "too many results" or "wrong document" situations.
