// Test case update with empty strings (simulating AI behavior)
CaseManagementHandler handler = new CaseManagementHandler();

System.debug('=== Testing update_Case with empty strings ===');
Map<String, Object> params = new Map<String, Object>();
params.put('caseId', '');  // Empty string
params.put('caseNumber', '');  // Empty string
params.put('subject', 'call k7');  // Should use this for lookup
params.put('newSubject', 'call K9');  // Should update to this
params.put('accountId', '001J900000HaqZlIAJ');  // Context filter
params.put('description', '');  // Empty string
params.put('status', '');  // Empty string
params.put('priority', '');  // Empty string
params.put('origin', '');  // Empty string
params.put('type', '');  // Empty string
params.put('contactId', '');  // Empty string

System.debug('Parameters: ' + JSON.serializePretty(params));
System.debug('');

String result = handler.executeMethod('update_Case', params);

System.debug('=== RESULT ===');
System.debug(result);

if (result.contains('success')) {
    System.debug('');
    System.debug('✓ TEST PASSED: Empty strings are now handled correctly');
} else {
    System.debug('');
    System.debug('✗ TEST FAILED: ' + result);
}
