// Test create_Contact with unique name (TEST 15 final fix)
ContactManagementHandler contactHandler = new ContactManagementHandler();

System.debug('=== TEST 15: create_Contact - Full parameters (with unique name) ===');

// Use unique email and name to avoid duplicate detection
String timestamp = String.valueOf(DateTime.now().getTime());
String uniqueEmail = 'testregression' + timestamp + '@example.com';

System.debug('Generated timestamp: ' + timestamp);
System.debug('Generated unique email: ' + uniqueEmail);

Map<String, Object> params15 = new Map<String, Object>();
params15.put('firstName', 'Test');
params15.put('lastName', 'RegressionUser' + timestamp);
params15.put('email', uniqueEmail);
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
