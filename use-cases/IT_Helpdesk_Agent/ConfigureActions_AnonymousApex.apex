/**
 * Configure IT Helpdesk intent actions and details.
 * Sets action metadata + detail Value__c instructions/hardcoded values.
 */

Set<String> intentNames = new Set<String>{
    'helpdesk_greeting',
    'create_case_for_contact',
    'create_Contact_by_Name',
    'password_reset_help',
    'software_installation_issue',
    'troubleshoot_connectivity_issue',
    'faq_software_access',
    'user_frustrated_reassure',
    'escalate_to_human_support',
    'helpdesk_out_of_scope'
};

List<AI_Agent_Intent__c> intents = [
    SELECT Id, Name
    FROM AI_Agent_Intent__c
    WHERE AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND Name IN :intentNames
];

Map<Id, AI_Agent_Intent__c> intentById = new Map<Id, AI_Agent_Intent__c>(intents);
Set<Id> intentIds = intentById.keySet();

List<AI_Intent_Action__c> actions = [
    SELECT Id, Name, AI_Agent_Intent__c, Action_Type__c, Sequence__c, Is_Active__c,
           Language__c, Canned_Response__c, Object_Name__c, Description__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__c IN :intentIds
    ORDER BY AI_Agent_Intent__c, CreatedDate
];

Map<Id, List<AI_Intent_Action__c>> actionsByIntent = new Map<Id, List<AI_Intent_Action__c>>();
for (AI_Intent_Action__c a : actions) {
    if (!actionsByIntent.containsKey(a.AI_Agent_Intent__c)) {
        actionsByIntent.put(a.AI_Agent_Intent__c, new List<AI_Intent_Action__c>());
    }
    actionsByIntent.get(a.AI_Agent_Intent__c).add(a);
}

String cannedHelpdeskGreeting = 'Hello! I am your IT Helpdesk Agent. I can help with password resets, software installation issues, account access problems, and common troubleshooting steps. Tell me what is happening and I will guide you step by step.';
String cannedCreateCase = 'I have captured this as a support case and linked it to the contact. I will continue helping you with troubleshooting while the case is tracked.';
String cannedCreateContact = 'The contact has been created. If you want, I can now create a support case for this contact and include the issue details.';
String cannedPasswordReset = 'I can help with that. Please try these steps: 1) Go to the sign-in page and select "Forgot Password". 2) Enter your work email or username. 3) Use the reset link sent to your email. 4) Create a strong new password and sign in again. If you do not receive the email within 5 minutes, check spam/junk and let me know.';
String cannedInstallIssue = 'I can guide you through this. Please share: the software name and version, your operating system, the exact error message, and at which step installation fails. Meanwhile, try these quick checks: run installer as administrator, confirm enough disk space, close background installers, and reboot once before retrying.';
String cannedConnectivity = 'Let us check this step by step: 1) Confirm other websites/services fail too. 2) Restart Wi-Fi or reconnect network cable. 3) Restart VPN client and sign in again. 4) Reboot your device. 5) If available, test with a different network/hotspot. Tell me which step changes the behavior.';
String cannedFaqAccess = 'For software access, you usually need: approved access request, valid company account, and license assignment. Share the software name and your department, and I will provide the exact request path and setup steps.';
String cannedFrustrated = 'I understand this is frustrating, and I am here to help. We will go one step at a time and get this resolved as quickly as possible. Please share the latest error you see right now, and I will guide the next best step.';
String cannedEscalation = 'This looks like it needs advanced support. I am escalating it to a human IT specialist now and sharing the troubleshooting details so you do not have to repeat everything.';
String cannedOutOfScope = 'I can only assist with IT support tasks such as troubleshooting, software setup, account access, password help, and support escalation. For other requests, please contact the appropriate team.';

