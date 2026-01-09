// Test updating case by subject (like the AI Agent does)
CaseManagementHandler handler = new CaseManagementHandler();

// Simulate what the AI Agent sends
// Searching for case with subject "call karthick" and updating to "call K&"
Map<String, Object> params = new Map<String, Object>();
params.put('subject', 'call karthick'); // This is used for LOOKUP
// Note: the handler uses 'subject' for both lookup AND update
// Let's test just the lookup first

System.debug('=== Testing update_Case with subject lookup ===');
System.debug('Parameters: ' + JSON.serializePretty(params));
System.debug('');

String result = handler.executeMethod('update_Case', params);

System.debug('=== RESULT ===');
System.debug(result);
