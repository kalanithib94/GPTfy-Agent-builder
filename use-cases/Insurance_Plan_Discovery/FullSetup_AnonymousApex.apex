// =============================================================================
// FULL SETUP — Insurance Plan Discovery Agent
// Sections: Seed Plans → Create Agent → Create Intents → Create Actions
//
// Object notes:
//   Insurance_Plan__c is deployed in the ccai_qa namespace org.
//   Active custom fields (confirmed via schema): 
//     ccai_qa__Plan_Type__c, ccai_qa__Monthly_Premium__c, ccai_qa__Max_Coverage__c
//   Namespace for GPTfy objects: ccai_qa__
// =============================================================================

String ns = 'ccai_qa__';
List<String> log = new List<String>();
Integer errors = 0;

// =============================================================================
// SECTION 1 — Seed Insurance_Plan__c records (8 sample plans)
// =============================================================================
log.add('=== SECTION 1: Seeding Insurance Plans ===');
Integer existingPlans = Database.countQuery('SELECT COUNT() FROM ' + ns + 'Insurance_Plan__c');

if (existingPlans > 0) {
    log.add('INFO: ' + existingPlans + ' plan(s) already exist — skipping seed.');
} else {
    List<SObject> plans = new List<SObject>();

    // Plan data: Name | Plan_Type__c | Monthly_Premium__c | Max_Coverage__c
    List<List<Object>> planData = new List<List<Object>>{
        new List<Object>{ 'Silver Shield - Individual Basic (£150/mo, £250K cover, no pre-existing)',          'Individual', 149.99,  250000.00  },
        new List<Object>{ 'Gold Care - Individual + Pre-Existing after 3yr (£250/mo, £500K cover)',            'Individual', 249.99,  500000.00  },
        new List<Object>{ 'Platinum Plus - Individual Zero Deductible + Pre-Existing yr2 (£400/mo, £1M)',      'Individual', 399.99,  1000000.00 },
        new List<Object>{ 'Family Shield - Family Floater up to 5 members (£300/mo, £500K)',                   'Family',     299.99,  500000.00  },
        new List<Object>{ 'Family Gold Floater - 6 members + Pre-Existing yr3 (£450/mo, £1M)',                 'Family',     449.99,  1000000.00 },
        new List<Object>{ 'Family Plus Extended - 8 members incl parents + Pre-Existing yr2 (£600/mo, £2M)',   'Family',     599.99,  2000000.00 },
        new List<Object>{ 'Senior Care - Ages 60-85 + Pre-Existing yr2 via TPA (£350/mo, £500K)',              'Senior',     349.99,  500000.00  },
        new List<Object>{ 'Senior Platinum - Ages 60-90 + Pre-Existing yr1 Zero Deductible (£550/mo, £1M)',    'Senior',     549.99,  1000000.00 }
    };

    for (List<Object> row : planData) {
        SObject p = (SObject) Type.forName(ns + 'Insurance_Plan__c').newInstance();
        p.put('Name',                         (String)  row[0]);
        p.put(ns + 'Plan_Type__c',            (String)  row[1]);
        p.put(ns + 'Monthly_Premium__c',      (Decimal) row[2]);
        p.put(ns + 'Max_Coverage__c',         (Decimal) row[3]);
        plans.add(p);
    }

    try {
        insert plans;
        log.add('OK Inserted ' + plans.size() + ' Insurance_Plan__c records.');
        for (SObject p : plans) {
            log.add('  -> Id:' + p.Id + ' | ' + p.get('Name'));
        }
    } catch (Exception e) {
        log.add('FAIL inserting plans: ' + e.getMessage());
        errors++;
    }
}

// =============================================================================
// SECTION 2 — Create AI Agent record
// =============================================================================
log.add('');
log.add('=== SECTION 2: Creating AI Agent ===');

String agentName = 'Insurance Plan Discovery Agent';
Id agentId;

List<SObject> existingAgents = Database.query(
    'SELECT Id, Name FROM ' + ns + 'AI_Agent__c WHERE Name = \'' + agentName + '\' LIMIT 1'
);

