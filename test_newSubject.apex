// Test the newSubject parameter (simulating what AI Agent sends)
CaseManagementHandler handler = new CaseManagementHandler();

Map<String, Object> params = new Map<String, Object>();
params.put('subject', 'call karthick'); // Find by this subject
params.put('newSubject', 'call K7');    // Update to this new subject
params.put('accountId', '001J900000HaqZIIAJ'); // Context filter

System.debug('=== Testing update_Case with newSubject ===');
System.debug('Parameters: ' + JSON.serializePretty(params));
System.debug('');

String result = handler.executeMethod('update_Case', params);

System.debug('=== RESULT ===');
System.debug(result);
