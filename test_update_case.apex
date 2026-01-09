// Test update_Case operation directly
// First, get a case ID to test with
List<Case> cases = [SELECT Id, CaseNumber, Subject, Status FROM Case LIMIT 1];

if (cases.isEmpty()) {
    System.debug('ERROR: No cases found in org. Create a case first.');
} else {
    Case testCase = cases[0];
    System.debug('=== Testing with Case ===');
    System.debug('Case ID: ' + testCase.Id);
    System.debug('Case Number: ' + testCase.CaseNumber);
    System.debug('Current Subject: ' + testCase.Subject);
    System.debug('Current Status: ' + testCase.Status);
    System.debug('');

    // Test the handler
    CaseManagementHandler handler = new CaseManagementHandler();

    // Create test parameters
    Map<String, Object> params = new Map<String, Object>();
    params.put('caseId', testCase.Id);
    params.put('status', 'Working');
    params.put('description', 'Updated via test script at ' + System.now());

    System.debug('=== Calling CaseManagementHandler.executeMethod ===');
    System.debug('Operation: update_Case');
    System.debug('Parameters: ' + JSON.serializePretty(params));
    System.debug('');

    // Execute
    String result = handler.executeMethod('update_Case', params);

    System.debug('=== RESULT ===');
    System.debug(result);
    System.debug('');

    // Verify update
    Case updatedCase = [SELECT Id, CaseNumber, Subject, Status, Description FROM Case WHERE Id = :testCase.Id];
    System.debug('=== After Update ===');
    System.debug('Status: ' + updatedCase.Status);
    System.debug('Description: ' + updatedCase.Description);
}
