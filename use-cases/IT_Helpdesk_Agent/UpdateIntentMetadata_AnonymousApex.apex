/**
 * Populate IT Helpdesk intent metadata:
 * - Sequence__c
 * - Description__c
 * - Is_Active__c
 */

Map<String, Map<String, Object>> cfg = new Map<String, Map<String, Object>>{
    'helpdesk_greeting' => new Map<String, Object>{
        'seq' => 1,
        'desc' => 'Trigger when the user opens a conversation with a greeting or asks for general help — phrases like "hi", "hello", "hey", "can you help me", "I need IT support".'
    },
    'create_case_for_contact' => new Map<String, Object>{
        'seq' => 2,
        'desc' => 'Trigger when the user reports an issue that should be tracked as a support ticket for a known person or customer contact — phrases like "create a case for this user", "open a support case", "log this issue", "raise a ticket for contact".'
    },
    'create_Contact_by_Name' => new Map<String, Object>{
        'seq' => 3,
        'desc' => 'Trigger when a user asks to create a new contact profile for support tracking — phrases like "create a contact", "add a new user", "register contact", "create contact by name".'
    },
    'password_reset_help' => new Map<String, Object>{
        'seq' => 4,
        'desc' => 'Trigger when the user asks how to reset a password, cannot sign in, or is locked out — phrases like "reset my password", "forgot password", "can\'t log in", "account locked".'
    },
    'software_installation_issue' => new Map<String, Object>{
        'seq' => 5,
        'desc' => 'Trigger when the user reports software install failures, setup errors, missing permissions, or compatibility problems — phrases like "install failed", "cannot install", "setup error", "installation stuck".'
    },
    'troubleshoot_connectivity_issue' => new Map<String, Object>{
        'seq' => 6,
        'desc' => 'Trigger when users report internet, VPN, Wi-Fi, or network access problems — phrases like "no internet", "VPN not connecting", "Wi-Fi keeps dropping", "network error".'
    },
    'faq_software_access' => new Map<String, Object>{
        'seq' => 7,
        'desc' => 'Trigger when users ask common access/setup questions — phrases like "how do I get access", "where do I download", "what license do I need", "how do I configure this app".'
    },
    'user_frustrated_reassure' => new Map<String, Object>{
        'seq' => 8,
        'desc' => 'Trigger when the user is upset, stressed, or frustrated — phrases like "this is annoying", "nothing works", "I am frustrated", "I have tried everything".'
    },
    'escalate_to_human_support' => new Map<String, Object>{
        'seq' => 9,
        'desc' => 'Trigger when the issue is advanced, sensitive, security-related, or not resolved after standard steps — phrases like "this still doesn\'t work", "need an engineer", "security issue", "I need human help".'
    },
    'helpdesk_out_of_scope' => new Map<String, Object>{
        'seq' => 10,
        'desc' => 'Trigger when requests are unrelated to IT helpdesk scope or require personal/legal/financial advice.'
    }
};

List<AI_Agent_Intent__c> intents = [
    SELECT Id, Name, Sequence__c, Description__c, Is_Active__c
    FROM AI_Agent_Intent__c
    WHERE AI_Agent__r.Name = 'IT Helpdesk Agent'
      AND Name IN :cfg.keySet()
];

for (AI_Agent_Intent__c i : intents) {
    Map<String, Object> row = cfg.get(i.Name);
    i.Sequence__c = (Integer) row.get('seq');
    i.Description__c = (String) row.get('desc');
    i.Is_Active__c = true;
}

if (!intents.isEmpty()) {
    update intents;
}

System.debug('Updated IT Helpdesk intent metadata records: ' + intents.size());
