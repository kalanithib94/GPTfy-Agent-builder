/**
 * Ensure helpdesk_greeting has an active canned response action.
 */

AI_Agent_Intent__c greet = [
    SELECT Id, Name
    FROM AI_Agent_Intent__c
    WHERE AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND Name = 'helpdesk_greeting'
    ORDER BY CreatedDate DESC
    LIMIT 1
];

List<AI_Intent_Action__c> acts = [
    SELECT Id, Action_Type__c, Sequence__c, Is_Active__c, Language__c, Canned_Response__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__c = :greet.Id
    ORDER BY CreatedDate
];

AI_Intent_Action__c a;
if (acts.isEmpty()) {
    a = new AI_Intent_Action__c(AI_Agent_Intent__c = greet.Id);
} else {
    a = acts[0];
}

a.Action_Type__c = 'Canned Response';
a.Sequence__c = 1;
a.Is_Active__c = true;
a.Language__c = 'en';
a.Canned_Response__c = 'Hello! I am your IT Helpdesk Agent. I can help with password resets, software installation issues, account access problems, and common troubleshooting steps. Tell me what is happening and I will guide you step by step.';

if (a.Id == null) {
    insert a;
} else {
    update a;
}

System.debug('Greeting canned response ensured. Action Id: ' + a.Id);
