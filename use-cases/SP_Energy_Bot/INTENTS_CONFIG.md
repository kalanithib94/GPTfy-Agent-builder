# SP Energy Bot — Intent Action Configurations

**Agent:** SP Energy Bot
**Salesforce Agent Name (update to match your org):** `SP Energy Bot`
**Use Case:** Crisis, emergency, and customer support chatbot for SP Energy customers
**Intent Naming Convention:** Hashtag-based keywords — the AI returns these exact tokens in `"intents": []`

---

## Action Types Used — Coverage Map

| Action Type | Intents that use it |
|-------------|---------------------|
| **Canned Response** | All 21 intents |
| **Update Field** | #Mental Health#, #Presidential#, #File a Complaint# |
| **Create Record** | #Arrest#, #Assault#, #Legal#, #Car Accident#, #Emergency#, #Hospital#, #Lost Document#, #Missing Ambulance#, #Police#, #Visa Rejection#, #Stuck at Emergency#, #File a Complaint#, #Presidential#, #Mental Health# |
| **Flow** | #Emergency#, #Missing Ambulance#, #Mental Health# |
| **Apex** | #Assault#, #Presidential#, #Agent# |

---

## Intent 1: `#Arrest#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Arrest#` |
| **Description** | Chat indicates the user or someone they know has been arrested or is in police custody. Trigger when phrases like "arrested", "in custody", "detained by police", "police took them", "locked up" appear. |
| **Sequence** | 1 |
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
| Subject | AI Extracted | Summarize the arrest situation from the conversation — concise case subject |
| Description | AI Extracted | Describe the full arrest/detention situation as reported by the user |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I understand this is a very difficult situation. I've logged a support case for you. If someone has been arrested, please contact a legal aid helpline immediately. You have the right to remain silent and the right to an attorney. If this is an ongoing emergency, please call 999. Would you like me to connect you with a support advisor? |

---

## Intent 2: `#Assault#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Assault#` |
| **Description** | The conversation indicates the user or someone they know has been assaulted, attacked, or is a victim of physical violence. Trigger on phrases like "attacked", "assaulted", "hit me", "physical violence", "someone hurt me", "beat up". |
| **Sequence** | 2 |
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
| Subject | AI Extracted | Create a concise subject describing the assault incident from the conversation |
| Description | AI Extracted | Document the assault incident as described by the user — include all relevant details |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Apex (High-Risk Alert)

| Field | Value |
|-------|-------|
| Action Type | Apex |
| Is Active | true |
| Sequence | 2 |
| **Apex Class Name** | `SPEnergyHighRiskNotifier` |
| **Return Type** | Append to Message |

> **Purpose:** Invokes `SPEnergyHighRiskNotifier.invokeApex()` which flags the current account as high-risk and triggers an internal security alert notification. Returns a confirmation message that is appended to the chat response.
>
> **Sample Apex class (deploy to org):**
> ```apex
> global class SPEnergyHighRiskNotifier implements ccai_qa.AIIntentActionInterface {
>     global Map<String, Object> invokeApex(Map<String, Object> request) {
>         String agentId = (String) request.get('agentId');
>         // Add logic here: flag account, send Chatter post, create internal alert
>         return new Map<String, Object>{
>             'success' => true,
>             'message' => 'A high-risk alert has been raised internally. Our security and welfare team will be in contact shortly.'
>         };
>     }
> }
> ```

### Action 3 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | Your safety is our top priority. If you are in immediate danger, please call 999 right now. I've created a support case and our welfare team has been alerted. Please move to a safe location if you can. Do not confront the aggressor — wait for help to arrive. |

---

## Intent 3: `#Legal#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Legal#` |
| **Description** | Chat indicates the user needs legal advice, legal assistance, or is facing a legal problem — phrases like "legal issue", "need a lawyer", "legal advice", "legal rights", "taking to court", "sue", "legal dispute". |
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
| Subject | AI Extracted | Summarize the legal issue from the conversation |
| Description | AI Extracted | Describe the legal problem or query raised by the user |
| Priority | Hardcoded | Medium |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I've logged your legal matter as a support case. For immediate legal guidance, please contact the Legal Aid Helpline. Our support team can also arrange a call-back with a welfare advisor who can point you to the right legal resources. Is there anything more specific I can help you with right now? |

---

