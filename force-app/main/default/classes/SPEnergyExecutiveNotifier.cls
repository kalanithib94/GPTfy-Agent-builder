/**
 * SP Energy Bot — Executive Notifier
 *
 * Intent  : #Presidential#
 * Return  : Append to Message
 *
 * Handles presidential / CEO-level escalations. Flags the Account with a
 * PRESIDENTIAL COMPLAINT marker, creates a Critical priority Task for
 * the executive support team, and posts a Chatter notification.
 *
 * Namespace note:
 *   Dev / QA org (package author)  → implements ccai_qa.AIIntentActionInterface
 *   Managed package installed org  → implements ccai.AIIntentActionInterface
 */
global class SPEnergyExecutiveNotifier implements ccai_qa.AIIntentActionInterface {

    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String recordId      = (String) request.get('recordId');
        String responseBody  = (String) request.get('responseBody');
        String intentName    = (String) request.get('intentName');
        String userId        = (String) request.get('userId');
        String sessionId     = (String) request.get('sessionId');

        try {
            Id ownerId = String.isNotBlank(userId) ? (Id) userId : UserInfo.getUserId();

            // ── Flag Account with Presidential Complaint marker ───────────────
            if (String.isNotBlank(recordId)) {
                Id recId = (Id) recordId;
                if (recId.getSObjectType().getDescribe().getName() == 'Account') {
                    Account acc = [SELECT Id, Description FROM Account WHERE Id = :recId LIMIT 1];
                    String existing = String.isNotBlank(acc.Description) ? acc.Description : '';
                    acc.Description = 'PRESIDENTIAL COMPLAINT: Executive escalation raised via GPTfy on '
                        + String.valueOf(Date.today()) + '. Immediate executive review required.'
                        + '\n\n' + existing;
                    update acc;
                }
            }

            // ── Create Critical Task for executive team ───────────────────────
            Task t = new Task();
            t.Subject      = 'PRESIDENTIAL COMPLAINT — Executive Review Required Immediately';
            t.Description  = 'Customer has requested executive-level escalation via GPTfy chatbot.'
                + '\nSession: ' + sessionId
                + '\nIntent: ' + intentName
                + '\nAI Response Context: ' + (String.isNotBlank(responseBody)
                    ? responseBody.abbreviate(500) : 'N/A');
            t.Priority     = 'High';
            t.Status       = 'Not Started';
            t.ActivityDate = Date.today();
            t.OwnerId      = ownerId;
            if (String.isNotBlank(recordId)) {
                t.WhatId = (Id) recordId;
            }
            insert t;

            // ── Post Chatter alert to the executive record ────────────────────
            if (String.isNotBlank(recordId)) {
                ConnectApi.FeedItemInput feedItemInput = new ConnectApi.FeedItemInput();
                ConnectApi.MessageBodyInput messageBodyInput = new ConnectApi.MessageBodyInput();
                ConnectApi.TextSegmentInput textSegment = new ConnectApi.TextSegmentInput();
                textSegment.text = '🚨 PRESIDENTIAL COMPLAINT received via GPTfy chatbot. '
                    + 'Executive team: please review and respond within 24 hours. '
                    + 'Session ID: ' + sessionId;
                messageBodyInput.messageSegments = new List<ConnectApi.MessageSegmentInput>{ textSegment };
                feedItemInput.body = messageBodyInput;
                feedItemInput.feedElementType = ConnectApi.FeedElementType.FeedItem;
                feedItemInput.subjectId = recordId;
                ConnectApi.ChatterFeeds.postFeedElement(Network.getNetworkId(), feedItemInput);
            }

            return new Map<String, Object>{
                'success' => true,
                'message' => 'Your case has been personally escalated to our executive team. '
                    + 'You should expect direct contact within 24 hours.'
            };

        } catch (Exception e) {
            System.debug('SPEnergyExecutiveNotifier error: ' + e.getMessage());
            // Graceful fallback — still return a useful message
            return new Map<String, Object>{
                'success' => false,
                'message' => 'The automatic executive notification encountered an issue, '
                    + 'but your case has been logged. Please reference your case number '
                    + 'when calling our escalations line to ensure it reaches the executive team.'
            };
        }
    }
}
