# Insurance Plan Discovery Agent — Intents Configuration

**Agent:** Insurance Plan Discovery Agent
**Total Intents:** 8
**CSV Prefix:** IPD
**Audience:** Pre-sales / prospective customers
**Context:** Consumer-facing chat (snake_case intent names)

---

## Intent Design Summary

| Ext_ID | Name | Seq | Action Types | Notes |
|--------|------|-----|-------------|-------|
| IPD-INT-001 | `ipd_greeting` | 1 | Canned Response (EN), Canned Response (ES) | Welcome + capabilities |
| IPD-INT-002 | `pre_existing_condition_inquiry` | 2 | Create Record (Lead), Canned Response | Identifies a warm lead with medical profile data |
| IPD-INT-003 | `family_coverage_inquiry` | 3 | Canned Response | Targets family plan queries |
| IPD-INT-004 | `budget_concern` | 4 | Canned Response | User signals affordability concern |
| IPD-INT-005 | `purchase_intent_signal` | 5 | Create Record (Lead), Canned Response | User is ready to buy — high-value lead capture |
| IPD-INT-006 | `plan_not_found_frustration` | 6 | Create Record (Lead), Canned Response | Tracks unmet needs for product team + reassures user |
| IPD-INT-007 | `competitor_mention` | 7 | Update Field (Lead.Description), Canned Response | Captures competitive intelligence |
| IPD-INT-008 | `ipd_out_of_scope` | 8 | Canned Response | Claims, renewals, policy changes → redirect |

---

## Intent Definitions

---

### IPD-INT-001 — `ipd_greeting`

**Trigger description (set in GPTfy UI → Intent → Description):**
> Trigger when a user sends a greeting or opens the chat with no specific question — hi hello hey good morning good afternoon how are you or starts without a clear insurance query.

**Sequence:** 1
**Is Active:** true

#### Actions

**Action 1 — Canned Response (Seq 1)**
- Language: English
- Text: "Hello! Welcome to Insurance Plan Discovery. I'm here to help you find the right health insurance plan. I can: show you all available plans, compare plans side by side, and recommend the best plan based on your age, family size, budget, and health history. What would you like to explore today?"

**Action 2 — Canned Response (Seq 2)**
- Language: Spanish
- Text: "¡Hola! Bienvenido al asistente de Descubrimiento de Seguros de Salud. Puedo ayudarte a explorar nuestros planes, compararlos y recomendarte el más adecuado según tu perfil. ¿Por dónde quieres empezar?"

---

### IPD-INT-002 — `pre_existing_condition_inquiry`

**Trigger description:**
> Trigger when the user mentions a pre-existing medical condition or asks if their existing health condition is covered — diabetes hypertension heart disease cancer thyroid blood pressure prior diagnosis chronic illness pre-existing condition covered.

**Sequence:** 2
**Is Active:** true

#### Actions

**Action 1 — Create Record: Lead (Seq 1)**
- Object: Lead
- Field mappings:

| Field | Type | Value / AI Instruction |
|-------|------|----------------------|
| LastName | AI Extracted | Extract the user's name from the conversation if mentioned; default to 'Chat Prospect' if not provided |
| Company | Hardcoded | Self - Individual |
| LeadSource | Hardcoded | Chat |
| Status | Hardcoded | New |
| Description | AI Extracted | Summarise the pre-existing condition mentioned by the user and the type of plan they are asking about |

**Action 2 — Canned Response (Seq 2)**
- Language: English
- Text: "Yes, we do have plans that cover pre-existing conditions. These plans typically include a waiting period of 2–4 years before the pre-existing condition is fully covered. I've noted your query and one of our health advisors will be in touch to walk you through the best options. In the meantime, shall I show you all plans that include pre-existing disease coverage?"

---

### IPD-INT-003 — `family_coverage_inquiry`

**Trigger description:**
> Trigger when the user asks specifically about family plans, floater plans, or coverage for multiple family members — family plan family of four family floater cover my family spouse and kids wife and children my husband my dependants cover everyone.

**Sequence:** 3
**Is Active:** true

#### Actions

**Action 1 — Canned Response (Seq 1)**
- Language: English
- Text: "Great — family health plans are one of our most popular options! A family floater plan covers all members under a single sum insured, which is usually more cost-effective than individual plans for each person. To show you the most relevant options, could you tell me: (1) How many people will be covered? (2) What is the age of the eldest member? (3) Do you have a monthly budget in mind? With that, I can give you personalised recommendations right away."

---

### IPD-INT-004 — `budget_concern`

**Trigger description:**
> Trigger when the user expresses concern about price or affordability — too expensive can't afford this is over my budget cheaper plan low cost affordable plan looking for something budget-friendly price is high reduce the cost lower premium.

**Sequence:** 4
**Is Active:** true

#### Actions

**Action 1 — Canned Response (Seq 1)**
- Language: English
- Text: "I completely understand — finding good coverage at the right price is important. Let me help you find a plan that fits your budget. Could you tell me your maximum monthly premium (e.g. £200/month)? I'll search for all active plans within that range. Also, would you like to keep pre-existing condition coverage, or are you open to plans without it to keep costs lower?"

---

### IPD-INT-005 — `purchase_intent_signal`

**Trigger description:**
> Trigger when the user signals they are ready to buy, proceed, or get a quote — I want to buy I'd like to purchase I'm ready to sign up get me a quote take it proceed with this plan how do I apply start the application I want this one.

**Sequence:** 5
**Is Active:** true

#### Actions

**Action 1 — Create Record: Lead (Seq 1)**
- Object: Lead
- Field mappings:

