# CPQ Agent — Intent Action Configurations

**Agent:** Salesforce CPQ Agent
**Capabilities:** Full SBQQ operations — Pricebook lookup, CPQ Opportunity CRUD, SBQQ Quote CRUD, SBQQ Quote Line CRUD (including bundles) via 12 operations

These intents handle pricing policy guidance, approval workflows, discount requests, and scope boundaries — situations where the conversation needs a response but no CPQ function call is the right answer.

---

## Intent 1: `cpq_greeting`

| Field | Value |
|-------|-------|
| **Intent Name** | `cpq_greeting` |
| **Description** | Trigger when the user sends a first greeting or opening message to start a CPQ session — phrases like "hi", "hello", "start", "I need a quote", "let's create a quote", "help me with CPQ". |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Hello! I'm your CPQ Agent. I can help you create quotes from scratch (I'll automatically find the pricebook and create the opportunity), add products to existing quotes, manage quote lines including bundle items, and update or delete quotes and opportunities. What would you like to work on today? |

---

## Intent 2: `discount_requested`

| Field | Value |
|-------|-------|
| **Intent Name** | `discount_requested` |
| **Description** | Trigger when the user asks about discounts, price reductions, special pricing, or a customer requesting a lower price — phrases like "can we discount this", "customer wants a lower price", "apply a discount", "reduce the price", "give them a better deal", "they're asking for a discount", "negotiate pricing". |
| **Sequence** | 2 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Discounts are applied at the Quote Line level by updating the List Price on each line item. I can update any quote line's price for you — just share the Quote name (or ID) and which product(s) to discount. Note: discounts beyond your org's approval threshold will require manager sign-off before the quote can be presented to the customer. |

### Action 2 — Create Record (Task — Discount Review Flag)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | Hardcoded | Discount Review: Verify pricing approval threshold before presenting to customer |
| Description | AI Extracted | Note the discount being requested — product name, quote name, and what the customer asked for as mentioned in the conversation |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | Normal |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 3: `quote_approval_needed`

| Field | Value |
|-------|-------|
| **Intent Name** | `quote_approval_needed` |
| **Description** | Trigger when the user says a quote needs approval, is ready for review, needs manager sign-off, or should be submitted — phrases like "submit for approval", "needs approval", "ready for manager review", "send to manager", "quote needs sign-off", "approve this quote". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | To submit a quote for approval, navigate to the Quote record in Salesforce and click the "Submit for Approval" button. The quote will remain in its current status until the approval is granted. Before submitting, would you like me to double-check any quote details — status, expiration date, or product lines? |

### Action 2 — Create Record (Task — Approval Tracking)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 2 |
| **Object** | Task (Task) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Subject | AI Extracted | Create a task subject referencing the quote name and that it is pending approval |
| Description | AI Extracted | Note which quote is pending approval and who it should be reviewed by, if mentioned in the conversation |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | High |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 4: `quote_expired_or_expiring`

| Field | Value |
|-------|-------|
| **Intent Name** | `quote_expired_or_expiring` |
| **Description** | Trigger when the user says a quote has expired, is about to expire, or mentions the customer needs more time — phrases like "quote expired", "quote is expiring soon", "customer needs an extension", "quote deadline passed", "need to extend the quote". |
| **Sequence** | 4 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I can update the quote's expiration date right away. Share the Quote name (or ID) and the new expiration date and I'll extend it. If the quote has already expired and pricing has changed, you may also want to update the product line prices before re-presenting it to the customer. |

---

## Intent 5: `cpq_out_of_scope`

| Field | Value |
|-------|-------|
| **Intent Name** | `cpq_out_of_scope` |
| **Description** | Trigger when the user asks for something outside CPQ scope — managing inventory, processing orders, handling billing or invoices, creating standard (non-CPQ) opportunities without SBQQ, or other non-CPQ Salesforce tasks. |
| **Sequence** | 10 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | That's outside my CPQ scope. I specialise in SBQQ Quotes, Quote Lines (including bundles), CPQ Opportunities, and Pricebook lookups. For order management, billing, invoicing, or inventory, please use the appropriate Salesforce module or contact your admin. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `cpq_greeting` | 1 | Canned Response | "hi", "hello", "I need a quote" |
| `discount_requested` | 2 | Canned Response + Create Task | "discount", "lower price", "negotiate" |
| `quote_approval_needed` | 3 | Canned Response + Create Task | "submit for approval", "needs sign-off" |
| `quote_expired_or_expiring` | 4 | Canned Response | "quote expired", "need extension" |
| `cpq_out_of_scope` | 10 | Canned Response | Order/billing/inventory requests |

---

## Design Notes

- `discount_requested` intentionally does NOT update any record automatically — discounts require human judgment on approval thresholds. The intent creates a Task as an audit trail and gives the rep clear instructions on how to proceed via the Canned Response.
- `quote_approval_needed` creates a tracking Task so the pending approval isn't lost if the rep closes the chat. The Canned Response redirects to the Salesforce UI button because the CPQ approval submission process is not exposed through the GPTfy skill layer.
- `quote_expired_or_expiring` bridges into the existing `update_SBQQ_Quote` skill — the Canned Response asks for the Quote ID and new expiry date so the rep is primed to give the agent the exact inputs it needs for the function call.
- `cpq_out_of_scope` at Sequence 10 catches any request that none of the 12 CPQ skills can handle, preventing the AI from hallucinating unsupported actions.
