/**
 * COMPREHENSIVE REGRESSION TEST SUITE
 * Tests all handlers with multiple scenarios to catch edge cases
 */

System.debug('========================================');
System.debug('COMPREHENSIVE HANDLER REGRESSION TESTS');
System.debug('========================================');
System.debug('');

Integer totalTests = 0;
Integer passedTests = 0;
Integer failedTests = 0;

// ==================== ACCOUNTINTELLIGENCEHANDLER TESTS ====================
System.debug('=== TESTING: AccountIntelligenceHandler ===');
AccountIntelligenceHandler accountHandler = new AccountIntelligenceHandler();

// TEST 1: find_Account_by_Name - Exact match
totalTests++;
try {
    Map<String, Object> params1 = new Map<String, Object>();
    params1.put('accountName', 'Global Sparks Corporation');
    String result1 = accountHandler.executeMethod('find_Account_by_Name', params1);
    if (result1.contains('success') && result1.contains('Global Sparks')) {
        passedTests++;
        System.debug('✓ TEST 1 PASSED: find_Account_by_Name - Exact match');
    } else {
        failedTests++;
        System.debug('✗ TEST 1 FAILED: find_Account_by_Name - Exact match');
        System.debug('Result: ' + result1);
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 1 FAILED with exception: ' + e.getMessage());
}

// TEST 2: find_Account_by_Name - Partial match
totalTests++;
try {
    Map<String, Object> params2 = new Map<String, Object>();
    params2.put('accountName', 'Global');
    String result2 = accountHandler.executeMethod('find_Account_by_Name', params2);
    if (result2.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 2 PASSED: find_Account_by_Name - Partial match');
    } else {
        failedTests++;
        System.debug('✗ TEST 2 FAILED: find_Account_by_Name - Partial match');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 2 FAILED with exception: ' + e.getMessage());
}

// TEST 3: find_Account_by_Name - Non-existent account
totalTests++;
try {
    Map<String, Object> params3 = new Map<String, Object>();
    params3.put('accountName', 'NonExistentCompany12345');
    String result3 = accountHandler.executeMethod('find_Account_by_Name', params3);
    if (result3.contains('success') || result3.contains('0') || result3.contains('not found')) {
        passedTests++;
        System.debug('✓ TEST 3 PASSED: find_Account_by_Name - Non-existent account handled gracefully');
    } else {
        failedTests++;
        System.debug('✗ TEST 3 FAILED: find_Account_by_Name - Non-existent account');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 3 FAILED with exception: ' + e.getMessage());
}

// TEST 4: find_Contacts_for_Account - Valid accountId
totalTests++;
try {
    Map<String, Object> params4 = new Map<String, Object>();
    params4.put('accountId', '001J900000HaqZlIAJ'); // Global Sparks Corporation
    String result4 = accountHandler.executeMethod('find_Contacts_for_Account', params4);
    if (result4.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 4 PASSED: find_Contacts_for_Account - Valid accountId');
    } else {
        failedTests++;
        System.debug('✗ TEST 4 FAILED: find_Contacts_for_Account - Valid accountId');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 4 FAILED with exception: ' + e.getMessage());
}

// TEST 5: find_Contacts_for_Account - Valid accountName
totalTests++;
try {
    Map<String, Object> params5 = new Map<String, Object>();
    params5.put('accountName', 'Global Sparks Corporation');
    String result5 = accountHandler.executeMethod('find_Contacts_for_Account', params5);
    if (result5.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 5 PASSED: find_Contacts_for_Account - Valid accountName');
    } else {
        failedTests++;
        System.debug('✗ TEST 5 FAILED: find_Contacts_for_Account - Valid accountName');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 5 FAILED with exception: ' + e.getMessage());
}

// TEST 6: find_Opportunities_for_Account - Valid accountId
totalTests++;
try {
    Map<String, Object> params6 = new Map<String, Object>();
    params6.put('accountId', '001J900000HaqZlIAJ');
    String result6 = accountHandler.executeMethod('find_Opportunities_for_Account', params6);
    if (result6.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 6 PASSED: find_Opportunities_for_Account - Valid accountId');
    } else {
        failedTests++;
        System.debug('✗ TEST 6 FAILED: find_Opportunities_for_Account - Valid accountId');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 6 FAILED with exception: ' + e.getMessage());
}

// TEST 7: find_Cases_for_Account - Valid accountId
totalTests++;
try {
    Map<String, Object> params7 = new Map<String, Object>();
    params7.put('accountId', '001J900000HaqZlIAJ');
    String result7 = accountHandler.executeMethod('find_Cases_for_Account', params7);
    if (result7.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 7 PASSED: find_Cases_for_Account - Valid accountId');
    } else {
        failedTests++;
        System.debug('✗ TEST 7 FAILED: find_Cases_for_Account - Valid accountId');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 7 FAILED with exception: ' + e.getMessage());
}

// TEST 8: find_Cases_for_Account - With includeClosed flag
totalTests++;
try {
    Map<String, Object> params8 = new Map<String, Object>();
    params8.put('accountId', '001J900000HaqZlIAJ');
    params8.put('includeClosed', true);
    String result8 = accountHandler.executeMethod('find_Cases_for_Account', params8);
    if (result8.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 8 PASSED: find_Cases_for_Account - With includeClosed flag');
    } else {
        failedTests++;
        System.debug('✗ TEST 8 FAILED: find_Cases_for_Account - With includeClosed flag');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 8 FAILED with exception: ' + e.getMessage());
}

System.debug('');

// ==================== CASEMANAGEMENTHANDLER TESTS ====================
System.debug('=== TESTING: CaseManagementHandler ===');
CaseManagementHandler caseHandler = new CaseManagementHandler();

// TEST 9: create_Case - Full parameters
totalTests++;
try {
    Map<String, Object> params9 = new Map<String, Object>();
    params9.put('subject', 'Test Case - Regression Test');
    params9.put('description', 'This is a test case created by regression testing');
    params9.put('accountId', '001J900000HaqZlIAJ');
    params9.put('status', 'New');
    params9.put('priority', 'Low');
    params9.put('origin', 'Web');
    String result9 = caseHandler.executeMethod('create_Case', params9);
    if (result9.contains('success') && result9.contains('caseId')) {
        passedTests++;
        System.debug('✓ TEST 9 PASSED: create_Case - Full parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 9 FAILED: create_Case - Full parameters');
        System.debug('Result: ' + result9);
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 9 FAILED with exception: ' + e.getMessage());
}

// TEST 10: create_Case - Minimal parameters
totalTests++;
try {
    Map<String, Object> params10 = new Map<String, Object>();
    params10.put('subject', 'Minimal Test Case');
    params10.put('accountId', '001J900000HaqZlIAJ');
    String result10 = caseHandler.executeMethod('create_Case', params10);
    if (result10.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 10 PASSED: create_Case - Minimal parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 10 FAILED: create_Case - Minimal parameters');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 10 FAILED with exception: ' + e.getMessage());
}

// TEST 11: update_Case - By caseId
totalTests++;
try {
    Map<String, Object> params11 = new Map<String, Object>();
    params11.put('caseId', '500J900000IC7TIIA1');
    params11.put('status', 'Working');
    String result11 = caseHandler.executeMethod('update_Case', params11);
    if (result11.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 11 PASSED: update_Case - By caseId');
    } else {
        failedTests++;
        System.debug('✗ TEST 11 FAILED: update_Case - By caseId');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 11 FAILED with exception: ' + e.getMessage());
}

// TEST 12: update_Case - By caseNumber
totalTests++;
try {
    Map<String, Object> params12 = new Map<String, Object>();
    params12.put('caseNumber', '00001599');
    params12.put('priority', 'High');
    String result12 = caseHandler.executeMethod('update_Case', params12);
    if (result12.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 12 PASSED: update_Case - By caseNumber');
    } else {
        failedTests++;
        System.debug('✗ TEST 12 FAILED: update_Case - By caseNumber');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 12 FAILED with exception: ' + e.getMessage());
}

// TEST 13: update_Case - By subject (partial match)
totalTests++;
try {
    Map<String, Object> params13 = new Map<String, Object>();
    params13.put('subject', 'call K7');
    params13.put('accountId', '001J900000HaqZlIAJ');
    params13.put('description', 'Updated via regression test');
    String result13 = caseHandler.executeMethod('update_Case', params13);
    if (result13.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 13 PASSED: update_Case - By subject (partial match)');
    } else {
        failedTests++;
        System.debug('✗ TEST 13 FAILED: update_Case - By subject (partial match)');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 13 FAILED with exception: ' + e.getMessage());
}

// TEST 14: update_Case - Update subject with newSubject parameter
totalTests++;
try {
    Map<String, Object> params14 = new Map<String, Object>();
    params14.put('subject', 'call K7');
    params14.put('newSubject', 'call karthick - Updated');
    params14.put('accountId', '001J900000HaqZlIAJ');
    String result14 = caseHandler.executeMethod('update_Case', params14);
    if (result14.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 14 PASSED: update_Case - Update subject with newSubject');
    } else {
        failedTests++;
        System.debug('✗ TEST 14 FAILED: update_Case - Update subject with newSubject');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 14 FAILED with exception: ' + e.getMessage());
}

System.debug('');

// ==================== CONTACTMANAGEMENTHANDLER TESTS ====================
System.debug('=== TESTING: ContactManagementHandler ===');
ContactManagementHandler contactHandler = new ContactManagementHandler();

// TEST 15: create_Contact - Full parameters
totalTests++;
try {
    // Use unique email and timestamp-based name to avoid duplicate detection on multiple test runs
    String timestamp = String.valueOf(DateTime.now().getTime());
    String uniqueEmail = 'testregression' + timestamp + '@example.com';
    Map<String, Object> params15 = new Map<String, Object>();
    params15.put('firstName', 'Test' + timestamp);
    params15.put('lastName', 'RegressionUser' + timestamp);
    params15.put('email', uniqueEmail);
    params15.put('accountId', '001J900000HaqZlIAJ');
    params15.put('title', 'Test Engineer');
    params15.put('phone', '555-0100');
    String result15 = contactHandler.executeMethod('create_Contact', params15);
    if (result15.contains('success') && result15.contains('contactId')) {
        passedTests++;
        System.debug('✓ TEST 15 PASSED: create_Contact - Full parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 15 FAILED: create_Contact - Full parameters');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 15 FAILED with exception: ' + e.getMessage());
}

// TEST 16: create_Contact - Minimal parameters (lastName required)
totalTests++;
try {
    Map<String, Object> params16 = new Map<String, Object>();
    params16.put('lastName', 'MinimalContact');
    params16.put('accountId', '001J900000HaqZlIAJ');
    String result16 = contactHandler.executeMethod('create_Contact', params16);
    if (result16.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 16 PASSED: create_Contact - Minimal parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 16 FAILED: create_Contact - Minimal parameters');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 16 FAILED with exception: ' + e.getMessage());
}

// Get a contact ID for update tests
List<Contact> testContacts = [SELECT Id, FirstName, LastName FROM Contact
                               WHERE AccountId = '001J900000HaqZlIAJ' LIMIT 1];

if (!testContacts.isEmpty()) {
    // TEST 17: update_Contact - By contactId
    totalTests++;
    try {
        Map<String, Object> params17 = new Map<String, Object>();
        params17.put('contactId', testContacts[0].Id);
        params17.put('title', 'Updated Title');
        String result17 = contactHandler.executeMethod('update_Contact', params17);
        if (result17.contains('success')) {
            passedTests++;
            System.debug('✓ TEST 17 PASSED: update_Contact - By contactId');
        } else {
            failedTests++;
            System.debug('✗ TEST 17 FAILED: update_Contact - By contactId');
        }
    } catch (Exception e) {
        failedTests++;
        System.debug('✗ TEST 17 FAILED with exception: ' + e.getMessage());
    }

    // TEST 18: update_Contact - By name (partial match)
    totalTests++;
    try {
        Map<String, Object> params18 = new Map<String, Object>();
        params18.put('firstName', testContacts[0].FirstName);
        params18.put('lastName', testContacts[0].LastName);
        params18.put('accountId', '001J900000HaqZlIAJ');
        params18.put('phone', '555-9999');
        String result18 = contactHandler.executeMethod('update_Contact', params18);
        if (result18.contains('success')) {
            passedTests++;
            System.debug('✓ TEST 18 PASSED: update_Contact - By name (partial match)');
        } else {
            failedTests++;
            System.debug('✗ TEST 18 FAILED: update_Contact - By name (partial match)');
        }
    } catch (Exception e) {
        failedTests++;
        System.debug('✗ TEST 18 FAILED with exception: ' + e.getMessage());
    }
} else {
    System.debug('⚠ SKIPPED TEST 17-18: No contacts found for update testing');
    totalTests += 2;
    failedTests += 2;
}

System.debug('');

// ==================== OPPORTUNITYMANAGEMENTHANDLER TESTS ====================
System.debug('=== TESTING: OpportunityManagementHandler ===');
OpportunityManagementHandler oppHandler = new OpportunityManagementHandler();

// TEST 19: create_Opportunity - Full parameters
totalTests++;
try {
    Map<String, Object> params19 = new Map<String, Object>();
    params19.put('name', 'Regression Test Opportunity');
    params19.put('accountId', '001J900000HaqZlIAJ');
    params19.put('closeDate', '2026-12-31');
    params19.put('stageName', 'Prospecting');
    params19.put('amount', 50000);
    params19.put('probability', 10);
    String result19 = oppHandler.executeMethod('create_Opportunity', params19);
    if (result19.contains('success') && result19.contains('opportunityId')) {
        passedTests++;
        System.debug('✓ TEST 19 PASSED: create_Opportunity - Full parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 19 FAILED: create_Opportunity - Full parameters');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 19 FAILED with exception: ' + e.getMessage());
}

// TEST 20: create_Opportunity - Minimal parameters
totalTests++;
try {
    Map<String, Object> params20 = new Map<String, Object>();
    params20.put('name', 'Minimal Opportunity');
    params20.put('accountId', '001J900000HaqZlIAJ');
    params20.put('closeDate', '2026-06-30');
    params20.put('stageName', 'Qualification');
    String result20 = oppHandler.executeMethod('create_Opportunity', params20);
    if (result20.contains('success')) {
        passedTests++;
        System.debug('✓ TEST 20 PASSED: create_Opportunity - Minimal parameters');
    } else {
        failedTests++;
        System.debug('✗ TEST 20 FAILED: create_Opportunity - Minimal parameters');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST 20 FAILED with exception: ' + e.getMessage());
}

// Get an opportunity ID for update tests
List<Opportunity> testOpps = [SELECT Id, Name FROM Opportunity
                               WHERE AccountId = '001J900000HaqZlIAJ' LIMIT 1];

if (!testOpps.isEmpty()) {
    // TEST 21: update_Opportunity - By opportunityId
    totalTests++;
    try {
        Map<String, Object> params21 = new Map<String, Object>();
        params21.put('opportunityId', testOpps[0].Id);
        params21.put('stageName', 'Needs Analysis');
        String result21 = oppHandler.executeMethod('update_Opportunity', params21);
        if (result21.contains('success')) {
            passedTests++;
            System.debug('✓ TEST 21 PASSED: update_Opportunity - By opportunityId');
        } else {
            failedTests++;
            System.debug('✗ TEST 21 FAILED: update_Opportunity - By opportunityId');
        }
    } catch (Exception e) {
        failedTests++;
        System.debug('✗ TEST 21 FAILED with exception: ' + e.getMessage());
    }

    // TEST 22: update_Opportunity - By name (partial match)
    totalTests++;
    try {
        Map<String, Object> params22 = new Map<String, Object>();
        params22.put('name', testOpps[0].Name);
        params22.put('accountId', '001J900000HaqZlIAJ');
        params22.put('amount', 75000);
        String result22 = oppHandler.executeMethod('update_Opportunity', params22);
        if (result22.contains('success')) {
            passedTests++;
            System.debug('✓ TEST 22 PASSED: update_Opportunity - By name (partial match)');
        } else {
            failedTests++;
            System.debug('✗ TEST 22 FAILED: update_Opportunity - By name (partial match)');
        }
    } catch (Exception e) {
        failedTests++;
        System.debug('✗ TEST 22 FAILED with exception: ' + e.getMessage());
    }
} else {
    System.debug('⚠ SKIPPED TEST 21-22: No opportunities found for update testing');
    totalTests += 2;
    failedTests += 2;
}

System.debug('');

// ==================== SUMMARY ====================
System.debug('========================================');
System.debug('TEST SUMMARY');
System.debug('========================================');
System.debug('Total Tests: ' + totalTests);
System.debug('Passed: ' + passedTests + ' ✓');
System.debug('Failed: ' + failedTests + ' ✗');
Decimal passRate = totalTests > 0 ? (Decimal.valueOf(passedTests) / Decimal.valueOf(totalTests) * 100).setScale(2) : 0;
System.debug('Pass Rate: ' + passRate + '%');
System.debug('========================================');

if (failedTests == 0) {
    System.debug('✓ ALL TESTS PASSED! Ready to update documentation.');
} else {
    System.debug('✗ SOME TESTS FAILED. Fix issues before updating documentation.');
}
