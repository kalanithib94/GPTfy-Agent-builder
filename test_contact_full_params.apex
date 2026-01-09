// Test create_Contact with full parameters (TEST 15 isolated)
ContactManagementHandler contactHandler = new ContactManagementHandler();

System.debug('=== TEST 15: create_Contact - Full parameters ===');
Map<String, Object> params15 = new Map<String, Object>();
params15.put('firstName', 'Test');
params15.put('lastName', 'RegressionUser');
params15.put('email', 'testregression@example.com');
params15.put('accountId', '001J900000HaqZlIAJ');
params15.put('title', 'Test Engineer');
params15.put('phone', '555-0100');

System.debug('Parameters: ' + JSON.serializePretty(params15));
System.debug('');

try {
    String result15 = contactHandler.executeMethod('create_Contact', params15);
    System.debug('=== RESULT ===');
    System.debug(result15);

    if (result15.contains('success') && result15.contains('contactId')) {
        System.debug('');
        System.debug('✓ TEST PASSED');
    } else {
        System.debug('');
        System.debug('✗ TEST FAILED - No success or contactId in response');
    }
} catch (Exception e) {
    System.debug('✗ TEST FAILED with exception: ' + e.getMessage());
    System.debug('Stack Trace: ' + e.getStackTraceString());
}
