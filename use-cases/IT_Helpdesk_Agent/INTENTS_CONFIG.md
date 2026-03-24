# IT Helpdesk Agent — Intent Action Configurations

**Agent:** IT Helpdesk Agent  
**Capabilities:** Troubleshooting guidance, software install support, password reset help, FAQ responses, and escalation to human support

These intents capture common IT support conversations and convert them into clear, user-friendly actions with empathetic responses and escalation safeguards.

---

## Intent 1: `helpdesk_greeting`

| Field | Value |
|-------|-------|
| **Intent Name** | `helpdesk_greeting` |
| **Description** | Trigger when the user opens a conversation with a greeting or asks for general help — phrases like "hi", "hello", "hey", "can you help me", "I need IT support". |
| **Sequence** | 1 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Hello! I am your IT Helpdesk Agent. I can help with password resets, software installation issues, account access problems, and common troubleshooting steps. Tell me what is happening and I will guide you step by step. |

---

## Intent 2: `create_case_for_contact`

| Field | Value |
|-------|-------|
| **Intent Name** | `create_case_for_contact` |
| **Description** | Trigger when the user reports an issue that should be tracked as a support ticket for a known person or customer contact — phrases like "create a case for this user", "open a support case", "log this issue", "raise a ticket for contact". |
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
| Subject | AI Extracted | Generate a concise issue summary from the user's message. |
| ContactId | AI Extracted | Identify the contact from conversation context and link the case. |
| Status | Hardcoded | New |
| Priority | AI Extracted | Set High for outage/urgent language, otherwise Medium. |
| Origin | Hardcoded | Chat |
| Description | AI Extracted | Summarize symptoms, affected device/software, and steps already tried. |

### Action 2 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | I have captured this as a support case and linked it to the contact. I will continue helping you with troubleshooting while the case is tracked. |

---

## Intent 3: `create_Contact_by_Name`

| Field | Value |
|-------|-------|
| **Intent Name** | `create_Contact_by_Name` |
| **Description** | Trigger when a user asks to create a new contact profile for support tracking — phrases like "create a contact", "add a new user", "register contact", "create contact by name". |
| **Sequence** | 3 |
| **Is Active** | true |

### Action 1 — Create Record (Contact)

| Field | Value |
|-------|-------|
| Action Type | Create Record |
| Is Active | true |
| Sequence | 1 |
| **Object** | Contact (Contact) |

**Field Mapping:**

| Field | Type | AI Description / Value |
|-------|------|------------------------|
| FirstName | AI Extracted | Extract first name from user-provided full name. |
| LastName | AI Extracted | Extract last name, or use "Unknown" if not provided. |
| Email | AI Extracted | Capture email if provided in chat. |
| Phone | AI Extracted | Capture phone number if provided. |
| Description | AI Extracted | Note this contact was created during IT support assistance. |

### Action 2 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | The contact has been created. If you want, I can now create a support case for this contact and include the issue details. |

---

## Intent 4: `password_reset_help`

| Field | Value |
|-------|-------|
| **Intent Name** | `password_reset_help` |
| **Description** | Trigger when the user asks how to reset a password, cannot sign in, or is locked out — phrases like "reset my password", "forgot password", "can't log in", "account locked". |
| **Sequence** | 4 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I can help with that. Please try these steps: 1) Go to the sign-in page and select "Forgot Password". 2) Enter your work email or username. 3) Use the reset link sent to your email. 4) Create a strong new password and sign in again. If you do not receive the email within 5 minutes, check spam/junk and let me know. |

---

## Intent 5: `software_installation_issue`

| Field | Value |
|-------|-------|
| **Intent Name** | `software_installation_issue` |
| **Description** | Trigger when the user reports software install failures, setup errors, missing permissions, or compatibility problems — phrases like "install failed", "cannot install", "setup error", "installation stuck". |
| **Sequence** | 5 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I can guide you through this. Please share: the software name and version, your operating system, the exact error message, and at which step installation fails. Meanwhile, try these quick checks: run installer as administrator, confirm enough disk space, close background installers, and reboot once before retrying. |

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
| Subject | Hardcoded | Software Installation Support Follow-up |
| Description | AI Extracted | Capture software name, error details, and user environment from conversation. |
| Status | Hardcoded | Not Started |
| Priority | Hardcoded | Normal |
| ActivityDate | Hardcoded | TODAY |

