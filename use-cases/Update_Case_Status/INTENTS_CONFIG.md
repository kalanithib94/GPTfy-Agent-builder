# Update Case Status Agent — Intent Action Configurations

**Agent:** Case Management Agent
**Capabilities:** Update case status (New, Working, In Progress, Escalated, On Hold, Closed, Closed-Resolved, Closed-Not Resolved) with resolution notes via `update_Case_Status` skill

These intents handle the human dimension of case management — urgency signals, upset customers, positive resolution moments, and common "no Case ID" situations — so the agent responds with empathy and action rather than just asking for an ID.

---

## Intent 1: `case_urgent_critical`

| Field | Value |
|-------|-------|
| **Intent Name** | `case_urgent_critical` |
| **Description** | Trigger when the user says a case is urgent, critical, must be escalated, or is a P1/Sev1 — phrases like "this is urgent", "critical issue", "escalate this now", "needs immediate attention", "P1", "Sev 1", "emergency", "customer is about to go live", "blocking production". |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I understand — this is urgent. To escalate the case immediately, please provide the Case ID (15 or 18-character ID starting with "500") and I'll update the status to "Escalated" right now. If the case is also blocking production or involves a go-live, let me know and I'll add that context to the resolution notes as well. |

### Action 2 — Create Record (Task — Urgent Escalation)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | URGENT ESCALATION: Immediate management attention required |
| Description | AI Extracted | Summarise the urgency — what is critical, what is blocking, what the user described as the emergency situation |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 2: `customer_at_risk_of_churning`

| Field | Value |
|-------|-------|
| **Intent Name** | `customer_at_risk_of_churning` |
| **Description** | Trigger when the user describes a customer who is extremely unhappy, threatening to leave, or at serious risk of churning — phrases like "customer is threatening to cancel", "they want to leave", "customer is furious", "about to lose this customer", "customer is very angry", "churn risk", "customer wants a refund and to cancel". |
| **Sequence** | 2 |
| **Is Active** | true |

### Action 1 — Create Record (Task — Retention Action)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 1 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | AT-RISK CUSTOMER: Schedule executive callback within 24 hours |
| Description | AI Extracted | Capture the customer's situation — why they are unhappy, what they threatened, and any context the user provided about the account or case |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |
| ActivityDate | Hardcoded | TODAY |

### Action 2 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I understand — this is a high-risk situation. I've created an urgent executive callback task. To take immediate action, provide the Case ID and I'll update the status to "Escalated" right away. It's also worth adding resolution notes documenting the customer's concerns so the escalation team has full context when they call. |

---

## Intent 3: `case_resolved_ready_to_close`

| Field | Value |
|-------|-------|
| **Intent Name** | `case_resolved_ready_to_close` |
| **Description** | Trigger when the user confirms a case has been resolved, the customer confirmed the fix, or the issue is gone — phrases like "customer confirmed it's fixed", "issue is resolved", "problem is gone", "they said it's working now", "customer is happy", "we fixed it", "issue has been resolved". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Great news — glad that's resolved! To officially close the case, provide the Case ID (starting with "500") and I'll update it to "Closed - Resolved". Would you like to add resolution notes documenting how the issue was fixed? This helps future agents handle similar issues faster. |

---

## Intent 4: `case_on_hold_waiting`

| Field | Value |
|-------|-------|
| **Intent Name** | `case_on_hold_waiting` |
| **Description** | Trigger when the user says a case is waiting for the customer, pending third-party input, or needs to be put on hold — phrases like "waiting for customer response", "put this on hold", "pending vendor reply", "waiting for information from customer", "on hold until they respond", "parked for now". |
| **Sequence** | 4 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Got it. To put the case on hold, share the Case ID and I'll update the status to "On Hold". Consider adding a note in the resolution field explaining what you're waiting for — this keeps the case history clear if a different agent picks it up later. |

---

## Intent 5: `no_case_id_provided`

| Field | Value |
|-------|-------|
| **Intent Name** | `no_case_id_provided` |
| **Description** | Trigger when the user wants to update, close, escalate, or change a case status but has NOT mentioned a Case ID and their message is generic — phrases like "update the case", "close the case", "escalate my case", "change the status", "mark it as resolved" without any specific ID. |
| **Sequence** | 5 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | To update a case, I'll need the Case ID — a 15 or 18-character ID beginning with "500". You can find it in: (1) the URL when viewing the case record in Salesforce, (2) any case notification email, or (3) by searching for the case in the Cases tab. Once you have it, share it along with the status you'd like and I'll update it immediately. |

---

## Intent 6: `case_status_options`

| Field | Value |
|-------|-------|
| **Intent Name** | `case_status_options` |
| **Description** | Trigger when the user asks what case statuses are available, what each status means, or which status to use — phrases like "what statuses can I set", "what are the case statuses", "list the case statuses", "what's the difference between closed and closed resolved", "what status options are there". |
| **Sequence** | 9 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Here are the available case statuses I can set: New (just opened), Working (agent reviewing), In Progress (actively being worked), Escalated (raised to higher tier), On Hold (waiting for customer/third party), Closed (generic closure), Closed - Resolved (issue confirmed fixed), Closed - Not Resolved (closed without a fix). Just tell me the Case ID and the status and I'll update it. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `case_urgent_critical` | 1 | Canned Response + Create Task | "urgent", "P1", "escalate now", "critical" |
| `customer_at_risk_of_churning` | 2 | Create Task + Canned Response | "threatening to cancel", "furious", "churn risk" |
| `case_resolved_ready_to_close` | 3 | Canned Response | "customer confirmed fixed", "issue resolved" |
| `case_on_hold_waiting` | 4 | Canned Response | "waiting for customer", "on hold", "pending vendor" |
| `no_case_id_provided` | 5 | Canned Response | Generic case update request with no Case ID |
| `case_status_options` | 9 | Canned Response | "what statuses", "list the statuses" |

---

## Design Notes

- `case_urgent_critical` fires before the user provides a Case ID — it acknowledges the urgency immediately and creates an escalation Task so a manager can see the situation even if the rep never follows through with the ID. The Canned Response then smoothly redirects to collecting the ID.
- `customer_at_risk_of_churning` creates an executive callback Task automatically. This is the most time-sensitive intent — if a customer is threatening to leave, the Task ensures management visibility even if the conversation ends abruptly.
- `case_resolved_ready_to_close` mirrors the System Prompt's own instruction ("Always ask: Would you like to add resolution notes?") — the intent fires on the emotional signal before the Case ID is provided, making the closing workflow feel natural.
- `no_case_id_provided` at Sequence 5 catches the very common pattern of reps saying "close the case" without an ID. Rather than the AI asking a confusing question, the intent immediately explains exactly where to find the ID and what format it needs.
- `case_status_options` complements the System Prompt's status list. When a rep is unsure which status to use, this intent returns the full option set with brief descriptions, reducing back-and-forth before the actual `update_Case_Status` skill call.
