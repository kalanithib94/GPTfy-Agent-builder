/**
 * Sales Task Capture Agent — Intent / action skeleton (GPTfy Intent Action Framework).
 * Pipeline replaces targetAgentName with the deployed agent label.
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

// 1) sales_task_greeting
{
    SObject i = makeIntent('sales_task_greeting');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 2) create_task_quick — Create Task + Canned
{
    SObject i = makeIntent('create_task_quick');
    if (i != null) {
        insert i;
        SObject aTask = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aTask, aCanned };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject', 'AI Extracted'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'ActivityDate', 'AI Extracted'),
            makeDetail(aTask.Id, 'Priority', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status', 'Hardcoded'),
            makeDetail(aTask.Id, 'WhoId', 'AI Extracted'),
            makeDetail(aTask.Id, 'WhatId', 'AI Extracted')
        };
    }
}

// 3) find_account_lookup — Canned (agentic skill does search)
{
    SObject i = makeIntent('find_account_lookup');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

// 4) sales_task_off_topic
{
    SObject i = makeIntent('sales_task_off_topic');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
    }
}

System.debug('DONE: Sales Task Capture Agent intent/action skeleton complete.');