## Intent 4: `#Car Accident#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Car Accident#` |
| **Description** | User was involved in or is reporting a car accident, road traffic collision, or vehicle accident — phrases like "car accident", "road accident", "car crash", "collision", "hit by a car", "traffic accident". |
| **Sequence** | 4 |
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
| Subject | AI Extracted | Create a concise case subject describing the car accident from the conversation |
| Description | AI Extracted | Summarize the accident details — location, injuries, and what happened |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I'm sorry to hear about this accident. I've created a support case for you. First — are you and everyone else safe? If there are injuries, please call 999 immediately. If the accident involves another vehicle, do not admit fault, note the other driver's details, and contact your insurance. Our support team will reach out to assist you further. |

---

## Intent 5: `#Emergency#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Emergency#` |
| **Description** | Chat indicates a general emergency or life-threatening situation — phrases like "emergency", "help me", "in danger", "life at risk", "serious situation", "someone is going to get hurt", "need help urgently". |
| **Sequence** | 5 |
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
| Subject | AI Extracted | Create a concise case subject describing the emergency from the conversation |
| Description | AI Extracted | Summarize the emergency situation fully as described by the user |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Flow (Emergency Escalation)

| Field | Value |
|-------|-------|
| Action Type | Flow |
| Is Active | true |
| Sequence | 2 |
| **Flow API Name** | `SP_Emergency_Escalation_Flow` |

> **Purpose:** Triggers the auto-launched Flow `SP_Emergency_Escalation_Flow` which:
> - Sends an internal Chatter notification to the Emergency Response group
> - Creates a follow-up Task assigned to the on-call team
> - Optionally sends an SMS/email alert via org-configured notification channels
>
> _(Only active auto-launched Flows appear in the GPTfy dropdown — ensure this Flow is active before configuring.)_

### Action 3 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | This sounds like an emergency. If there is an immediate threat to life, please call 999 NOW. I've created an urgent support case and our emergency response team has been notified. Stay as calm as you can. If you cannot speak, you can text 999. Is there anything specific I can do to assist you right now? |

---

## Intent 6: `#Hospital#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Hospital#` |
| **Description** | Identify potential hospital or medical emergency situations — user mentions being in hospital, needing medical attention, someone being hospitalised, or health crisis — phrases like "hospital", "admitted", "medical emergency", "ambulance", "collapsed". |
| **Sequence** | 6 |
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
| Subject | AI Extracted | Summarize the medical/hospital situation from the conversation |
| Description | AI Extracted | Document the hospital or medical situation as described by the user |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I've logged a support case for your medical situation. If this is a life-threatening emergency, please call 999 immediately or ask hospital staff for assistance. Our team is here to help with any support needs arising from this situation — whether that's welfare, bill payment pauses, or additional assistance. Please let me know how we can help. |

---

## Intent 7: `#Lost Document#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Lost Document#` |
| **Description** | Chat indicates the user has lost an important document — phrases like "lost my document", "can't find my ID", "lost my passport", "missing certificate", "lost bill", "lost utility document". |
| **Sequence** | 7 |
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
| Subject | AI Extracted | Summarize the lost document situation — what type of document was lost |
| Description | AI Extracted | Describe which document is lost and any relevant context |
| Priority | Hardcoded | Medium |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I've created a case to help you with your lost document. For official SP Energy documents such as bills or account letters, we can reissue copies — please confirm your account details so we can arrange this. For government-issued documents like a passport or ID, please contact the relevant issuing authority. Our support team will be in touch shortly. |

---

## Intent 8: `#Missing Ambulance#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Missing Ambulance#` |
| **Description** | Chat indicates an ambulance was called but has not arrived, or someone is waiting for emergency services that are delayed — phrases like "ambulance hasn't come", "waiting for ambulance", "ambulance not arrived", "called 999 but no one came". |
| **Sequence** | 8 |
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
| Subject | Hardcoded | URGENT: Ambulance / Emergency Services Not Arrived |
| Description | AI Extracted | Document the full details of when emergency services were called and why they have not arrived |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Flow (Urgent Dispatch Escalation)

| Field | Value |
|-------|-------|
| Action Type | Flow |
| Is Active | true |
| Sequence | 2 |
| **Flow API Name** | `SP_Urgent_Dispatch_Flow` |