for (AI_Agent_Intent__c i : intents) {
    List<AI_Intent_Action__c> listForIntent = actionsByIntent.get(i.Id);
    if (listForIntent == null || listForIntent.isEmpty()) continue;

    if (i.Name == 'helpdesk_greeting') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedHelpdeskGreeting;
        a.Object_Name__c = null;
        a.Description__c = 'Welcome and capability overview.';
    } else if (i.Name == 'create_case_for_contact' && listForIntent.size() >= 2) {
        AI_Intent_Action__c aCreate = listForIntent[0];
        AI_Intent_Action__c aCanned = listForIntent[1];

        aCreate.Action_Type__c = 'Create Record';
        aCreate.Sequence__c = 1;
        aCreate.Is_Active__c = true;
        aCreate.Object_Name__c = 'Case';
        aCreate.Language__c = null;
        aCreate.Canned_Response__c = null;
        aCreate.Description__c = 'Create support case linked to contact.';

        aCanned.Action_Type__c = 'Canned Response';
        aCanned.Sequence__c = 2;
        aCanned.Is_Active__c = true;
        aCanned.Language__c = 'en';
        aCanned.Canned_Response__c = cannedCreateCase;
        aCanned.Object_Name__c = null;
        aCanned.Description__c = 'Confirm case creation and continue support.';
    } else if (i.Name == 'create_Contact_by_Name' && listForIntent.size() >= 2) {
        AI_Intent_Action__c aCreate = listForIntent[0];
        AI_Intent_Action__c aCanned = listForIntent[1];

        aCreate.Action_Type__c = 'Create Record';
        aCreate.Sequence__c = 1;
        aCreate.Is_Active__c = true;
        aCreate.Object_Name__c = 'Contact';
        aCreate.Language__c = null;
        aCreate.Canned_Response__c = null;
        aCreate.Description__c = 'Create contact from provided user details.';

        aCanned.Action_Type__c = 'Canned Response';
        aCanned.Sequence__c = 2;
        aCanned.Is_Active__c = true;
        aCanned.Language__c = 'en';
        aCanned.Canned_Response__c = cannedCreateContact;
        aCanned.Object_Name__c = null;
        aCanned.Description__c = 'Confirm contact creation.';
    } else if (i.Name == 'password_reset_help') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedPasswordReset;
        a.Object_Name__c = null;
        a.Description__c = 'Password reset walkthrough.';
    } else if (i.Name == 'software_installation_issue' && listForIntent.size() >= 2) {
        AI_Intent_Action__c a1 = listForIntent[0];
        AI_Intent_Action__c a2 = listForIntent[1];
        AI_Intent_Action__c aTask = a1;
        AI_Intent_Action__c aCanned = a2;

        // Ensure backend action sequence first per guide.
        aTask.Action_Type__c = 'Create Record';
        aTask.Sequence__c = 1;
        aTask.Is_Active__c = true;
        aTask.Object_Name__c = 'Task';
        aTask.Language__c = null;
        aTask.Canned_Response__c = null;
        aTask.Description__c = 'Create follow-up task for installation issue.';

        aCanned.Action_Type__c = 'Canned Response';
        aCanned.Sequence__c = 2;
        aCanned.Is_Active__c = true;
        aCanned.Language__c = 'en';
        aCanned.Canned_Response__c = cannedInstallIssue;
        aCanned.Object_Name__c = null;
        aCanned.Description__c = 'Collect install diagnostics and provide checks.';
    } else if (i.Name == 'troubleshoot_connectivity_issue') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedConnectivity;
        a.Object_Name__c = null;
        a.Description__c = 'Step-by-step connectivity troubleshooting.';
    } else if (i.Name == 'faq_software_access') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedFaqAccess;
        a.Object_Name__c = null;
        a.Description__c = 'Answer access/licensing FAQ.';
    } else if (i.Name == 'user_frustrated_reassure') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedFrustrated;
        a.Object_Name__c = null;
        a.Description__c = 'Empathy response and focused next step.';
    } else if (i.Name == 'escalate_to_human_support' && listForIntent.size() >= 2) {
        AI_Intent_Action__c aCreate = listForIntent[0];
        AI_Intent_Action__c aCanned = listForIntent[1];

        aCreate.Action_Type__c = 'Create Record';
        aCreate.Sequence__c = 1;
        aCreate.Is_Active__c = true;
        aCreate.Object_Name__c = 'Case';
        aCreate.Language__c = null;
        aCreate.Canned_Response__c = null;
        aCreate.Description__c = 'Create escalation case for human support.';

        aCanned.Action_Type__c = 'Canned Response';
        aCanned.Sequence__c = 2;
        aCanned.Is_Active__c = true;
        aCanned.Language__c = 'en';
        aCanned.Canned_Response__c = cannedEscalation;
        aCanned.Object_Name__c = null;
        aCanned.Description__c = 'Inform user of escalation.';
    } else if (i.Name == 'helpdesk_out_of_scope') {
        AI_Intent_Action__c a = listForIntent[0];
        a.Action_Type__c = 'Canned Response';
        a.Sequence__c = 1;
        a.Is_Active__c = true;
        a.Language__c = 'en';
        a.Canned_Response__c = cannedOutOfScope;
        a.Object_Name__c = null;
        a.Description__c = 'Out-of-scope redirect.';
    }
}

update actions;

// Configure detail rows for Create Record actions.
Map<Id, AI_Intent_Action__c> actionById = new Map<Id, AI_Intent_Action__c>(actions);
Set<Id> createActionIds = new Set<Id>();
for (AI_Intent_Action__c a : actions) {
    if (a.Action_Type__c == 'Create Record') createActionIds.add(a.Id);
}

