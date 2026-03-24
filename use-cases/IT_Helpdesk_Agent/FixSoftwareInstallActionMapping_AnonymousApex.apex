/**
 * Fix action-role alignment for software_installation_issue
 * so the action holding detail rows is the Create Record action.
 */

List<AI_Intent_Action__c> acts = [
    SELECT Id, Sequence__c, Action_Type__c, Language__c, Canned_Response__c, Object_Name__c, Is_Active__c
    FROM AI_Intent_Action__c
    WHERE AI_Agent_Intent__r.AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND AI_Agent_Intent__r.Name = 'software_installation_issue'
    ORDER BY CreatedDate
];

if (acts.size() == 2) {
    AI_Intent_Action__c a1 = acts[0];
    AI_Intent_Action__c a2 = acts[1];

    Integer d1 = [SELECT COUNT() FROM AI_Intent_Action_Detail__c WHERE AI_Intent_Action__c = :a1.Id];
    Integer d2 = [SELECT COUNT() FROM AI_Intent_Action_Detail__c WHERE AI_Intent_Action__c = :a2.Id];

    AI_Intent_Action__c createAction = d1 > 0 ? a1 : a2;
    AI_Intent_Action__c cannedAction = d1 > 0 ? a2 : a1;

    createAction.Action_Type__c = 'Create Record';
    createAction.Sequence__c = 1;
    createAction.Object_Name__c = 'Task';
    createAction.Is_Active__c = true;
    createAction.Language__c = null;
    createAction.Canned_Response__c = null;

    cannedAction.Action_Type__c = 'Canned Response';
    cannedAction.Sequence__c = 2;
    cannedAction.Object_Name__c = null;
    cannedAction.Is_Active__c = true;
    cannedAction.Language__c = 'en';
    cannedAction.Canned_Response__c = 'I can guide you through this. Please share: the software name and version, your operating system, the exact error message, and at which step installation fails. Meanwhile, try these quick checks: run installer as administrator, confirm enough disk space, close background installers, and reboot once before retrying.';

    update new List<AI_Intent_Action__c>{ createAction, cannedAction };

    List<AI_Intent_Action_Detail__c> dets = [
        SELECT Id, Field_API_Name__c, Sequence__c, Type__c, Value__c
        FROM AI_Intent_Action_Detail__c
        WHERE AI_Intent_Action__c = :createAction.Id
    ];
    Map<String, Integer> seqMap = new Map<String, Integer>{
        'Subject' => 1, 'Description' => 2, 'Status' => 3, 'Priority' => 4, 'ActivityDate' => 5
    };
    for (AI_Intent_Action_Detail__c d : dets) {
        if (seqMap.containsKey(d.Field_API_Name__c)) d.Sequence__c = seqMap.get(d.Field_API_Name__c);
        if (d.Field_API_Name__c == 'Subject') {
            d.Type__c = 'Hardcoded'; d.Value__c = 'Software Installation Support Follow-up';
        } else if (d.Field_API_Name__c == 'Description') {
            d.Type__c = 'AI Extracted'; d.Value__c = 'Capture software name, error details, and user environment from conversation.';
        } else if (d.Field_API_Name__c == 'Status') {
            d.Type__c = 'Hardcoded'; d.Value__c = 'Not Started';
        } else if (d.Field_API_Name__c == 'Priority') {
            d.Type__c = 'Hardcoded'; d.Value__c = 'Normal';
        } else if (d.Field_API_Name__c == 'ActivityDate') {
            d.Type__c = 'Hardcoded'; d.Value__c = 'TODAY';
        }
    }
    if (!dets.isEmpty()) update dets;
}

System.debug('software_installation_issue mapping fix applied');