> **Purpose:** Triggers the auto-launched Flow `SP_Urgent_Dispatch_Flow` which:
> - Immediately sends a push/email alert to the on-call emergency support manager
> - Creates a high-priority Task with ActivityDate = TODAY
> - Posts a Chatter alert to the Emergency Response group

### Action 3 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | This is extremely urgent. Please call 999 again immediately and explain that an ambulance was called but has not arrived — ask for an ETA. If the situation is life-threatening, keep the person calm, lay them down, and follow the 999 operator's instructions. I have created an urgent case and our emergency team has been alerted. Do not hang up on 999. |

---

## Intent 9: `#Police#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Police#` |
| **Description** | Chat indicates police involvement — user is reporting a crime, has been stopped by police, needs to report something to police, or police are involved — phrases like "police", "called the police", "reporting a crime", "police report", "officer". |
| **Sequence** | 9 |
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
| Subject | AI Extracted | Summarize the police-related situation from the conversation |
| Description | AI Extracted | Document the details of the police involvement as described by the user |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I've logged a support case for this situation. If you need to report a non-emergency crime, contact police on 101. For emergencies, call 999. If you're being questioned by police, you have the right to remain silent and request a solicitor. Our welfare team can provide additional support — would you like us to arrange a call-back? |

---

## Intent 10: `#Visa Rejection#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Visa Rejection#` |
| **Description** | Invoke only when the user explicitly mentions a visa rejection, visa refusal, failed visa application, or immigration document problem — phrases like "visa rejected", "visa refused", "immigration application denied", "visa application failed". |
| **Sequence** | 10 |
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
| Subject | AI Extracted | Summarize the visa rejection situation |
| Description | AI Extracted | Document the details of the visa rejection — country, visa type, reason if given |
| Priority | Hardcoded | Medium |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I'm sorry to hear about your visa rejection. I've created a support case. You typically have the right to appeal or reapply — the rejection letter will state the reason and your options. Consider consulting an immigration solicitor for guidance. Our support team can connect you with welfare services if needed. Would you like to arrange a call-back? |

---

## Intent 11: `#Password#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Password#` |
| **Description** | User is requesting a password reset, has forgotten their password, or cannot log in to their account — phrases like "forgot password", "reset password", "can't log in", "locked out of account", "password reset". |
| **Sequence** | 11 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | To reset your SP Energy account password, please visit our website and click "Forgot Password" on the login page — you'll receive a reset link by email within a few minutes. If you don't receive the email, check your spam folder. If you're still locked out after 24 hours, please contact our support team and we'll verify your identity and reset your access manually. |

---

## Intent 12: `#Gibberish#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Gibberish#` |
| **Description** | Any user query that is incomprehensible, random characters, repeated keystrokes, keyboard mashing, or does not form a recognisable language or request — examples: "asdfghjkl", "qwerty", "zzzzzz", random symbols. |
| **Sequence** | 12 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I'm sorry, I didn't quite understand that. Could you please rephrase your question? I'm here to help with emergencies, complaints, account queries, and general support. If you need urgent help, please type "help" or call us directly. |

---

## Intent 13: `#Agent#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Agent#` |
| **Description** | Chat indicates the user wants to speak to a human agent, live advisor, or customer service representative — phrases like "speak to an agent", "talk to a person", "human agent", "real person", "connect me to someone". |
| **Sequence** | 13 |
| **Is Active** | true |

### Action 1 — Apex (Live Agent Handoff)

| Field | Value |
|-------|-------|
| Action Type | Apex |
| Is Active | true |
| Sequence | 1 |
| **Apex Class Name** | `SPEnergyLiveAgentTransfer` |
| **Return Type** | Replace Message |

> **Purpose:** Invokes `SPEnergyLiveAgentTransfer.invokeApex()` to initiate a live agent handoff — sets a transfer flag on the session, notifies the queue, and returns a handoff confirmation message that replaces the AI reply.
>
> **Sample Apex class (deploy to org):**
> ```apex
> global class SPEnergyLiveAgentTransfer implements ccai_qa.AIIntentActionInterface {
>     global Map<String, Object> invokeApex(Map<String, Object> request) {
>         String agentId = (String) request.get('agentId');
>         // Add live agent routing logic here
>         return new Map<String, Object>{
>             'success' => true,
>             'message' => 'Connecting you to a live advisor now. Please hold on — an agent will be with you shortly. Typical wait time is under 5 minutes.'
>         };
>     }
> }
> ```