if (!existingAgents.isEmpty()) {
    agentId = existingAgents[0].Id;
    log.add('INFO: Agent already exists Id:' + agentId);
} else {
    SObject agent = (SObject) Type.forName(ns + 'AI_Agent__c').newInstance();
    agent.put('Name', agentName);
    try {
        insert agent;
        agentId = agent.Id;
        log.add('OK Created Agent: ' + agentName + ' Id:' + agentId);
    } catch (Exception e) {
        log.add('FAIL creating agent: ' + e.getMessage());
        errors++;
    }
}

// =============================================================================
// SECTION 3 — Create AI_Agent_Intent__c records
// =============================================================================
log.add('');
log.add('=== SECTION 3: Creating Intents ===');

Map<String, Id> intentIds = new Map<String, Id>();

if (agentId != null) {
    List<SObject> existingIntents = Database.query(
        'SELECT Id, Name FROM ' + ns + 'AI_Agent_Intent__c WHERE ' + ns + 'AI_Agent__c = \'' + agentId + '\''
    );
    for (SObject s : existingIntents) {
        intentIds.put((String) s.get('Name'), s.Id);
    }

    List<String> intentNames = new List<String>{
        'ipd_greeting',
        'pre_existing_condition_inquiry',
        'family_coverage_inquiry',
        'budget_concern',
        'purchase_intent_signal',
        'plan_not_found_frustration',
        'competitor_mention',
        'ipd_out_of_scope'
    };

    List<SObject> newIntents = new List<SObject>();
    List<String>  newNames   = new List<String>();

    for (String iName : intentNames) {
        if (!intentIds.containsKey(iName)) {
            SObject intent = (SObject) Type.forName(ns + 'AI_Agent_Intent__c').newInstance();
            intent.put('Name', iName);
            intent.put(ns + 'AI_Agent__c', agentId);
            newIntents.add(intent);
            newNames.add(iName);
        } else {
            log.add('INFO: Intent exists: ' + iName);
        }
    }

    if (!newIntents.isEmpty()) {
        try {
            insert newIntents;
            for (Integer i = 0; i < newIntents.size(); i++) {
                intentIds.put(newNames[i], newIntents[i].Id);
                log.add('OK Intent: ' + newNames[i] + ' Id:' + newIntents[i].Id);
            }
        } catch (Exception e) {
            log.add('FAIL inserting intents: ' + e.getMessage());
            errors++;
        }
    }
}

// =============================================================================
// SECTION 4 — Create AI_Intent_Action__c records
// =============================================================================
log.add('');
log.add('=== SECTION 4: Creating Actions ===');

Map<String, Integer> actionsPerIntent = new Map<String, Integer>{
    'ipd_greeting'                   => 2,
    'pre_existing_condition_inquiry' => 2,
    'family_coverage_inquiry'        => 1,
    'budget_concern'                 => 1,
    'purchase_intent_signal'         => 2,
    'plan_not_found_frustration'     => 2,
    'competitor_mention'             => 2,
    'ipd_out_of_scope'               => 1
};

