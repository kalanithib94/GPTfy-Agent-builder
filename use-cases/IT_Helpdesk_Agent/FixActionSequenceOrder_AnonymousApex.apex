/**
 * Normalize action sequence order: backend actions first, canned response last.
 */

List<AI_Intent_Action__c> actions = [
    SELECT Id, AI_Agent_Intent__r.Name, Action_Type__c, Sequence__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__r.AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND AI_Agent_Intent__r.Name IN ('create_case_for_contact', 'escalate_to_human_support', 'user_frustrated_reassure')
];

for (AI_Intent_Action__c a : actions) {
    String intentName = a.AI_Agent_Intent__r.Name;
    if (intentName == 'create_case_for_contact') {
        if (a.Action_Type__c == 'Create Record') a.Sequence__c = 1;
        else if (a.Action_Type__c == 'Update Field') a.Sequence__c = 2;
        else if (a.Action_Type__c == 'Canned Response') a.Sequence__c = 3;
    } else if (intentName == 'escalate_to_human_support') {
        if (a.Action_Type__c == 'Create Record') a.Sequence__c = 1;
        else if (a.Action_Type__c == 'Flow') a.Sequence__c = 2;
        else if (a.Action_Type__c == 'Canned Response') a.Sequence__c = 3;
    } else if (intentName == 'user_frustrated_reassure') {
        if (a.Action_Type__c == 'Apex') a.Sequence__c = 1;
        else if (a.Action_Type__c == 'Canned Response') a.Sequence__c = 2;
    }
}

if (!actions.isEmpty()) update actions;

System.debug('Action sequences normalized for IT Helpdesk Agent.');