---

## Intent 14: `#Help#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Help#` |
| **Description** | User asks for general help, is unsure what to do, or is asking what the bot can do — phrases like "help", "what can you do", "I need help", "I don't know where to start", "what are my options". |
| **Sequence** | 14 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I'm the SP Energy support assistant. Here's how I can help you today: Emergency situations (accidents, assaults, medical emergencies), log a complaint or support case, escalate to a senior advisor, account and billing queries, lost documents or password resets, and welfare and legal signposting. Just type what you need and I'll take it from there. |

---

## Intent 15: `#Timeout#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Timeout#` |
| **Description** | The session has timed out due to inactivity, or the user's request has exceeded processing time — triggered by system timeout events or when the user reports the session is unresponsive. |
| **Sequence** | 15 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | It looks like your session timed out due to inactivity. No worries — you can start a new chat at any time and I'll be ready to help. If you were in the middle of something important, please start again. If this was urgent, please call our helpline directly. |

---

## Intent 16: `#Stuck at Emergency#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Stuck at Emergency#` |
| **Description** | Chat indicates the user is stuck or unable to proceed during an ongoing emergency — they're in a dangerous situation and don't know what to do next — phrases like "stuck", "don't know what to do", "can't move", "trapped", "stranded". |
| **Sequence** | 16 |
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
| Subject | AI Extracted | Summarize the situation where the user is stuck — what they are trapped in or unable to do |
| Description | AI Extracted | Document the full context of the user being stuck — where they are, what happened, what help they need |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I can hear that you're in a difficult position right now. I've created an urgent case. If you are physically in danger or trapped, please call 999 immediately. Stay calm, conserve your phone battery, and try to make your location known. Our support team has been alerted and will respond as quickly as possible. |

---

## Intent 17: `#File a Complaint#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#File a Complaint#` |
| **Description** | Chat indicates the user wants to file a formal complaint about SP Energy, a service, a member of staff, or an experience — phrases like "complaint", "I want to complain", "not happy with service", "formal complaint", "raise a complaint". |
| **Sequence** | 17 |
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
| Subject | AI Extracted | Create a concise complaint subject from the conversation |
| Description | AI Extracted | Document the full complaint — what happened, when, and what outcome the user expects |
| Priority | Hardcoded | Medium |
| Status | Hardcoded | New |

### Action 2 — Update Field (Account — flag complaint on record)

| Field | Value |
|-------|-------|
| Action Type | Update Field |
| Is Active | true |
| Sequence | 2 |
| **Object** | Account (Account) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Description | AI Extracted | Prepend "COMPLAINT FILED: " to the account description. Summarize the nature of the complaint from the conversation and append today's date. |

### Action 3 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 3 |
| Canned Response Text | Your complaint has been formally logged and a case has been created. You will receive a reference number by email shortly. Our complaints team aims to respond within 5 working days. If you are unsatisfied with our response, you also have the right to escalate to the relevant regulatory body. Thank you for letting us know — your feedback helps us improve. |

---

## Intent 18: `#Presidential#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Presidential#` |
| **Description** | Chat indicates the user is requesting the highest level of escalation — a presidential or executive-level complaint, references to senior management — phrases like "CEO", "director", "escalate to the top", "presidential complaint", "managing director", "executive". |
| **Sequence** | 18 |
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
| Subject | AI Extracted | Summarize the issue that requires presidential/executive escalation |
| Description | AI Extracted | Document the full context — previous attempts, the core issue, and expected resolution |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Update Field (Account — flag as presidential complaint)

| Field | Value |
|-------|-------|
| Action Type | Update Field |
| Is Active | true |
| Sequence | 2 |
| **Object** | Account (Account) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Description | AI Extracted | Prepend "PRESIDENTIAL COMPLAINT: " to the account description. Include the nature of the escalation and today's date as extracted from the conversation. |

### Action 3 — Apex (Executive Notification)

| Field | Value |
|-------|-------|
| Action Type | Apex |
| Is Active | true |
| Sequence | 3 |
| **Apex Class Name** | `SPEnergyExecutiveNotifier` |
| **Return Type** | Append to Message |

