# Update Opportunity Stage & Close Date Agent — Intent Action Configurations

**Agent:** Opportunity Pipeline Manager
**Capabilities:** Update opportunity stage and close date via `update_Opportunity_Stage_CloseDate` Apex skill

These intents handle the emotional and contextual signals around deal movement — wins, losses, stalls, and clarification questions — complementing the stage-update skill with automated follow-up tasks and coaching responses.

---

## Intent 1: `deal_closed_won`

| Field | Value |
|-------|-------|
| **Intent Name** | `deal_closed_won` |
| **Description** | Trigger when the user indicates a deal has been won, signed, or confirmed — phrases like "we won", "deal is closed", "customer signed", "they accepted the proposal", "just won the deal", "they're going with us", "contract signed", "deal done". |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Congratulations on closing the deal! 🎉 Go ahead and tell me the Opportunity name (or ID) and I'll update the stage to Closed Won right away. If the official close date has changed, share that too and I'll keep your forecast accurate. |

### Action 2 — Create Record (Task — Post-Win Follow-up)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Post-Win: Schedule customer onboarding kickoff |
| Description | AI Extracted | Capture the deal name and any win context the user mentioned (account name, product, deal size) |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 2: `deal_closed_lost`

| Field | Value |
|-------|-------|
| **Intent Name** | `deal_closed_lost` |
| **Description** | Trigger when the user indicates a deal has been lost or will not close — phrases like "we lost", "deal fell through", "customer declined", "they went with a competitor", "lost the deal", "not going forward", "they said no", "customer chose someone else". |
| **Sequence** | 2 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I'm sorry to hear that. Please share the Opportunity name (or ID) and I'll update the stage to Closed Lost. Would you like to add any notes on why the deal was lost? Documenting this helps with future forecasting and win/loss analysis. |

### Action 2 — Create Record (Task — Loss Analysis)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Post-Loss Analysis: Document reasons and key learnings |
| Description | AI Extracted | Summarise the reason for losing the deal as described by the user — competitor, pricing, timing, product gap, etc. |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | Normal |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 3: `deal_stalled`

| Field | Value |
|-------|-------|
| **Intent Name** | `deal_stalled` |
| **Description** | Trigger when the user says a deal is stuck, not progressing, delayed, or needs attention — phrases like "deal is stuck", "no response from customer", "stalled", "going nowhere", "deal has been sitting in this stage", "customer is not responding", "pipeline not moving", "been delayed". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Update Field (Opportunity Description)

| Field | Value |
|-------|-------|
| Action Type | Update Field |
| Is Active | true |
| Sequence | 1 |
| **Object** | Opportunity (Opportunity) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Description | AI Extracted | Note that this deal is currently stalled. Prepend "⚠ STALLED: " and capture any reason the user mentioned — e.g., no customer response, pending decision, competitor evaluation. |

### Action 2 — Create Record (Task — Follow-up Nudge)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Stalled Deal: Send re-engagement message to prospect |
| Description | AI Extracted | Describe the stall context — how long stuck, last known customer response, what the blocker is |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |
| ActivityDate | Hardcoded | TODAY |

### Action 3 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | Got it — I've flagged this deal as stalled and created a re-engagement task. To keep your forecast accurate, consider whether you need to push the close date out or move the stage back. Share the Opportunity name (or ID) and I can update either right away. |

---

## Intent 4: `stages_clarification`

| Field | Value |
|-------|-------|
| **Intent Name** | `stages_clarification` |
| **Description** | Trigger when the user asks what pipeline stages are available, what each stage means, or wants a list of valid stages — phrases like "what stages can I use", "what are the pipeline stages", "list the stages", "what stage should I pick", "what does Qualification mean". |
| **Sequence** | 9 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Here are the standard Salesforce opportunity stages in order: Prospecting → Qualification → Needs Analysis → Value Proposition → Id. Decision Makers → Perception Analysis → Proposal/Price Quote → Negotiation/Review → Closed Won / Closed Lost. Just tell me the deal name and the stage you want to move it to, and I'll handle the update. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `deal_closed_won` | 1 | Canned Response + Create Task | "we won", "customer signed", "deal done" |
| `deal_closed_lost` | 2 | Canned Response + Create Task | "we lost", "they declined", "going with competitor" |
| `deal_stalled` | 3 | Update Field + Create Task + Canned Response | "stuck", "stalled", "no response", "not moving" |
| `stages_clarification` | 9 | Canned Response | "what stages", "list stages", "what does X mean" |

---

## Design Notes

- `deal_closed_won` and `deal_closed_lost` fire before the user provides the Opportunity ID — they set the emotional tone immediately and create the follow-up Task automatically, so even if the rep forgets to log the outcome details, there's an auditable Task on record.
- `deal_stalled` writes directly to the Opportunity Description field, creating a visible flag that managers and other reps can see in list views and reports — no separate record navigation needed.
- `stages_clarification` prevents the common confusion where a rep asks the agent to set a stage name that doesn't match the picklist exactly. By returning the full ordered list upfront, the rep can copy the exact stage name before asking the agent to move the deal.
- None of these intents duplicate the `update_Opportunity_Stage_CloseDate` skill — they are complementary: the intents handle context and follow-up, the skill handles the actual DML.
