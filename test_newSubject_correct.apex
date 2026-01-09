// Test the newSubject parameter with correct account
CaseManagementHandler handler = new CaseManagementHandler();

Map<String, Object> params = new Map<String, Object>();
params.put('subject', 'call karthick'); // Find by this subject
params.put('newSubject', 'call K7');    // Update to this new subject
params.put('accountId', '001J900000HaqZlIAJ'); // Global Sparks Corporation

System.debug('=== Testing update_Case with newSubject (correct account) ===');
System.debug('Parameters: ' + JSON.serializePretty(params));

String result = handler.executeMethod('update_Case', params);

System.debug('=== RESULT ===');
System.debug(result);

// Verify the update
List<Case> cases = [SELECT Id, CaseNumber, Subject FROM Case WHERE Id = '500J900000IC7TIIA1'];
if (!cases.isEmpty()) {
    System.debug('=== VERIFICATION ===');
    System.debug('New Subject: ' + cases[0].Subject);
}