> **Purpose:** Invokes `SPEnergyExecutiveNotifier.invokeApex()` to send an immediate notification to the executive escalations inbox/Chatter group. Appends a confirmation to the chat response.
>
> **Sample Apex class (deploy to org):**
> ```apex
> global class SPEnergyExecutiveNotifier implements ccai_qa.AIIntentActionInterface {
>     global Map<String, Object> invokeApex(Map<String, Object> request) {
>         String agentId = (String) request.get('agentId');
>         // Add logic: post to exec Chatter group, send email to escalations DL
>         return new Map<String, Object>{
>             'success' => true,
>             'message' => 'Your case has been escalated to our executive team. You should expect personal contact within 24 hours.'
>         };
>     }
> }
> ```

### Action 4 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 4 |
| Canned Response Text | I understand you require escalation to our senior leadership team. I've created a high-priority case, flagged your account, and our executive support team has been personally notified. You should expect contact within 24 hours. We take matters at this level very seriously and appreciate your patience. |

---

## Intent 19: `#Can't Reach#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Can't Reach#` |
| **Description** | Chat indicates the user has been unable to reach SP Energy customer service — phrases like "can't get through", "no one is answering", "been on hold for hours", "can't reach anyone", "phone line dead", "tried calling but no answer". |
| **Sequence** | 19 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I'm sorry you've been having difficulty reaching us. I can help you right here via this chat. Alternatively, you can reach us by: Phone: [SP Energy Phone Number] (Mon-Fri 8am-8pm), Live Chat: Available 24/7 on our website, Email: [SP Energy Support Email], Online Account Portal: my.spenergy.com. Would you like me to log a call-back request so a team member reaches out at a time that suits you? |

---

## Intent 20: `#Thank You#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Thank You#` |
| **Description** | Detect exactly when the user is expressing gratitude or closing the conversation positively — phrases like "thank you", "thanks", "thank you so much", "cheers", "much appreciated", "that's great thanks", "brilliant". |
| **Sequence** | 20 |
| **Is Active** | true |

### Action 1 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | You're very welcome! It was my pleasure to help. If you ever need assistance again, don't hesitate to start a new chat. Take care and have a great day! |

---

## Intent 21: `#Mental Health#`

| Field | Value |
|-------|-------|
| **Intent Name** | `#Mental Health#` |
| **Description** | Chat indicates the user is experiencing a mental health crisis, feeling suicidal, deeply distressed, or overwhelmed — phrases like "can't cope", "want to end it all", "suicidal", "mental health crisis", "I can't go on", "depressed", "having a breakdown", "feeling hopeless". |
| **Sequence** | 21 |
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
| Subject | Hardcoded | Mental Health Support Required — Immediate Follow-up Needed |
| Description | AI Extracted | Carefully summarise what the user has shared about their mental health situation — use empathetic, clinical language |
| Priority | Hardcoded | High |
| Status | Hardcoded | New |

### Action 2 — Update Field (Account — welfare flag)

| Field | Value |
|-------|-------|
| Action Type | Update Field |
| Is Active | true |
| Sequence | 2 |
| **Object** | Account (Account) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| Description | Hardcoded | WELFARE FLAG: Customer has indicated mental health concern. Welfare team follow-up required. Handle with care. |

### Action 3 — Flow (Welfare Check Notification)

| Field | Value |
|-------|-------|
| Action Type | Flow |
| Is Active | true |
| Sequence | 3 |
| **Flow API Name** | `SP_Welfare_Check_Flow` |

> **Purpose:** Triggers the auto-launched Flow `SP_Welfare_Check_Flow` which:
> - Sends an immediate email/SMS alert to the designated Welfare Officer
> - Creates a follow-up Task with ActivityDate = TODAY and Priority = High
> - Posts a confidential Chatter note to the Welfare Support private group

### Action 4 — Canned Response (English)

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 4 |
| Canned Response Text | I hear you, and I'm really glad you reached out. You are not alone. Please know that help is available right now. If you are in immediate crisis, please call the Samaritans on 116 123 (free, 24/7) or text SHOUT to 85258. I've created a case and our welfare team will follow up with you personally. You don't have to face this on your own — we care about your wellbeing. |

---

## Summary Table

