/**
 * Add missing action types (Update Field, Flow, Apex) to IT Helpdesk Agent.
 */

Map<String, AI_Agent_Intent__c> intentByName = new Map<String, AI_Agent_Intent__c>();
for (AI_Agent_Intent__c i : [
    SELECT Id, Name
    FROM AI_Agent_Intent__c
    WHERE AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND Name IN ('create_case_for_contact', 'escalate_to_human_support', 'user_frustrated_reassure')
]) {
    intentByName.put(i.Name, i);
}

// 1) Update Field action on create_case_for_contact
if (intentByName.containsKey('create_case_for_contact')) {
    AI_Agent_Intent__c i = intentByName.get('create_case_for_contact');
    Integer cnt = [SELECT COUNT() FROM AI_Intent_Action__c
                   WHERE AI_Agent_Intent__c = :i.Id AND Action_Type__c = 'Update Field'];
    if (cnt == 0) {
        AI_Intent_Action__c a = new AI_Intent_Action__c(
            AI_Agent_Intent__c = i.Id,
            Action_Type__c = 'Update Field',
            Sequence__c = 2,
            Is_Active__c = true,
            Object_Name__c = 'Contact',
            Description__c = 'Update contact description with latest helpdesk context.'
        );
        insert a;
        insert new AI_Intent_Action_Detail__c(
            AI_Intent_Action__c = a.Id,
            Field_API_Name__c = 'Description',
            Sequence__c = 1,
            Type__c = 'AI Extracted',
            Value__c = 'Append IT HELPDESK NOTE: and summarize issue for future follow-up context.'
        );
    }
}

// 2) Flow action on escalate_to_human_support
if (intentByName.containsKey('escalate_to_human_support')) {
    AI_Agent_Intent__c i = intentByName.get('escalate_to_human_support');
    Integer cnt = [SELECT COUNT() FROM AI_Intent_Action__c
                   WHERE AI_Agent_Intent__c = :i.Id AND Action_Type__c = 'Flow'];
    if (cnt == 0) {
        insert new AI_Intent_Action__c(
            AI_Agent_Intent__c = i.Id,
            Action_Type__c = 'Flow',
            Sequence__c = 2,
            Is_Active__c = true,
            Flow_API_Name__c = 'IT_Helpdesk_Escalation_Flow',
            Description__c = 'Trigger escalation orchestration flow.'
        );
    }
}

// 3) Apex action on user_frustrated_reassure
if (intentByName.containsKey('user_frustrated_reassure')) {
    AI_Agent_Intent__c i = intentByName.get('user_frustrated_reassure');
    Integer cnt = [SELECT COUNT() FROM AI_Intent_Action__c
                   WHERE AI_Agent_Intent__c = :i.Id AND Action_Type__c = 'Apex'];
    if (cnt == 0) {
        insert new AI_Intent_Action__c(
            AI_Agent_Intent__c = i.Id,
            Action_Type__c = 'Apex',
            Sequence__c = 2,
            Is_Active__c = true,
            Apex_Class_Name__c = 'ITHelpdeskEscalationApex',
            Apex_Return_Type__c = 'Append to Message',
            Description__c = 'Append escalation acknowledgment metadata.'
        );
    }
}

System.debug('Added missing action types for IT Helpdesk Agent.');
