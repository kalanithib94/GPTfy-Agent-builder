/**
 * Ensure Apex append runs after canned response for visibility.
 */

List<AI_Intent_Action__c> actions = [
    SELECT Id, Action_Type__c, Sequence__c, Is_Active__c, Apex_Return_Type__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__r.AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND AI_Agent_Intent__r.Name = 'user_frustrated_reassure'
];

for (AI_Intent_Action__c a : actions) {
    if (a.Action_Type__c == 'Canned Response') {
        a.Sequence__c = 1;
        a.Is_Active__c = true;
    } else if (a.Action_Type__c == 'Apex') {
        a.Sequence__c = 2;
        a.Is_Active__c = true;
        a.Apex_Return_Type__c = 'Append to Message';
    }
}

if (!actions.isEmpty()) update actions;

System.debug('Adjusted user_frustrated_reassure action order for Apex append.');
