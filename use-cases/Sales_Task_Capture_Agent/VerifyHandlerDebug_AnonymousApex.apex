// Optional: run to prove handler + logs (sf apex run --file ... --target-org <org>)
// Creates one Task — safe to delete afterward.

SalesTaskCaptureAgenticHandler h = new SalesTaskCaptureAgenticHandler();

String out1 = h.executeMethod(
    'find_Account_by_Name',
    new Map<String, Object>{ 'name' => 'Acme', 'limit' => 3 }
);
System.debug('VerifyHandler find_Account_by_Name: ' + (out1 != null ? out1.substring(0, Math.min(300, out1.length())) : 'null'));

String out2 = h.executeMethod(
    'create_Task_quick',
    new Map<String, Object>{
        'subject' => 'Verify handler - delete me',
        'activityDate' => 'tomorrow',
        'accountName' => 'Acme',
        'description' => 'VerifyHandlerDebug_AnonymousApex'
    }
);
System.debug('VerifyHandler create_Task_quick: ' + (out2 != null ? out2.substring(0, Math.min(400, out2.length())) : 'null'));
