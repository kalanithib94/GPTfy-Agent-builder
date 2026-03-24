/**
 * IT Helpdesk Agent — Intent Action Framework bootstrap script
 *
 * Creates structural records only:
 *   Level 1: AI_Agent_Intent__c
 *   Level 2: AI_Intent_Action__c
 *   Level 3: AI_Intent_Action_Detail__c (for Create/Update mappings)
 *
 * After execution, complete Action Type, Language, canned text,
 * object config, and value/instruction fields in GPTfy UI.
 */

String ns = '';
String suffix = '';
Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();

if (gd.containsKey('ccai_qa__AI_Agent_Intent__c')) {
    ns = 'ccai_qa__';
    suffix = '__c';
} else if (gd.containsKey('ccai__AI_Agent_Intent__c')) {
    ns = 'ccai__';
    suffix = '__c';
} else if (gd.containsKey('AI_Agent_Intent__c')) {
    ns = '';
    suffix = '__c';
} else {
    System.debug('FATAL: AI_Agent_Intent__c not found. Is GPTfy package installed?');
    return;
}

Schema.SObjectType intentType = gd.get(ns + 'AI_Agent_Intent' + suffix);
Schema.SObjectType actionType = gd.get(ns + 'AI_Intent_Action' + suffix);
Schema.SObjectType detailType = gd.get(ns + 'AI_Intent_Action_Detail' + suffix);

String targetAgentName = 'IT Helpdesk Agent';
Id agentId;

for (SObject a : Database.query(
    'SELECT Id, Name FROM ' + ns + 'AI_Agent' + suffix + ' WHERE Name = :targetAgentName ORDER BY LastModifiedDate DESC LIMIT 1'
)) {
    agentId = a.Id;
}

if (agentId == null) {
    System.debug('FATAL: Agent not found: ' + targetAgentName);
    return;
}

Set<String> existingIntentNames = new Set<String>();
for (SObject ex : Database.query(
    'SELECT Name FROM ' + ns + 'AI_Agent_Intent' + suffix + ' WHERE ' + ns + 'AI_Agent' + suffix + ' = :agentId'
)) {
    existingIntentNames.add((String) ex.get('Name'));
}

SObject makeIntent(String intentName) {
    if (existingIntentNames.contains(intentName)) {
        System.debug('Skipping duplicate intent: ' + intentName);
        return null;
    }
    SObject obj = intentType.newSObject();
    obj.put('Name', intentName);
    obj.put(ns + 'AI_Agent' + suffix, agentId);
    return obj;
}

SObject makeAction(Id intentId) {
    SObject obj = actionType.newSObject();
    obj.put(ns + 'AI_Agent_Intent' + suffix, intentId);
    return obj;
}

SObject makeDetail(Id actionId, String fieldApiName, String type) {
    SObject obj = detailType.newSObject();
    obj.put(ns + 'AI_Intent_Action' + suffix, actionId);
    obj.put(ns + 'Field_API_Name' + suffix, fieldApiName);
    obj.put(ns + 'Type' + suffix, type);
    return obj;
}

// 1) helpdesk_greeting: 1 action (Canned Response)
{
    SObject i = makeIntent('helpdesk_greeting');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 2) create_case_for_contact: Create Case + Canned Response
{
    SObject i = makeIntent('create_case_for_contact');
    if (i != null) {
        insert i;
        SObject aCase = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject', 'AI Extracted'),
            makeDetail(aCase.Id, 'ContactId', 'AI Extracted'),
            makeDetail(aCase.Id, 'Status', 'Hardcoded'),
            makeDetail(aCase.Id, 'Priority', 'AI Extracted'),
            makeDetail(aCase.Id, 'Origin', 'Hardcoded'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted')
        };
    }
}

// 3) create_Contact_by_Name: Create Contact + Canned Response
{
    SObject i = makeIntent('create_Contact_by_Name');
    if (i != null) {
        insert i;
        SObject aContact = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aContact, aCanned };
        insert new List<SObject>{
            makeDetail(aContact.Id, 'FirstName', 'AI Extracted'),
            makeDetail(aContact.Id, 'LastName', 'AI Extracted'),
            makeDetail(aContact.Id, 'Email', 'AI Extracted'),
            makeDetail(aContact.Id, 'Phone', 'AI Extracted'),
            makeDetail(aContact.Id, 'Description', 'AI Extracted')
        };
    }
}

// 4) password_reset_help: 1 action (Canned Response)
{
    SObject i = makeIntent('password_reset_help');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 5) software_installation_issue: Canned Response + Create Task
{
    SObject i = makeIntent('software_installation_issue');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject', 'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status', 'Hardcoded'),
            makeDetail(aTask.Id, 'Priority', 'Hardcoded'),
            makeDetail(aTask.Id, 'ActivityDate', 'Hardcoded')
        };
    }
}

// 6) troubleshoot_connectivity_issue: 1 action (Canned Response)
{
    SObject i = makeIntent('troubleshoot_connectivity_issue');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 7) faq_software_access: 1 action (Canned Response)
{
    SObject i = makeIntent('faq_software_access');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 8) user_frustrated_reassure: 1 action (Canned Response)
{
    SObject i = makeIntent('user_frustrated_reassure');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 9) escalate_to_human_support: Create Case + Canned Response
{
    SObject i = makeIntent('escalate_to_human_support');
    if (i != null) {
        insert i;
        SObject aCase = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject', 'Hardcoded'),
            makeDetail(aCase.Id, 'Status', 'Hardcoded'),
            makeDetail(aCase.Id, 'Priority', 'Hardcoded'),
            makeDetail(aCase.Id, 'Origin', 'Hardcoded'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted')
        };
    }
}

// 10) helpdesk_out_of_scope: 1 action (Canned Response)
{
    SObject i = makeIntent('helpdesk_out_of_scope');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

System.debug('DONE: IT Helpdesk Agent intent/action skeleton deployment complete.');