List<AI_Intent_Action_Detail__c> details = new List<AI_Intent_Action_Detail__c>();
if (!createActionIds.isEmpty()) {
    details = [
        SELECT Id, AI_Intent_Action__c, Field_API_Name__c, Sequence__c, Type__c, Value__c
        FROM AI_Intent_Action_Detail__c
        WHERE AI_Intent_Action__c IN :createActionIds
    ];
}

Map<Id, String> intentNameByAction = new Map<Id, String>();
for (AI_Intent_Action__c a : actions) {
    AI_Agent_Intent__c i = intentById.get(a.AI_Agent_Intent__c);
    if (i != null) intentNameByAction.put(a.Id, i.Name);
}

Map<String, Integer> seqByFieldCreateCaseForContact = new Map<String, Integer>{
    'Subject' => 1, 'ContactId' => 2, 'Status' => 3, 'Priority' => 4, 'Origin' => 5, 'Description' => 6
};
Map<String, Integer> seqByFieldCreateContact = new Map<String, Integer>{
    'FirstName' => 1, 'LastName' => 2, 'Email' => 3, 'Phone' => 4, 'Description' => 5
};
Map<String, Integer> seqByFieldInstallTask = new Map<String, Integer>{
    'Subject' => 1, 'Description' => 2, 'Status' => 3, 'Priority' => 4, 'ActivityDate' => 5
};
Map<String, Integer> seqByFieldEscalateCase = new Map<String, Integer>{
    'Subject' => 1, 'Status' => 2, 'Priority' => 3, 'Origin' => 4, 'Description' => 5
};

for (AI_Intent_Action_Detail__c d : details) {
    String iname = intentNameByAction.get(d.AI_Intent_Action__c);
    if (iname == null) continue;

    if (iname == 'create_case_for_contact') {
        if (seqByFieldCreateCaseForContact.containsKey(d.Field_API_Name__c)) {
            d.Sequence__c = seqByFieldCreateCaseForContact.get(d.Field_API_Name__c);
        }
        if (d.Field_API_Name__c == 'Subject') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Generate a concise issue summary from the user message.';
        } else if (d.Field_API_Name__c == 'ContactId') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Identify the contact from conversation context and link the case.';
        } else if (d.Field_API_Name__c == 'Status') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'New';
        } else if (d.Field_API_Name__c == 'Priority') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Set High for outage or urgent language, otherwise Medium.';
        } else if (d.Field_API_Name__c == 'Origin') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Chat';
        } else if (d.Field_API_Name__c == 'Description') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Summarize symptoms, affected device or software, and steps already tried.';
        }
    } else if (iname == 'create_Contact_by_Name') {
        if (seqByFieldCreateContact.containsKey(d.Field_API_Name__c)) {
            d.Sequence__c = seqByFieldCreateContact.get(d.Field_API_Name__c);
        }
        if (d.Field_API_Name__c == 'FirstName') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Extract first name from user-provided full name.';
        } else if (d.Field_API_Name__c == 'LastName') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Extract last name. If not provided, use Unknown.';
        } else if (d.Field_API_Name__c == 'Email') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Capture email if provided in chat.';
        } else if (d.Field_API_Name__c == 'Phone') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Capture phone number if provided.';
        } else if (d.Field_API_Name__c == 'Description') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Note this contact was created during IT support assistance.';
        }
    } else if (iname == 'software_installation_issue') {
        if (seqByFieldInstallTask.containsKey(d.Field_API_Name__c)) {
            d.Sequence__c = seqByFieldInstallTask.get(d.Field_API_Name__c);
        }
        if (d.Field_API_Name__c == 'Subject') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Software Installation Support Follow-up';
        } else if (d.Field_API_Name__c == 'Description') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Capture software name, error details, and user environment from conversation.';
        } else if (d.Field_API_Name__c == 'Status') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Not Started';
        } else if (d.Field_API_Name__c == 'Priority') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Normal';
        } else if (d.Field_API_Name__c == 'ActivityDate') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'TODAY';
        }
    } else if (iname == 'escalate_to_human_support') {
        if (seqByFieldEscalateCase.containsKey(d.Field_API_Name__c)) {
            d.Sequence__c = seqByFieldEscalateCase.get(d.Field_API_Name__c);
        }
        if (d.Field_API_Name__c == 'Subject') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Escalation Required: IT Support Issue';
        } else if (d.Field_API_Name__c == 'Status') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'New';
        } else if (d.Field_API_Name__c == 'Priority') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'High';
        } else if (d.Field_API_Name__c == 'Origin') {
            d.Type__c = 'Hardcoded';
            d.Value__c = 'Chat';
        } else if (d.Field_API_Name__c == 'Description') {
            d.Type__c = 'AI Extracted';
            d.Value__c = 'Summarize issue, troubleshooting performed, and reason for escalation.';
        }
    }
}

if (!details.isEmpty()) {
    update details;
}

System.debug('Configured actions: ' + actions.size() + ', details: ' + details.size());