| Field | Type | Value / AI Instruction |
|-------|------|----------------------|
| LastName | AI Extracted | Extract the user's name from the conversation if provided; otherwise use 'Chat Prospect' |
| Company | Hardcoded | Self - Individual |
| LeadSource | Hardcoded | Chat |
| Status | Hardcoded | Hot |
| Description | AI Extracted | Summarise which plan the user expressed interest in, their budget, family size, and any conditions mentioned during the conversation |

**Action 2 — Canned Response (Seq 2)**
- Language: English
- Text: "Excellent choice! To get you a formal quote and start the application, I'll need to connect you with one of our insurance advisors who will guide you through the next steps — including any health declaration forms and underwriting checks. I've captured your interest and a specialist will be in touch within 1 business day. If you'd like to proceed faster, you can also apply directly at [Website URL]. Is there anything else I can help you with while you wait?"

---

### IPD-INT-006 — `plan_not_found_frustration`

**Trigger description:**
> Trigger when user is frustrated that no plan meets their needs or the search returned no results — nothing matches can't find a suitable plan no results doesn't cover what I need none of these work no plan fits my budget there's nothing for me.

**Sequence:** 6
**Is Active:** true

#### Actions

**Action 1 — Create Record: Lead (Seq 1)**
- Object: Lead
- Field mappings:

| Field | Type | Value / AI Instruction |
|-------|------|----------------------|
| LastName | AI Extracted | Extract user's name if mentioned; default to 'Unmet Need Prospect' |
| Company | Hardcoded | Self - Individual |
| LeadSource | Hardcoded | Chat |
| Status | Hardcoded | New |
| Description | AI Extracted | Summarise what the user was looking for that could not be matched — conditions, budget, coverage amount, plan type — so the product team can identify gaps |

**Action 2 — Canned Response (Seq 2)**
- Language: English
- Text: "I'm sorry we don't have a perfect match right now. I've flagged your requirements with our team so we can look at expanding our options. In the meantime, here's what I'd suggest: (1) One of our advisors can put together a bespoke recommendation — shall I arrange a call-back? (2) You could also adjust one filter at a time (e.g. slightly higher budget or a shorter waiting period) and I can search again. Which would you prefer?"

---

### IPD-INT-007 — `competitor_mention`

**Trigger description:**
> Trigger when the user mentions a competitor insurance company or a competitor's plan by name, or compares your plans unfavourably to a competitor — [Competitor Name] is cheaper I saw a better plan elsewhere another insurer your competitor has this feature why are you more expensive than.

**Sequence:** 7
**Is Active:** true

#### Actions

**Action 1 — Update Field: Lead.Description (Seq 1)**
- Object: Lead
- Field: Description
- Type: AI Extracted
- Instruction: If a Lead exists in context, append 'COMPETITIVE INTEL: ' followed by the competitor name or plan mentioned and what the user said about it. This helps the sales team understand competitive positioning.

**Action 2 — Canned Response (Seq 2)**
- Language: English
- Text: "It's always good to compare your options — that's exactly the right approach when making a healthcare decision! While I can't comment on other providers directly, I can tell you exactly what makes our plans stand out: [highlight 2-3 key differentiators such as cashless hospital network, no claim bonus, or specific coverage benefits]. Would you like me to show you a plan that matches what you're looking for in terms of coverage and value?"

---

### IPD-INT-008 — `ipd_out_of_scope`

**Trigger description:**
> Trigger when user asks about something outside the scope of pre-sales plan discovery — existing policy renewal renewal date claim filing how to make a claim billing payment policy cancellation change of address update personal details existing customer log in account access premium payment.

**Sequence:** 8
**Is Active:** true

#### Actions

**Action 1 — Canned Response (Seq 1)**
- Language: English
- Text: "That's something I'm not able to help with in this chat — I'm specialised in helping you explore and choose new health insurance plans. For queries about an existing policy, renewals, claims, or account changes, please contact our customer support team: Phone: [Support Number] | Email: [Support Email] | Portal: [Customer Portal URL]. Is there anything I can help you with regarding our plans today?"

---

## Apex Classes Required

None for this use case — all backend operations are handled by the Apex handler class via skills (find_Insurance_Plan, compare_Insurance_Plans, recommend_Insurance_Plan). The intent actions use Canned Response and Create Record only.

## Flows Required

None for this use case. Lead creation is handled directly via the Create Record intent action type.

---

## Notes for Salesforce Setup

### Insurance_Plan__c Object
Ensure the following fields exist on `Insurance_Plan__c` before deploying:

| Field Label | API Name | Type |
|-------------|----------|------|
| Plan Type | Plan_Type__c | Picklist: Individual, Family, Senior, Group Corporate |
| Monthly Premium | Monthly_Premium__c | Currency |
| Annual Deductible | Annual_Deductible__c | Currency |
| Max Coverage | Max_Coverage__c | Currency |
| Pre-Existing Covered | Pre_Existing_Covered__c | Checkbox |
| Pre-Existing Waiting Period (Years) | Pre_Existing_Waiting_Period_Years__c | Number |
| Network Type | Network_Type__c | Picklist: HMO, PPO, TPA |
| Short Description | Short_Description__c | Text (255) |
| Key Benefits | Key_Benefits__c | Long Text Area |
| Min Age | Min_Age__c | Number |
| Max Age | Max_Age__c | Number |
| Min Family Size | Min_Family_Size__c | Number |
| Max Family Size | Max_Family_Size__c | Number |
| Is Active | Is_Active__c | Checkbox |

### Lead Fields Used
Standard Lead object fields only — no custom fields required:
`LastName`, `Company`, `LeadSource`, `Status`, `Description`
