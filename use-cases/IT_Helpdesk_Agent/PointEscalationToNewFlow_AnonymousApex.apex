/**
 * Point escalation Flow action to deployed IT_Helpdesk_Escalation_Flow.
 */

List<AI_Intent_Action__c> acts = [
    SELECT Id, Flow_API_Name__c, Is_Active__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__r.AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND AI_Agent_Intent__r.Name = 'escalate_to_human_support'
      AND Action_Type__c = 'Flow'
];

for (AI_Intent_Action__c a : acts) {
    a.Flow_API_Name__c = 'IT_Helpdesk_Escalation_Flow';
    a.Is_Active__c = true;
}

if (!acts.isEmpty()) update acts;

System.debug('Escalation flow action set to IT_Helpdesk_Escalation_Flow.');
