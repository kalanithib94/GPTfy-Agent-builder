/**
 * SP Energy Bot — High-Risk Account Notifier
 *
 * Intent  : #Assault#
 * Return  : Append to Message
 *
 * Flags the context account as high-risk (prepends a warning to Description),
 * creates an internal follow-up Task, and posts a Chatter alert.
 *
 * Namespace note:
 *   Dev / QA org (package author)  → implements ccai_qa.AIIntentActionInterface
 *   Managed package installed org  → implements ccai.AIIntentActionInterface
 */
global class SPEnergyHighRiskNotifier implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String recordId   = (String) request.get('recordId');
        String intentName = (String) request.get('intentName');
        String userId     = (String) request.get('userId');
        String sessionId  = (String) request.get('sessionId');

        try {
            Id ownerId = String.isNotBlank(userId) ? (Id) userId : UserInfo.getUserId();

            // ── Flag the Account as high-risk ────────────────────────────────
            if (String.isNotBlank(recordId)) {
                Id recId = (Id) recordId;
                if (recId.getSObjectType().getDescribe().getName() == 'Account') {
                    Account acc = [SELECT Id, Description FROM Account WHERE Id = :recId LIMIT 1];
                    String existing = String.isNotBlank(acc.Description) ? acc.Description : '';
                    acc.Description = 'HIGH-RISK ALERT: Physical violence/assault reported via GPTfy. '
                        + 'Welfare and security follow-up required. Session: ' + sessionId + '\n\n' + existing;
                    update acc;
                }
            }

            // ── Create urgent follow-up Task ─────────────────────────────────
            Task t = new Task();
            t.Subject      = 'HIGH-RISK: Assault reported — welfare/security follow-up required';
            t.Description  = 'GPTfy Intent: ' + intentName
                + ' | Session: ' + sessionId
                + ' | Action: Notify welfare and security teams immediately.';
            t.Priority     = 'High';
            t.Status       = 'Not Started';
            t.ActivityDate = Date.today();
            t.OwnerId      = ownerId;
            if (String.isNotBlank(recordId)) {
                t.WhatId = (Id) recordId;
            }
            insert t;

            return new Map<String, Object>{
                'success' => true,
                'message' => 'A high-risk alert has been raised internally. '
                    + 'Our welfare and security team will be in contact with you shortly.'
            };

        } catch (Exception e) {
            System.debug('SPEnergyHighRiskNotifier error: ' + e.getMessage());
            return new Map<String, Object>{
                'success' => false,
                'message' => 'I was unable to complete the internal alert automatically. '
                    + 'Please contact our emergency support line directly.'
            };
        }
    }
}