Map<String, List<String>> actionConfig = new Map<String, List<String>>{
    'ipd_greeting' => new List<String>{
        'Type:Canned Response|Lang:English|Text:Hello! Welcome to Insurance Plan Discovery. I can show available plans, compare them side by side, and recommend the best plan based on your profile. What would you like to explore today?',
        'Type:Canned Response|Lang:Spanish|Text:Hola! Bienvenido al asistente de seguros. Puedo mostrar planes, comparar opciones y recomendar el mejor plan segun tu perfil.'
    },
    'pre_existing_condition_inquiry' => new List<String>{
        'Type:Create Record|Object:Lead|Fields:LastName=AI Extracted,Company=Self-Individual,LeadSource=Chat,Status=New,Description=AI Extracted (condition and plan interest)',
        'Type:Canned Response|Lang:English|Text:Yes, we have plans covering pre-existing conditions with a 2-4 year waiting period. Shall I show all plans that include pre-existing coverage now?'
    },
    'family_coverage_inquiry' => new List<String>{
        'Type:Canned Response|Lang:English|Text:Family floater plans are very popular! Tell me: (1) How many people to cover? (2) Age of eldest member? (3) Monthly budget? I will give personalised recommendations right away.'
    },
    'budget_concern' => new List<String>{
        'Type:Canned Response|Lang:English|Text:I understand — good coverage at the right price matters. Tell me your maximum monthly premium and I will search within that range for the best match.'
    },
    'purchase_intent_signal' => new List<String>{
        'Type:Create Record|Object:Lead|Fields:LastName=AI Extracted,Company=Self-Individual,LeadSource=Chat,Status=Hot,Description=AI Extracted (plan interest and profile)',
        'Type:Canned Response|Lang:English|Text:Excellent! I have captured your interest and a specialist will be in touch within 1 business day to guide you through the application.'
    },
    'plan_not_found_frustration' => new List<String>{
        'Type:Create Record|Object:Lead|Fields:LastName=AI Extracted,Company=Self-Individual,LeadSource=Chat,Status=New,Description=AI Extracted (unmet need details)',
        'Type:Canned Response|Lang:English|Text:I am sorry we do not have a perfect match right now. I have flagged your requirements for an advisor callback. Would you like me to adjust one filter at a time for a fresh search?'
    },
    'competitor_mention' => new List<String>{
        'Type:Update Field|Object:Lead|Field:Description|Type:AI Extracted|Note:Append COMPETITIVE INTEL: followed by competitor name and what user said',
        'Type:Canned Response|Lang:English|Text:It is great that you are comparing options. While I cannot comment on other providers, I can show you what makes our plans stand out. Want me to find a plan that matches your needs?'
    },
    'ipd_out_of_scope' => new List<String>{
        'Type:Canned Response|Lang:English|Text:I specialise in helping you explore and choose new health insurance plans. For existing policy, renewals, claims, or account queries please contact our support team directly.'
    }
};

for (String intentName : intentIds.keySet()) {
    Id iId = intentIds.get(intentName);
    Integer needed = actionsPerIntent.get(intentName);
    if (needed == null) continue;

    Integer existCount = Database.countQuery(
        'SELECT COUNT() FROM ' + ns + 'AI_Intent_Action__c WHERE ' + ns + 'AI_Agent_Intent__c = \'' + iId + '\''
    );

    if (existCount > 0) {
        log.add('INFO: Actions exist for ' + intentName + ' (' + existCount + ') — skipping.');
        continue;
    }

    List<SObject> actionsToInsert = new List<SObject>();
    for (Integer i = 0; i < needed; i++) {
        SObject action = (SObject) Type.forName(ns + 'AI_Intent_Action__c').newInstance();
        action.put(ns + 'AI_Agent_Intent__c', iId);
        actionsToInsert.add(action);
    }

    try {
        insert actionsToInsert;
        List<String> configs = actionConfig.get(intentName);
        for (Integer i = 0; i < actionsToInsert.size(); i++) {
            String cfg = (configs != null && i < configs.size()) ? configs[i] : 'See INTENTS_CONFIG.md';
            log.add('OK Action[' + intentName + '] #' + (i+1) + ' Id:' + actionsToInsert[i].Id + ' | ' + cfg);
        }
    } catch (Exception e) {
        log.add('FAIL actions for ' + intentName + ': ' + e.getMessage());
        errors++;
    }
}

// =============================================================================
// SECTION 5 — Summary
// =============================================================================
log.add('');
log.add('=== SUMMARY ===');
log.add('Agent: ' + agentName + ' (' + agentId + ')');
log.add('Intents configured: ' + intentIds.size());
log.add('Total errors: ' + errors);
log.add('');
log.add('NEXT STEPS in GPTfy UI:');
log.add('1. Open agent -> Intents -> set Description, Sequence, Is Active on each');
log.add('2. Open each Action -> set Action Type + full config (see INTENTS_CONFIG.md)');
log.add('3. Register 3 AI Prompts: find_Insurance_Plan, compare_Insurance_Plans, recommend_Insurance_Plan');
log.add('   All pointing to handler class: InsurancePlanDiscoveryHandler');

for (String line : log) { System.debug(line); }