---

## Intent 6: `troubleshoot_connectivity_issue`

| Field | Value |
|-------|-------|
| **Intent Name** | `troubleshoot_connectivity_issue` |
| **Description** | Trigger when users report internet, VPN, Wi-Fi, or network access problems — phrases like "no internet", "VPN not connecting", "Wi-Fi keeps dropping", "network error". |
| **Sequence** | 6 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | Let us check this step by step: 1) Confirm other websites/services fail too. 2) Restart Wi-Fi or reconnect network cable. 3) Restart VPN client and sign in again. 4) Reboot your device. 5) If available, test with a different network/hotspot. Tell me which step changes the behavior. |

---

## Intent 7: `faq_software_access`

| Field | Value |
|-------|-------|
| **Intent Name** | `faq_software_access` |
| **Description** | Trigger when users ask common access/setup questions — phrases like "how do I get access", "where do I download", "what license do I need", "how do I configure this app". |
| **Sequence** | 7 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | For software access, you usually need: approved access request, valid company account, and license assignment. Share the software name and your department, and I will provide the exact request path and setup steps. |

---

## Intent 8: `user_frustrated_reassure`

| Field | Value |
|-------|-------|
| **Intent Name** | `user_frustrated_reassure` |
| **Description** | Trigger when the user is upset, stressed, or frustrated — phrases like "this is annoying", "nothing works", "I am frustrated", "I have tried everything". |
| **Sequence** | 8 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I understand this is frustrating, and I am here to help. We will go one step at a time and get this resolved as quickly as possible. Please share the latest error you see right now, and I will guide the next best step. |

---

## Intent 9: `escalate_to_human_support`

| Field | Value |
|-------|-------|
| **Intent Name** | `escalate_to_human_support` |
| **Description** | Trigger when the issue is advanced, sensitive, security-related, or not resolved after standard steps — phrases like "this still doesn't work", "need an engineer", "security issue", "I need human help". |
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
| Subject | Hardcoded | Escalation Required: IT Support Issue |
| Status | Hardcoded | New |
| Priority | Hardcoded | High |
| Origin | Hardcoded | Chat |
| Description | AI Extracted | Summarize issue, troubleshooting performed, and reason for escalation. |

### Action 2 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 2 |
| Canned Response Text | This looks like it needs advanced support. I am escalating it to a human IT specialist now and sharing the troubleshooting details so you do not have to repeat everything. |

---

## Intent 10: `helpdesk_out_of_scope`

| Field | Value |
|-------|-------|
| **Intent Name** | `helpdesk_out_of_scope` |
| **Description** | Trigger when requests are unrelated to IT helpdesk scope or require personal/legal/financial advice. |
| **Sequence** | 10 |
| **Is Active** | true |

### Action 1 — Canned Response

| Field | Value |
|-------|-------|
| Action Type | Canned Response |
| Language | English |
| Is Active | true |
| Sequence | 1 |
| Canned Response Text | I can only assist with IT support tasks such as troubleshooting, software setup, account access, password help, and support escalation. For other requests, please contact the appropriate team. |

---

## Summary Table

| Intent Name | Sequence | Actions | Trigger Pattern |
|-------------|----------|---------|-----------------|
| `helpdesk_greeting` | 1 | Canned Response | Greeting or open-ended IT help request |
| `create_case_for_contact` | 2 | Create Case + Canned Response | "create case", "open ticket", "log issue for contact" |
| `create_Contact_by_Name` | 3 | Create Contact + Canned Response | "create contact", "add user", "create contact by name" |
| `password_reset_help` | 4 | Canned Response | "forgot password", "account locked", "can't log in" |
| `software_installation_issue` | 5 | Canned Response + Create Task | "install failed", "setup error", "cannot install" |
| `troubleshoot_connectivity_issue` | 6 | Canned Response | "no internet", "VPN issue", "Wi-Fi drops" |
| `faq_software_access` | 7 | Canned Response | Access/license/download/configuration FAQs |
| `user_frustrated_reassure` | 8 | Canned Response | User frustration/emotional distress language |
| `escalate_to_human_support` | 9 | Create Case + Canned Response | Unresolved, sensitive, or advanced issues |
| `helpdesk_out_of_scope` | 10 | Canned Response | Non-IT or unsupported requests |

