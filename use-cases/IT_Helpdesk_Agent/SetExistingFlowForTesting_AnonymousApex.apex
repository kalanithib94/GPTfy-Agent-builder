/**
 * Set an existing active flow API name so escalation flow action can be tested.
 */

List<AI_Intent_Action__c> acts = [
    SELECT Id, Flow_API_Name__c, Is_Active__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__r.AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND AI_Agent_Intent__r.Name = 'escalate_to_human_support'
      AND Action_Type__c = 'Flow'
];

for (AI_Intent_Action__c a : acts) {
    a.Flow_API_Name__c = 'Invoke_Flow_Test';
    a.Is_Active__c = true;
}

if (!acts.isEmpty()) update acts;

System.debug('Flow action updated to Invoke_Flow_Test for testing.');
