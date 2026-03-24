# Find Opportunity by Probability Agent — Intent Action Configurations

**Agent:** Opportunity Intelligence Agent
**Capabilities:** Find high-probability opportunities, filter by probability range, calculate total pipeline value, identify deals most likely to close (`find_Opportunity_by_Probability` skill)

These intents enrich the pipeline intelligence experience — handling forecast requests, flagging must-win deals for executive visibility, surfacing pipeline hygiene problems, and providing analysis coaching.

---

## Intent 1: `pipeline_forecast_overview`

| Field | Value |
|-------|-------|
| **Intent Name** | `pipeline_forecast_overview` |
| **Description** | Trigger when the user asks for a pipeline summary, forecast overview, total pipeline value, or wants to understand the health of their pipeline — phrases like "what's my pipeline worth", "forecast summary", "total pipeline value", "how much pipeline do I have", "pipeline overview", "what's in my pipeline", "give me a pipeline report". |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I can analyse your pipeline by probability range and calculate total values. For the most useful breakdown, try asking me something like: "Show me all opportunities above 70% probability" for committed pipeline, or "Find deals between 50% and 80% likely to close this quarter" for upside. I'll return the list with amounts so you can calculate total pipeline value. What probability range would you like to focus on? |

---

## Intent 2: `must_win_deal_flag`

| Field | Value |
|-------|-------|
| **Intent Name** | `must_win_deal_flag` |
| **Description** | Trigger when the user identifies a specific deal as a must-win, high priority, or strategically critical — phrases like "this is a must-win", "high priority deal", "top priority deal", "we must close this one", "critical deal", "key account deal", "this one is very important", "executive deal". |
| **Sequence** | 2 |
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
| Description | AI Extracted | Flag this opportunity as must-win. Prepend "🎯 MUST-WIN: " to the description and include any strategic context the user mentioned — why it's critical, the account significance, or the deal size. |

### Action 2 — Create Record (Task — Executive Review)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Must-Win Deal: Schedule executive review and deal strategy session |
| Description | AI Extracted | Capture the deal name, account, and why this is classified as must-win based on the user's message |
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
| Canned Response Text | Noted — I've flagged this as a must-win deal and created a high-priority executive review task. To maximise the probability score for this deal, make sure the stage, close date, amount, and next steps are all up to date in Salesforce. Would you like me to find this opportunity's current probability and details? |

---

## Intent 3: `pipeline_hygiene_check`

| Field | Value |
|-------|-------|
| **Intent Name** | `pipeline_hygiene_check` |
| **Description** | Trigger when the user mentions stale deals, outdated close dates, overdue opportunities, or asks for a pipeline clean-up — phrases like "stale pipeline", "old deals", "deals not updated", "overdue close dates", "pipeline hygiene", "clean up the pipeline", "deals stuck in old stages", "close dates in the past". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | For pipeline hygiene, I recommend starting by looking at your lowest-probability deals — these are most likely to be stale. Try: "Find opportunities below 30% probability" to identify deals that may need re-qualification or should be moved to Closed Lost. Also review any deals where the close date is in the past by asking: "Show me opportunities below 50% probability" and cross-checking their close dates. |

---

## Intent 4: `probability_explanation`

| Field | Value |
|-------|-------|
| **Intent Name** | `probability_explanation` |
| **Description** | Trigger when the user asks what probability means in Salesforce, how it's calculated, or what thresholds to use — phrases like "what does probability mean", "how is probability calculated", "what's a good probability percentage", "what probability should I filter on", "what threshold should I use". |
| **Sequence** | 9 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | In Salesforce, Opportunity Probability is a percentage (0–100%) linked to the Stage picklist by default — for example, Prospecting = 10%, Proposal/Price Quote = 75%, Closed Won = 100%. It can also be manually overridden by reps. Common forecast categories: 90–100% = Commit (near-certain), 60–80% = Best Case (upside), 30–50% = Pipeline (exploratory), below 30% = Early Stage or at-risk. I can filter by any probability range you choose — just tell me the range. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `pipeline_forecast_overview` | 1 | Canned Response | "pipeline worth", "forecast summary", "total pipeline" |
| `must_win_deal_flag` | 2 | Update Field + Create Task + Canned Response | "must-win", "high priority deal", "critical deal" |
| `pipeline_hygiene_check` | 3 | Canned Response | "stale pipeline", "overdue close dates", "clean up" |
| `probability_explanation` | 9 | Canned Response | "what does probability mean", "how is it calculated" |

---

## Design Notes

- `must_win_deal_flag` is the highest-value intent here. It creates a visible flag on the Opportunity record (description field), a Task for executive follow-up, and gives the rep immediate coaching — all from a single conversational phrase. This creates an auditable must-win list that managers can filter on.
- `pipeline_forecast_overview` intentionally does not try to run a query on its own — it coaches the user to give the agent a useful probability range, which produces much better results from the `find_Opportunity_by_Probability` skill than an open-ended "what's my pipeline" query.
- `pipeline_hygiene_check` gives reps a structured approach to pipeline clean-up without needing to navigate to reports. It bridges conversational context into the probability-filtered queries the skill supports.
- `probability_explanation` prevents the common confusion where reps don't know what filter value to request. Answering this upfront stops the back-and-forth and gets the user to a useful query faster.