| Intent Name | Seq | Canned Response | Update Field | Create Record | Flow | Apex |
|-------------|-----|:-:|:-:|:-:|:-:|:-:|
| `#Arrest#` | 1 | ✓ | | ✓ (Case) | | |
| `#Assault#` | 2 | ✓ | | ✓ (Case) | | ✓ SPEnergyHighRiskNotifier |
| `#Legal#` | 3 | ✓ | | ✓ (Case) | | |
| `#Car Accident#` | 4 | ✓ | | ✓ (Case) | | |
| `#Emergency#` | 5 | ✓ | | ✓ (Case) | ✓ SP_Emergency_Escalation_Flow | |
| `#Hospital#` | 6 | ✓ | | ✓ (Case) | | |
| `#Lost Document#` | 7 | ✓ | | ✓ (Case) | | |
| `#Missing Ambulance#` | 8 | ✓ | | ✓ (Case) | ✓ SP_Urgent_Dispatch_Flow | |
| `#Police#` | 9 | ✓ | | ✓ (Case) | | |
| `#Visa Rejection#` | 10 | ✓ | | ✓ (Case) | | |
| `#Password#` | 11 | ✓ | | | | |
| `#Gibberish#` | 12 | ✓ | | | | |
| `#Agent#` | 13 | | | | | ✓ SPEnergyLiveAgentTransfer |
| `#Help#` | 14 | ✓ | | | | |
| `#Timeout#` | 15 | ✓ | | | | |
| `#Stuck at Emergency#` | 16 | ✓ | | ✓ (Case) | | |
| `#File a Complaint#` | 17 | ✓ | ✓ Account.Description | ✓ (Case) | | |
| `#Presidential#` | 18 | ✓ | ✓ Account.Description | ✓ (Case) | | ✓ SPEnergyExecutiveNotifier |
| `#Can't Reach#` | 19 | ✓ | | | | |
| `#Thank You#` | 20 | ✓ | | | | |
| `#Mental Health#` | 21 | ✓ | ✓ Account.Description | ✓ (Case) | ✓ SP_Welfare_Check_Flow | |

---

## Apex Classes to Deploy

Three Apex classes must be deployed to the org before configuring those actions in GPTfy UI:

| Class Name | Intent | Interface | Return Type |
|------------|--------|-----------|-------------|
| `SPEnergyHighRiskNotifier` | #Assault# | `ccai_qa.AIIntentActionInterface` (or `ccai.` in managed pkg org) | Append to Message |
| `SPEnergyLiveAgentTransfer` | #Agent# | `ccai_qa.AIIntentActionInterface` | Replace Message |
| `SPEnergyExecutiveNotifier` | #Presidential# | `ccai_qa.AIIntentActionInterface` | Append to Message |

> **Namespace note:** In the dev/QA package org the interface is `ccai_qa.AIIntentActionInterface`. In a managed package installed org, use `ccai.AIIntentActionInterface`.

## Flows to Create/Activate

Three auto-launched Flows must be active in the org before they will appear in the GPTfy dropdown:

| Flow API Name | Intent | Recommended Actions inside Flow |
|---------------|--------|----------------------------------|
| `SP_Emergency_Escalation_Flow` | #Emergency# | Chatter post to Emergency Response group, create Task |
| `SP_Urgent_Dispatch_Flow` | #Missing Ambulance# | Email/SMS to on-call manager, create High-priority Task |
| `SP_Welfare_Check_Flow` | #Mental Health# | Email to Welfare Officer, create Task, Chatter to Welfare group |

---

## Design Notes

- **All 5 action types are used** — Canned Response (all), Create Record (14 crisis intents), Update Field (complaint/welfare flagging), Flow (emergency dispatch/welfare), Apex (live agent handoff, high-risk alerts, exec notification).
- **Hashtag naming** — Intent Names use `#Hashtag#` format exactly as the AI returns in `"intents": []`.
- **Multi-action ordering** — For crisis intents: Create Record fires first (paper trail), then Flow/Apex (automation), then Canned Response (user message).
- **Update Field for audit** — `#File a Complaint#`, `#Presidential#`, and `#Mental Health#` all write to `Account.Description` so there is a permanent record on the account itself, not just in the Case.
- **Mental health Subject is Hardcoded** — ensures consistent, compliant language for safeguarding records regardless of AI interpretation.
- **Replace contact placeholders** — `[SP Energy Phone Number]` and `[SP Energy Support Email]` in intents 13 and 19 must be updated with actual values before going live.
