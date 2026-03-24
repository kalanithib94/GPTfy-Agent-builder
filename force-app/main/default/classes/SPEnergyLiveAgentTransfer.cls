/**
 * SP Energy Bot — Live Agent Transfer
 *
 * Intent  : #Agent#
 * Return  : Replace Message
 *
 * Handles the request to transfer to a human agent. Creates a queued callback
 * Task so the support team knows a transfer was requested, and returns a
 * handoff message that completely replaces the AI reply.
 *
 * Namespace note:
 *   Dev / QA org (package author)  → implements ccai_qa.AIIntentActionInterface
 *   Managed package installed org  → implements ccai.AIIntentActionInterface
 */
global class SPEnergyLiveAgentTransfer implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String recordId   = (String) request.get('recordId');
        String agentId    = (String) request.get('agentId');
        String userId     = (String) request.get('userId');
        String sessionId  = (String) request.get('sessionId');
        String intentName = (String) request.get('intentName');

        try {
            Id ownerId = String.isNotBlank(userId) ? (Id) userId : UserInfo.getUserId();

            // ── Create a callback/transfer Task for the support queue ─────────
            Task t = new Task();
            t.Subject      = 'Live Agent Transfer Requested — SP Energy Bot';
            t.Description  = 'Customer requested live agent via GPTfy chatbot.'
                + '\nSession: ' + sessionId
                + '\nIntent: ' + intentName
                + '\nAgent Record: ' + agentId;
            t.Priority     = 'Normal';
            t.Status       = 'Not Started';
            t.ActivityDate = Date.today();
            t.OwnerId      = ownerId;
            if (String.isNotBlank(recordId)) {
                t.WhatId = (Id) recordId;
            }
            insert t;

            return new Map<String, Object>{
                'success' => true,
                'message' => 'Connecting you to a live advisor now. Please hold on — '
                    + 'an agent will be with you shortly. Typical wait time is under 5 minutes. '
                    + 'If your matter is urgent, please call our helpline directly: [SP Energy Phone Number].'
            };

        } catch (Exception e) {
            System.debug('SPEnergyLiveAgentTransfer error: ' + e.getMessage());
            return new Map<String, Object>{
                'success' => false,
                'message' => 'I was unable to initiate the transfer automatically. '
                    + 'Please call our helpline directly to speak with an advisor: [SP Energy Phone Number].'
            };
        }
    }
}
