/**
 * INTENT ACTION FRAMEWORK — Bulk Insert Script (Anonymous Apex)
 * VERIFIED AGAINST LIVE ORG SCHEMA (sgptQa, ccai_qa namespace, Mar 2026)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS SCRIPT CREATES:
 *   Level 1 — AI_Agent_Intent__c     : Intent keyword + Agent link
 *   Level 2 — AI_Intent_Action__c    : Action container (auto-numbered name)
 *   Level 3 — AI_Intent_Action_Detail__c : Field name + Type (AI Extracted/Hardcoded)
 *
 * WHAT THIS SCRIPT CANNOT SET (fields don't exist in the current package):
 *   - Intent: Description, Sequence, Is Active
 *   - Action: Action Type, Description, Language, Canned Response text,
 *             Object Name, Flow API Name, Apex Class Name, Return Type,
 *             Sequence, Is Active
 *   - Detail: Hardcoded Value, AI Extraction instruction/description
 *
 * AFTER RUNNING THIS SCRIPT:
 *   Open each created Intent in the GPTfy UI and complete the Action Type
 *   and all configuration fields manually.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NAMESPACE:
 *   Auto-detected at runtime. Works in both:
 *   - Dev/QA package org  → ccai_qa__ prefix
 *   - Managed package org → ccai__ prefix
 *
 * IDEMPOTENT: Existing intents with the same Name on the same Agent are skipped.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 0: NAMESPACE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

String ns = '';
Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();

if      (gd.containsKey('ccai_qa__AI_Agent_Intent__c')) { ns = 'ccai_qa__'; }
else if (gd.containsKey('ccai__AI_Agent_Intent__c'))    { ns = 'ccai__'; }
else {
    System.debug('❌ FATAL: AI_Agent_Intent__c not found. Is the GPTfy package installed?');
    return;
}
System.debug('✅ Namespace: [' + ns + ']');

Schema.SObjectType intentType = gd.get(ns + 'AI_Agent_Intent__c');
Schema.SObjectType actionType = gd.get(ns + 'AI_Intent_Action__c');
Schema.SObjectType detailType = gd.get(ns + 'AI_Intent_Action_Detail__c');

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: LOAD AGENT IDs
// ═══════════════════════════════════════════════════════════════════════════
// ⚙ UPDATE these names to match your org's AI Agent record Names exactly.
// Run SchemaDiscovery_RunFirst.apex to see all available agents and their IDs.

Set<String> targetAgentNames = new Set<String>{
    'Salesforce CRM Agent',
    'Update Opportunity Stage CloseDate',
    'CPQ Agent',
    'Document Intelligence Agent',
    'Find Opportunity by Probability',
    'Update Case Status',
    'SP Energy Bot'          // ⚙ Update to match the exact Agent Name in your org
};

Map<String, Id> agentIdMap = new Map<String, Id>();
for (SObject a : Database.query(
    'SELECT Id, Name FROM ' + ns + 'AI_Agent__c WHERE Name IN :targetAgentNames')) {
    agentIdMap.put((String)a.get('Name'), a.Id);
    System.debug('✅ Agent found: [' + a.get('Name') + '] → ' + a.Id);
}
for (String n : targetAgentNames) {
    if (!agentIdMap.containsKey(n)) {
        System.debug('⚠ Agent NOT found (intents skipped): [' + n + ']');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: DUPLICATE CHECK
// ═══════════════════════════════════════════════════════════════════════════

Set<Id> agentIds = new Set<Id>(agentIdMap.values());
Set<String> existingKeys = new Set<String>(); // agentId|intentName
for (SObject ex : Database.query(
    'SELECT Id, Name, ' + ns + 'AI_Agent__c FROM ' + ns + 'AI_Agent_Intent__c '
    + 'WHERE ' + ns + 'AI_Agent__c IN :agentIds')) {
    existingKeys.add((String)ex.get(ns + 'AI_Agent__c') + '|' + (String)ex.get('Name'));
}
System.debug('Existing intents in org (will skip): ' + existingKeys.size());

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: HELPERS
// Confirmed field structure (verified Mar 2026):
//   AI_Agent_Intent__c    → Name + ns+AI_Agent__c
//   AI_Intent_Action__c   → Name (auto) + ns+AI_Agent_Intent__c
//   AI_Intent_Action_Detail__c → Name (auto) + ns+AI_Intent_Action__c
//                              + ns+Field_API_Name__c + ns+Type__c
// ═══════════════════════════════════════════════════════════════════════════

SObject makeIntent(Id agentId, String intentName) {
    if (agentId == null) return null;
    if (existingKeys.contains(agentId + '|' + intentName)) {
        System.debug('⏭ Skipping duplicate: ' + intentName);
        return null;
    }
    SObject obj = intentType.newSObject();
    obj.put('Name', intentName);
    obj.put(ns + 'AI_Agent__c', agentId);
    return obj;
}

// Returns one Action container record linked to an Intent.
// NOTE: Action Type and all configuration must be set via the GPTfy UI after insert.
SObject makeAction(Id intentId) {
    SObject obj = actionType.newSObject();
    obj.put(ns + 'AI_Agent_Intent__c', intentId);
    return obj;
}

// Returns one Detail record for Update Field / Create Record field mapping.
// NOTE: The actual value (for Hardcoded) or AI instruction (for AI Extracted)
//       must be set via the GPTfy UI — the Value field does not exist yet.
SObject makeDetail(Id actionId, String fieldApiName, String type) {
    SObject obj = detailType.newSObject();
    obj.put(ns + 'AI_Intent_Action__c', actionId);
    obj.put(ns + 'Field_API_Name__c', fieldApiName);
    obj.put(ns + 'Type__c', type); // 'AI Extracted' or 'Hardcoded'
    return obj;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: AGENT 1 — Salesforce CRM Agent
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('Salesforce CRM Agent');

    // Intent: crm_greeting
    SObject i = makeIntent(agentId, 'crm_greeting');
    if (i != null) {
        insert i;
        // 1 action: Canned Response (EN + ES configured via UI)
        SObject a1 = makeAction(i.Id);
        SObject a2 = makeAction(i.Id);
        insert new List<SObject>{ a1, a2 };
        System.debug('✅ crm_greeting → 2 action containers created. Set Action Type=Canned Response in UI. Set Language=English on a1, Spanish on a2.');
    }

    // Intent: account_at_risk
    i = makeIntent(agentId, 'account_at_risk');
    if (i != null) {
        insert i;
        SObject aUpdate = makeAction(i.Id); // Update Field → Account.Description
        SObject aTask   = makeAction(i.Id); // Create Record → Task
        SObject aCanned = makeAction(i.Id); // Canned Response
        insert new List<SObject>{ aUpdate, aTask, aCanned };
        // Detail rows for Update Field action
        insert new List<SObject>{
            makeDetail(aUpdate.Id, 'Description', 'AI Extracted')
        };
        // Detail rows for Create Task action
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',      'Hardcoded'),
            makeDetail(aTask.Id, 'Description',  'AI Extracted'),
            makeDetail(aTask.Id, 'Priority',     'Hardcoded'),
            makeDetail(aTask.Id, 'Status',       'Hardcoded')
        };
        System.debug('✅ account_at_risk → 3 actions + 5 details. Configure Action Types and values in UI.');
    }

    // Intent: user_frustrated_urgent
    i = makeIntent(agentId, 'user_frustrated_urgent');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Create Record → Case
        SObject aCanned = makeAction(i.Id); // Canned Response
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'AccountId',   'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted')
        };
        System.debug('✅ user_frustrated_urgent → 2 actions + 5 details. Configure in UI.');
    }

    // Intent: crm_out_of_scope
    i = makeIntent(agentId, 'crm_out_of_scope');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ crm_out_of_scope → 1 action (Canned Response). Configure text in UI.');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: AGENT 2 — Update Opportunity Stage CloseDate
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('Update Opportunity Stage CloseDate');

    SObject i = makeIntent(agentId, 'deal_closed_won');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask   = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ deal_closed_won → 2 actions + 4 details');
    }

    i = makeIntent(agentId, 'deal_closed_lost');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask   = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ deal_closed_lost → 2 actions + 4 details');
    }

    i = makeIntent(agentId, 'deal_stalled');
    if (i != null) {
        insert i;
        SObject aUpdate = makeAction(i.Id); // Update Field → Opportunity.Description
        SObject aTask   = makeAction(i.Id); // Create Record → Task
        SObject aCanned = makeAction(i.Id); // Canned Response
        insert new List<SObject>{ aUpdate, aTask, aCanned };
        insert new List<SObject>{
            makeDetail(aUpdate.Id, 'Description', 'AI Extracted')
        };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ deal_stalled → 3 actions + 5 details');
    }

    i = makeIntent(agentId, 'stages_clarification');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ stages_clarification → 1 action (Canned Response)');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: AGENT 3 — CPQ Agent
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('CPQ Agent');

    for (String name : new List<String>{ 'cpq_greeting', 'cpq_out_of_scope', 'quote_expired_or_expiring' }) {
        SObject i = makeIntent(agentId, name);
        if (i != null) {
            insert i;
            insert new List<SObject>{ makeAction(i.Id) };
            System.debug('✅ ' + name + ' → 1 action (Canned Response)');
        }
    }

    SObject i = makeIntent(agentId, 'discount_requested');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask   = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ discount_requested → 2 actions + 4 details');
    }

    i = makeIntent(agentId, 'quote_approval_needed');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask   = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'AI Extracted'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ quote_approval_needed → 2 actions + 4 details');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: AGENT 4 — Document Intelligence Agent
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('Document Intelligence Agent');

    for (String name : new List<String>{ 'doc_greeting', 'upload_or_edit_request', 'search_tips' }) {
        SObject i = makeIntent(agentId, name);
        if (i != null) {
            insert i;
            insert new List<SObject>{ makeAction(i.Id) };
            System.debug('✅ ' + name + ' → 1 action (Canned Response)');
        }
    }

    SObject i = makeIntent(agentId, 'document_not_found');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aCase   = makeAction(i.Id); // Create Record → Case
        insert new List<SObject>{ aCanned, aCase };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'Hardcoded'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ document_not_found → 2 actions + 4 details');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: AGENT 5 — Find Opportunity by Probability
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('Find Opportunity by Probability');

    for (String name : new List<String>{ 'pipeline_forecast_overview', 'pipeline_hygiene_check', 'probability_explanation' }) {
        SObject i = makeIntent(agentId, name);
        if (i != null) {
            insert i;
            insert new List<SObject>{ makeAction(i.Id) };
            System.debug('✅ ' + name + ' → 1 action (Canned Response)');
        }
    }

    SObject i = makeIntent(agentId, 'must_win_deal_flag');
    if (i != null) {
        insert i;
        SObject aUpdate = makeAction(i.Id); // Update Field → Opportunity.Description
        SObject aTask   = makeAction(i.Id); // Create Record → Task
        SObject aCanned = makeAction(i.Id); // Canned Response
        insert new List<SObject>{ aUpdate, aTask, aCanned };
        insert new List<SObject>{
            makeDetail(aUpdate.Id, 'Description', 'AI Extracted')
        };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ must_win_deal_flag → 3 actions + 5 details');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: AGENT 6 — Update Case Status
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('Update Case Status');

    for (String name : new List<String>{
        'case_resolved_ready_to_close', 'case_on_hold_waiting',
        'no_case_id_provided', 'case_status_options' }) {
        SObject i = makeIntent(agentId, name);
        if (i != null) {
            insert i;
            insert new List<SObject>{ makeAction(i.Id) };
            System.debug('✅ ' + name + ' → 1 action (Canned Response)');
        }
    }

    SObject i = makeIntent(agentId, 'case_urgent_critical');
    if (i != null) {
        insert i;
        SObject aCanned = makeAction(i.Id);
        SObject aTask   = makeAction(i.Id);
        insert new List<SObject>{ aCanned, aTask };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ case_urgent_critical → 2 actions + 4 details');
    }

    i = makeIntent(agentId, 'customer_at_risk_of_churning');
    if (i != null) {
        insert i;
        SObject aTask   = makeAction(i.Id); // Create Record → Task (FIRST — high urgency)
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aTask, aCanned };
        insert new List<SObject>{
            makeDetail(aTask.Id, 'Subject',     'Hardcoded'),
            makeDetail(aTask.Id, 'Description', 'AI Extracted'),
            makeDetail(aTask.Id, 'Status',      'Hardcoded'),
            makeDetail(aTask.Id, 'Priority',    'Hardcoded')
        };
        System.debug('✅ customer_at_risk_of_churning → 2 actions + 4 details');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: AGENT 7 — SP Energy Bot (Crisis & Emergency Support)
//
// Intents use hashtag naming: #IntentName# — matches AI "intents": [] tokens
// ⚙ Update 'SP Energy Bot' above to match your org's exact Agent Name.
//
// ALL 5 ACTION TYPES ARE USED:
//   Canned Response  → all 21 intents
//   Create Record    → 14 crisis intents (Case object)
//   Update Field     → #File a Complaint#, #Presidential#, #Mental Health#
//   Flow             → #Emergency#, #Missing Ambulance#, #Mental Health#
//   Apex             → #Assault#, #Agent#, #Presidential#
//
// NOTE: Action Type, canned text, Flow/Apex names, field values, sequence,
//       and Is Active are set via GPTfy UI after this script runs.
//       This script creates the structural containers only.
// ═══════════════════════════════════════════════════════════════════════════
{
    Id agentId = agentIdMap.get('SP Energy Bot');

    // ── #Arrest# — 2 actions: Create Record (Case) + Canned Response
    SObject i = makeIntent(agentId, '#Arrest#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Arrest# → 2 actions + 4 details');
    }

    // ── #Assault# — 3 actions: Create Record + Apex (HighRiskNotifier) + Canned Response
    i = makeIntent(agentId, '#Assault#');
    if (i != null) {
        insert i;
        SObject aCase  = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aApex  = makeAction(i.Id); // Action Type: Apex → SPEnergyHighRiskNotifier (Append)
        SObject aCnnd  = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aApex, aCnnd };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Assault# → 3 actions + 4 details');
        System.debug('   ⚙ aApex: set Action Type=Apex, Class=SPEnergyHighRiskNotifier, Return=Append');
    }

    // ── #Legal# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Legal#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Legal# → 2 actions + 4 details');
    }

    // ── #Car Accident# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Car Accident#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Car Accident# → 2 actions + 4 details');
    }

    // ── #Emergency# — 3 actions: Create Record + Flow (Escalation) + Canned Response
    i = makeIntent(agentId, '#Emergency#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aFlow   = makeAction(i.Id); // Action Type: Flow → SP_Emergency_Escalation_Flow
        SObject aCanned = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aFlow, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Emergency# → 3 actions + 4 details');
        System.debug('   ⚙ aFlow: set Action Type=Flow, Flow API Name=SP_Emergency_Escalation_Flow');
    }

    // ── #Hospital# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Hospital#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Hospital# → 2 actions + 4 details');
    }

    // ── #Lost Document# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Lost Document#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Lost Document# → 2 actions + 4 details');
    }

    // ── #Missing Ambulance# — 3 actions: Create Record + Flow (UrgentDispatch) + Canned Response
    i = makeIntent(agentId, '#Missing Ambulance#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aFlow   = makeAction(i.Id); // Action Type: Flow → SP_Urgent_Dispatch_Flow
        SObject aCanned = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aFlow, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'Hardcoded'),  // Value: "URGENT: Ambulance / Emergency Services Not Arrived"
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Missing Ambulance# → 3 actions + 4 details');
        System.debug('   ⚙ aCase Subject: Hardcoded → "URGENT: Ambulance / Emergency Services Not Arrived"');
        System.debug('   ⚙ aFlow: set Action Type=Flow, Flow API Name=SP_Urgent_Dispatch_Flow');
    }

    // ── #Police# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Police#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Police# → 2 actions + 4 details');
    }

    // ── #Visa Rejection# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Visa Rejection#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Visa Rejection# → 2 actions + 4 details');
    }

    // ── #Password# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Password#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Password# → 1 action (Canned Response)');
    }

    // ── #Gibberish# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Gibberish#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Gibberish# → 1 action (Canned Response)');
    }

    // ── #Agent# — 1 action: Apex (LiveAgentTransfer, Replace Message)
    i = makeIntent(agentId, '#Agent#');
    if (i != null) {
        insert i;
        SObject aApex = makeAction(i.Id); // Action Type: Apex → SPEnergyLiveAgentTransfer (Replace)
        insert new List<SObject>{ aApex };
        System.debug('✅ #Agent# → 1 action (Apex)');
        System.debug('   ⚙ Set Action Type=Apex, Class=SPEnergyLiveAgentTransfer, Return=Replace Message');
    }

    // ── #Help# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Help#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Help# → 1 action (Canned Response)');
    }

    // ── #Timeout# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Timeout#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Timeout# → 1 action (Canned Response)');
    }

    // ── #Stuck at Emergency# — 2 actions: Create Record + Canned Response
    i = makeIntent(agentId, '#Stuck at Emergency#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id);
        SObject aCanned = makeAction(i.Id);
        insert new List<SObject>{ aCase, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        System.debug('✅ #Stuck at Emergency# → 2 actions + 4 details');
    }

    // ── #File a Complaint# — 3 actions: Create Record + Update Field (Account) + Canned Response
    i = makeIntent(agentId, '#File a Complaint#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aUpd    = makeAction(i.Id); // Action Type: Update Field → Account.Description
        SObject aCanned = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aUpd, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        insert new List<SObject>{
            makeDetail(aUpd.Id,  'Description', 'AI Extracted') // Account.Description — prepend "COMPLAINT FILED:"
        };
        System.debug('✅ #File a Complaint# → 3 actions + 5 details');
        System.debug('   ⚙ aUpd: set Action Type=Update Field, Object=Account');
        System.debug('   ⚙ Detail AI Desc: "Prepend COMPLAINT FILED: to account description with complaint summary"');
    }

    // ── #Presidential# — 4 actions: Create Record + Update Field + Apex (ExecNotifier) + Canned Response
    i = makeIntent(agentId, '#Presidential#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aUpd    = makeAction(i.Id); // Action Type: Update Field → Account.Description
        SObject aApex   = makeAction(i.Id); // Action Type: Apex → SPEnergyExecutiveNotifier (Append)
        SObject aCanned = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aUpd, aApex, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'AI Extracted'),
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        insert new List<SObject>{
            makeDetail(aUpd.Id,  'Description', 'AI Extracted') // Account.Description — prepend "PRESIDENTIAL COMPLAINT:"
        };
        System.debug('✅ #Presidential# → 4 actions + 5 details');
        System.debug('   ⚙ aUpd: Action Type=Update Field, Object=Account');
        System.debug('   ⚙ aApex: Action Type=Apex, Class=SPEnergyExecutiveNotifier, Return=Append');
    }

    // ── #Can't Reach# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Can\'t Reach#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Can\'t Reach# → 1 action (Canned Response)');
    }

    // ── #Thank You# — 1 action: Canned Response only
    i = makeIntent(agentId, '#Thank You#');
    if (i != null) {
        insert i;
        insert new List<SObject>{ makeAction(i.Id) };
        System.debug('✅ #Thank You# → 1 action (Canned Response)');
    }

    // ── #Mental Health# — 4 actions: Create Record + Update Field + Flow (WelfareCheck) + Canned Response
    i = makeIntent(agentId, '#Mental Health#');
    if (i != null) {
        insert i;
        SObject aCase   = makeAction(i.Id); // Action Type: Create Record → Case
        SObject aUpd    = makeAction(i.Id); // Action Type: Update Field → Account.Description
        SObject aFlow   = makeAction(i.Id); // Action Type: Flow → SP_Welfare_Check_Flow
        SObject aCanned = makeAction(i.Id); // Action Type: Canned Response
        insert new List<SObject>{ aCase, aUpd, aFlow, aCanned };
        insert new List<SObject>{
            makeDetail(aCase.Id, 'Subject',     'Hardcoded'),   // "Mental Health Support Required — Immediate Follow-up Needed"
            makeDetail(aCase.Id, 'Description', 'AI Extracted'),
            makeDetail(aCase.Id, 'Priority',    'Hardcoded'),
            makeDetail(aCase.Id, 'Status',      'Hardcoded')
        };
        insert new List<SObject>{
            makeDetail(aUpd.Id,  'Description', 'Hardcoded')    // "WELFARE FLAG: Customer mental health concern. Follow-up required."
        };
        System.debug('✅ #Mental Health# → 4 actions + 5 details');
        System.debug('   ⚙ aCase Subject Hardcoded: "Mental Health Support Required — Immediate Follow-up Needed"');
        System.debug('   ⚙ aUpd: Action Type=Update Field, Object=Account');
        System.debug('   ⚙ aUpd Description Hardcoded: "WELFARE FLAG: Customer mental health concern. Handle with care."');
        System.debug('   ⚙ aFlow: Action Type=Flow, Flow API Name=SP_Welfare_Check_Flow');
    }

    System.debug('');
    System.debug('SP Energy Bot — DONE (all 5 action types used)');
    System.debug('  Canned Response → 21 intents');
    System.debug('  Create Record   → 14 intents (Case)');
    System.debug('  Update Field    → 3 intents (#File a Complaint#, #Presidential#, #Mental Health#)');
    System.debug('  Flow            → 3 intents (#Emergency#, #Missing Ambulance#, #Mental Health#)');
    System.debug('  Apex            → 3 intents (#Assault#, #Agent#, #Presidential#)');
    System.debug('');
    System.debug('NEXT: In GPTfy UI, open each Intent and complete:');
    System.debug('  1. Set Description, Sequence, Is Active on each Intent');
    System.debug('  2. Set Action Type on each Action container');
    System.debug('  3. For Canned Response: Language=English + paste canned text from INTENTS_CONFIG.md');
    System.debug('  4. For Create Record: Object=Case + field values');
    System.debug('  5. For Update Field: Object=Account, field mapping values');
    System.debug('  6. For Flow: Flow API Name (must be active auto-launched Flow)');
    System.debug('  7. For Apex: Class Name + Return Type');
    System.debug('  See use-cases/SP_Energy_Bot/INTENTS_CONFIG.md for ALL exact values.');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
System.debug('');
System.debug('═══════════════════════════════════════════════════════════');
System.debug('✅ BULK INSERT COMPLETE');
System.debug('   Namespace:          ' + ns);
System.debug('   Agents matched:     ' + agentIdMap.size() + '/' + targetAgentNames.size());
System.debug('   Intents skipped:    ' + existingKeys.size() + ' (duplicates)');
System.debug('');
System.debug('NEXT STEP: For each inserted Intent, open it in GPTfy UI and:');
System.debug('  1. Set Intent Description (trigger rule for AI)');
System.debug('  2. Set Intent Sequence and Is Active');
System.debug('  3. For each Action: set Action Type + all type-specific config');
System.debug('  4. For each Detail: set the Hardcoded Value or AI Description');
System.debug('');
System.debug('SP Energy Bot — see use-cases/SP_Energy_Bot/INTENTS_CONFIG.md');
System.debug('  for all 21 intent descriptions, canned response texts, and field values.');
System.debug('═══════════════════════════════════════════════════════════');
