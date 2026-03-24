/**
 * Add Apex append action to troubleshoot_connectivity_issue so
 * mixed frustration+VPN messages still show appended Apex output.
 */

AI_Agent_Intent__c i = [
    SELECT Id
    FROM AI_Agent_Intent__c
    WHERE AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND Name = 'troubleshoot_connectivity_issue'
    LIMIT 1
];

Integer hasApex = [
    SELECT COUNT()
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__c = :i.Id
      AND Action_Type__c = 'Apex'
];

if (hasApex == 0) {
    insert new AI_Intent_Action__c(
        AI_Agent_Intent__c = i.Id,
        Action_Type__c = 'Apex',
        Sequence__c = 2,
        Is_Active__c = true,
        Apex_Class_Name__c = 'ITHelpdeskEscalationApex',
        Apex_Return_Type__c = 'Append to Message',
        Description__c = 'Append escalation metadata for connectivity issues.'
    );
}

// Keep canned response first so user guidance remains primary.
List<AI_Intent_Action__c> acts = [
    SELECT Id, Action_Type__c, Sequence__c, Is_Active__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__c = :i.Id
];
for (AI_Intent_Action__c a : acts) {
    if (a.Action_Type__c == 'Canned Response') a.Sequence__c = 1;
    if (a.Action_Type__c == 'Apex') a.Sequence__c = 2;
    a.Is_Active__c = true;
}
if (!acts.isEmpty()) update acts;

System.debug('Connectivity intent now includes Apex append action.');
