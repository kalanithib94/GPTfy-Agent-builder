# Salesforce CRM Agent — Intent Action Configurations

**Agent:** Salesforce CRM Assistant
**Capabilities:** Account search, Cases, Contacts, Opportunities, Quotes, Products (14 operations) + GPTfy Knowledge Base

These intents handle conversational patterns that the agent's Apex skills cannot — greetings, emotional signals, account health flags, and out-of-scope redirects — running silently alongside the existing function-call skill set.

---

## Intent 1: `crm_greeting`

| Field | Value |
|-------|-------|
| **Intent Name** | `crm_greeting` |
| **Description** | Trigger when the user sends a first greeting or opening message — phrases like "hi", "hello", "hey", "good morning", "good afternoon", or starts a conversation with no clear action request. |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Hello! I'm your Salesforce CRM Assistant. I can help you with: searching accounts and contacts, creating and updating cases, managing opportunities and quotes, and adding products to deals. What would you like to do today? |

### Action 2 — Canned Response (Spanish)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | Spanish |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | ¡Hola! Soy tu Asistente CRM de Salesforce. Puedo ayudarte a buscar cuentas, gestionar casos y oportunidades, crear contactos y manejar cotizaciones. ¿En qué puedo ayudarte hoy? |

---

## Intent 2: `account_at_risk`

| Field | Value |
|-------|-------|
| **Intent Name** | `account_at_risk` |
| **Description** | Trigger when the user mentions an account is at risk, unhappy, likely to churn, or in danger of cancelling — phrases like "at risk", "might churn", "losing this account", "they're unhappy", "customer might leave", "risk of losing them", "account is in trouble". |
| **Sequence** | 2 |
| **Is Active** | true |

### Action 1 — Update Field (Account Description)

| Field | Value |
|-------|-------|
| Action Type | Update Field |
| Is Active | true |
| Sequence | 1 |
| **Object** | Account (Account) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Description | AI Extracted | Flag this account as at-risk. Use the reason the user mentioned (e.g., churn risk, unhappy with service, considering competitors) and prepend "⚠ AT-RISK: " to the description. |

### Action 2 — Create Record (Task)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | AT-RISK Account: Schedule retention call immediately |
| Description | AI Extracted | Summarize the at-risk situation from the conversation — why is the account at risk and what the user said |
| ActivityDate | Hardcoded | TODAY |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |

### Action 3 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | I've flagged this account as at-risk in the description and created a high-priority follow-up task. I recommend scheduling a retention call and reviewing any open cases for this account. Would you like me to pull up their current cases or opportunities? |

---

## Intent 3: `user_frustrated_urgent`

| Field | Value |
|-------|-------|
| **Intent Name** | `user_frustrated_urgent` |
| **Description** | Trigger when the user expresses frustration, urgency, or distress about a customer issue — phrases like "this is urgent", "customer is furious", "nothing is working", "I need help immediately", "this is a critical issue", "customer is very angry", "major problem". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Create Record (Case)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 1 |
| **Object** | Case (Case) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | AI Extracted | Analyze the conversation and create a concise, accurate case subject describing the issue the user raised |
| AccountId | AI Extracted | Identify the account from the conversation context or the current page record and link the case to it |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |
| Description | AI Extracted | Summarize the issue as described by the user in the conversation |

### Action 2 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I understand this is urgent. I've automatically created a High-priority support case based on your message. A team member will follow up shortly. To proceed, can you share the Account name or Case ID so I can also pull up the relevant records for you? |

---

## Intent 4: `crm_out_of_scope`

| Field | Value |
|-------|-------|
| **Intent Name** | `crm_out_of_scope` |
| **Description** | Trigger when the user asks for something this agent cannot do — deleting records, running reports, modifying dashboards, changing Salesforce settings, bulk data imports/exports, or asks about topics completely unrelated to CRM data or GPTfy. |
| **Sequence** | 10 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | That's outside my current capabilities. I specialise in searching accounts, contacts, and cases; creating and updating cases, contacts, opportunities, and quotes; and answering GPTfy configuration questions. For reports, dashboards, bulk data, or Salesforce setup changes, please use Salesforce directly or contact your admin. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `crm_greeting` | 1 | Canned Response (EN + ES) | "hi", "hello", opening message |
| `account_at_risk` | 2 | Update Field + Create Task + Canned Response | "at risk", "might churn", "losing account" |
| `user_frustrated_urgent` | 3 | Create Case + Canned Response | "urgent", "furious", "critical issue" |
| `crm_out_of_scope` | 10 | Canned Response | Delete/report/dashboard requests |

---

## Design Notes

- `crm_greeting` sits at Sequence 1 so it fires first on any opening message. The dual-language setup means Spanish-speaking users get a native response without any extra configuration.
- `account_at_risk` combines three actions: it permanently marks the Account record, creates an auditable Task, and gives the user a helpful next-step response — all triggered by a single conversational phrase.
- `user_frustrated_urgent` auto-creates a High-priority Case linked to the context account, reducing friction when a rep is in a stressful moment and just needs the system to act.
- `crm_out_of_scope` acts as a safety net at Sequence 10, catching anything the skills don't cover and guiding the user instead of leaving them with a confusing non-answer.
