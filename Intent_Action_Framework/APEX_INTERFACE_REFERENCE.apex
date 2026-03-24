/**
 * INTENT ACTION FRAMEWORK — Apex Interface Reference
 *
 * To create a custom Apex action for the Intent Action Framework,
 * implement the ccai_qa.AIIntentActionInterface global interface.
 *
 * ─────────────────────────────────────────────────────────────────
 * INTERFACE SIGNATURE
 * ─────────────────────────────────────────────────────────────────
 * Namespace : ccai_qa
 * Interface : AIIntentActionInterface
 * Method    : invokeApex(Map<String, Object> request)
 * Returns   : Map<String, Object>
 *
 * ─────────────────────────────────────────────────────────────────
 * REQUEST MAP — Keys available in the input parameter
 * ─────────────────────────────────────────────────────────────────
 * Key            | Type   | Description
 * ---------------|--------|------------------------------------------
 * agentId        | String | Salesforce ID of the AI_Agent__c record
 * responseBody   | String | The AI model's original response text
 * recordId       | String | Context record ID (e.g., Account the chat is on)
 * intentName     | String | Name of the intent that triggered this action
 * userId         | String | Salesforce ID of the running user
 * sessionId      | String | GPTfy chat session ID
 *
 * ─────────────────────────────────────────────────────────────────
 * RESPONSE MAP — Keys expected in the return value
 * ─────────────────────────────────────────────────────────────────
 * Key     | Type    | Required | Description
 * --------|---------|----------|-------------------------------------
 * success | Boolean | Yes      | true = success, false = graceful fail
 * message | String  | Yes      | Text shown or appended in chat UI
 *
 * ─────────────────────────────────────────────────────────────────
 * RETURN TYPE (configured on the Intent Action record)
 * ─────────────────────────────────────────────────────────────────
 * "Replace Message" : The AI's message is discarded; 'message' from
 *                     this class is shown to the user instead.
 *
 * "Append to Message" : The 'message' from this class is appended
 *                       to the end of the AI's original response.
 */


// ══════════════════════════════════════════════════════════════════
// EXAMPLE 1: GPTfyWelcome — EE Testing Reference Implementation
// ══════════════════════════════════════════════════════════════════
// Used during Engineering Excellence testing.
// Return Type tested: "Replace Message" and "Append to Message".
//
// INTENT SETUP:
//   Intent Name:   welcome_gptfy
//   Description:   Trigger when user greets or says hello/hi
//   Action Type:   Apex
//   Class Name:    GPTfyWelcome
//   Return Type:   Replace Message (or Append to Message)

global class GPTfyWelcome implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String agentId      = (String) request.get('agentId');
        String responseBody = (String) request.get('responseBody');

        return new Map<String, Object>{
            'success' => true,
            'message' => 'Welcome to GPTfy, EE teams welcomes you!!'
        };
    }
}


// ══════════════════════════════════════════════════════════════════
// EXAMPLE 2: IntentSupportEscalator — Production-Grade Template
// ══════════════════════════════════════════════════════════════════
// Demonstrates full request field usage, error handling, and
// a realistic business logic pattern (logging intent fire events).
//
// INTENT SETUP:
//   Intent Name:   escalate_to_support
//   Description:   Trigger when user expresses urgency or frustration
//   Action Type:   Apex
//   Class Name:    IntentSupportEscalator
//   Return Type:   Append to Message

global class IntentSupportEscalator implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String agentId      = (String) request.get('agentId');
        String responseBody = (String) request.get('responseBody');
        String recordId     = (String) request.get('recordId');
        String intentName   = (String) request.get('intentName');
        String userId       = (String) request.get('userId');
        String sessionId    = (String) request.get('sessionId');

        try {
            // Example: Log the intent fire as a Task on the context record
            if (String.isNotBlank(recordId)) {
                Task t = new Task();
                t.Subject      = 'GPTfy Intent Fired: ' + intentName;
                t.Description  = 'Session: ' + sessionId + ' | Agent: ' + agentId;
                t.WhatId       = recordId;
                t.OwnerId      = String.isNotBlank(userId) ? userId : UserInfo.getUserId();
                t.ActivityDate = Date.today();
                t.Status       = 'Completed';
                insert t;
            }

            return new Map<String, Object>{
                'success' => true,
                'message' => 'Your request has been escalated. A support representative will follow up shortly.'
            };

        } catch (Exception e) {
            // Always return gracefully — never let an exception surface to the user
            System.debug('IntentSupportEscalator error: ' + e.getMessage());
            return new Map<String, Object>{
                'success' => false,
                'message' => 'I was unable to complete the escalation automatically. Please contact support directly.'
            };
        }
    }
}


// ══════════════════════════════════════════════════════════════════
// EXAMPLE 3: IntentAccountUpdater — Update Field via Apex
// ══════════════════════════════════════════════════════════════════
// Use when the built-in "Update Field" action type is not flexible
// enough — e.g., when the update logic depends on dynamic conditions.
//
// INTENT SETUP:
//   Intent Name:   mark_account_vip
//   Description:   Trigger when user says "mark as VIP" or "this is a VIP account"
//   Action Type:   Apex
//   Class Name:    IntentAccountUpdater
//   Return Type:   Replace Message

global class IntentAccountUpdater implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String recordId = (String) request.get('recordId');

        if (String.isBlank(recordId)) {
            return new Map<String, Object>{
                'success' => false,
                'message' => 'No record context found. Please navigate to an Account record and try again.'
            };
        }

        try {
            // Dynamically check object type before updating
            Id recId = (Id) recordId;
            String objectType = recId.getSObjectType().getDescribe().getName();

            if (objectType != 'Account') {
                return new Map<String, Object>{
                    'success' => false,
                    'message' => 'VIP marking is only supported on Account records.'
                };
            }

            Account acc = new Account(Id = recId);
            acc.Description = 'VIP Account — flagged via GPTfy Intent';
            update acc;

            return new Map<String, Object>{
                'success' => true,
                'message' => 'This account has been marked as VIP. The description has been updated accordingly.'
            };

        } catch (DmlException e) {
            return new Map<String, Object>{
                'success' => false,
                'message' => 'Unable to update the account. Please check your permissions and try again.'
            };
        }
    }
}
