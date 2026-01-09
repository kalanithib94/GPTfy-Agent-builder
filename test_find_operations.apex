// Test all find operations in AccountIntelligenceHandler
AccountIntelligenceHandler handler = new AccountIntelligenceHandler();

System.debug('=== TEST 1: find_Account_by_Name ===');
Map<String, Object> params1 = new Map<String, Object>();
params1.put('accountName', 'SteelCrafters');
String result1 = handler.executeMethod('find_Account_by_Name', params1);
System.debug('Result: ' + result1);
System.debug('');

System.debug('=== TEST 2: find_Contacts_for_Account ===');
// First get an account ID
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 1];
if (!accounts.isEmpty()) {
    Map<String, Object> params2 = new Map<String, Object>();
    params2.put('accountId', accounts[0].Id);
    String result2 = handler.executeMethod('find_Contacts_for_Account', params2);
    System.debug('Result: ' + result2);
} else {
    System.debug('No accounts found');
}
System.debug('');

System.debug('=== TEST 3: find_Opportunities_for_Account ===');
if (!accounts.isEmpty()) {
    Map<String, Object> params3 = new Map<String, Object>();
    params3.put('accountId', accounts[0].Id);
    String result3 = handler.executeMethod('find_Opportunities_for_Account', params3);
    System.debug('Result: ' + result3);
} else {
    System.debug('No accounts found');
}
System.debug('');

System.debug('=== TEST 4: find_Cases_for_Account ===');
if (!accounts.isEmpty()) {
    Map<String, Object> params4 = new Map<String, Object>();
    params4.put('accountId', accounts[0].Id);
    String result4 = handler.executeMethod('find_Cases_for_Account', params4);
    System.debug('Result: ' + result4);
} else {
    System.debug('No accounts found');
}
