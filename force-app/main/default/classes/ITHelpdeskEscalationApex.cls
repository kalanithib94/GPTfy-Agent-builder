global with sharing class ITHelpdeskEscalationApex implements AIIntentActionInterface {
    global Map<String, Object> invokeApex(Map<String, Object> request) {
        String intentName = (String) request.get('intentName');
        String sessionId = (String) request.get('sessionId');

        return new Map<String, Object>{
            'success' => true,
            'message' => 'Escalation automation recorded for intent '
                + (intentName == null ? 'unknown' : intentName)
                + '. Session: '
                + (sessionId == null ? 'n/a' : sessionId)
        };
    }
}
