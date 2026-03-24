/**
 * Agentic skills for Sales Task Capture: quick Task create and Account name search.
 * requestParam: create_Task_quick | find_Account_by_Name
 *
 * Diagnostics use System.debug(LoggingLevel.ERROR, …) on purpose: many Debug Levels set
 * "Apex Code" to INFO or WARN, which hides DEBUG and INFO lines. ERROR still appears.
 * Search debug logs for STC_Agentic. If nothing appears, this class did not run (wrong user trace
 * or GPTfy never invoked the agentic function).
 */
public with sharing class SalesTaskCaptureAgenticHandler implements AIAgenticInterface {

    private static final String LOG_PFX = 'STC_Agentic';

    private void logDiag(String msg) {
        System.debug(LoggingLevel.ERROR, LOG_PFX + ' | ' + msg);
    }

    private String err(String msg) {
        logDiag('ERROR | ' + msg);
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => msg
        });
    }

    private String ok(Map<String, Object> body) {
        body.put('success', true);
        body.put('status', 'ok');
        return JSON.serialize(body);
    }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            if (parameters == null) {
                parameters = new Map<String, Object>();
            }
            logDiag(
                'executeMethod ENTER | skill=' + String.valueOf(requestParam)
                    + ' | paramKeys=' + String.valueOf(parameters.keySet())
                    + ' | paramsJson=' + safeJson(parameters)
            );
            switch on requestParam {
                when 'create_Task_quick' {
                    return createTaskQuick(parameters);
                }
                when 'find_Account_by_Name' {
                    return findAccountByName(parameters);
                }
                when else {
                    logDiag('unsupported skill | got=' + String.valueOf(requestParam));
                    return err(
                        'Unsupported skill: ' + requestParam
                        + '. Use create_Task_quick or find_Account_by_Name.'
                    );
                }
            }
        } catch (Exception ex) {
            logDiag(
                'executeMethod EXCEPTION | ' + ex.getMessage() + ' | ' + ex.getStackTraceString()
            );
            return err(ex.getMessage());
        }
    }

    private String createTaskQuick(Map<String, Object> p) {
        logDiag('create_Task_quick START');
        if (!Schema.sObjectType.Task.isCreateable()) {
            return err('Insufficient access to create Task.');
        }
        String subject = stringVal(p.get('subject'));
        if (String.isBlank(subject)) {
            return err('subject is required.');
        }
        Task t = new Task();
        t.Subject = truncate(subject, 255);
        String body = stringVal(p.get('description'));
        if (String.isNotBlank(body)) {
            t.Description = body;
        }
        t.Status = 'Not Started';
        String pri = stringVal(p.get('priority'));
        if (String.isNotBlank(pri) && Schema.sObjectType.Task.fields.Priority.isCreateable()) {
            t.Priority = pri;
        } else {
            t.Priority = 'Normal';
        }
        Date ad = parseFlexibleDate(p.get('activityDate'));
        t.ActivityDate = ad != null ? ad : Date.today();

        String whoId = stringVal(p.get('whoId'));
        if (String.isNotBlank(whoId)) {
            t.WhoId = whoId;
        }

        String whatId = stringVal(p.get('whatId'));
        String accountName = stringVal(p.get('accountName'));
        if (String.isNotBlank(whatId)) {
            t.WhatId = whatId;
        } else if (String.isNotBlank(accountName)) {
            String likeAcc = '%' + accountName + '%';
            List<Account> accMatches = [
                SELECT Id, Name
                FROM Account
                WHERE Name LIKE :likeAcc
                ORDER BY Name
                LIMIT 6
            ];
            if (accMatches.isEmpty()) {
                return err(
                    'No Account found for name "' + accountName
                        + '". Use find_Account_by_Name or ask for a clearer company name or Account Id (001…).'
                );
            }
            if (accMatches.size() > 1) {
                List<String> opts = new List<String>();
                for (Account a : accMatches) {
                    opts.add(a.Name + ' (' + a.Id + ')');
                }
                return err(
                    'Multiple accounts match "' + accountName
                        + '". Ask which Id to use, then call create_Task_quick with whatId. Options: '
                        + String.join(opts, '; ')
                );
            }
            t.WhatId = accMatches[0].Id;
        }
        logDiag(
            'create_Task_quick BEFORE DML | Subject=' + t.Subject
                + ' | ActivityDate=' + String.valueOf(t.ActivityDate)
                + ' | Priority=' + t.Priority
                + ' | WhoId=' + String.valueOf(t.WhoId)
                + ' | WhatId=' + String.valueOf(t.WhatId)
        );
        insert t;
        logDiag('create_Task_quick AFTER DML | TaskId=' + t.Id);
        return ok(new Map<String, Object>{
            'message' => 'Task created.',
            'taskId' => t.Id
        });
    }

    private String findAccountByName(Map<String, Object> p) {
        logDiag('find_Account_by_Name START');
        if (!Schema.sObjectType.Account.isAccessible()) {
            return err('Insufficient access to read Account.');
        }
        String term = stringVal(p.get('name'));
        if (String.isBlank(term)) {
            return err('name is required (search term).');
        }
        Integer lim = 10;
        Object limObj = p.get('limit');
        if (limObj != null) {
            try {
                lim = Integer.valueOf(String.valueOf(limObj));
                if (lim < 1) {
                    lim = 1;
                }
                if (lim > 50) {
                    lim = 50;
                }
            } catch (Exception ignore) {
                lim = 10;
            }
        }
        String likePat = '%' + term + '%';
        List<Account> rows = [
            SELECT Id, Name, Phone, Industry
            FROM Account
            WHERE Name LIKE :likePat
            ORDER BY Name
            LIMIT :lim
        ];
        List<Map<String, Object>> out = new List<Map<String, Object>>();
        for (Account a : rows) {
            out.add(new Map<String, Object>{
                'id' => a.Id,
                'name' => a.Name,
                'phone' => a.Phone,
                'industry' => a.Industry
            });
        }
        logDiag(
            'find_Account_by_Name DONE | term=' + term + ' | rowCount=' + out.size()
        );
        return ok(new Map<String, Object>{
            'message' => 'Accounts found: ' + out.size(),
            'accounts' => out
        });
    }

    /** JSON for logs; truncates very long strings to protect heap/log size. */
    private static String safeJson(Object o) {
        if (o == null) {
            return 'null';
        }
        String j = JSON.serialize(o);
        Integer maxLen = 12000;
        if (j != null && j.length() > maxLen) {
            return j.substring(0, maxLen) + '...<truncated>';
        }
        return j;
    }

    private static String stringVal(Object o) {
        return o == null ? null : String.valueOf(o).trim();
    }

    private static String truncate(String s, Integer maxLen) {
        if (s == null) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    /**
     * YYYY-MM-DD first; then words today / tomorrow / yesterday; short phrases containing those words.
     */
    private static Date parseFlexibleDate(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).trim();
        if (String.isBlank(s)) {
            return null;
        }
        try {
            return Date.valueOf(s);
        } catch (Exception ignore) {
        }
        String lower = s.toLowerCase();
        Date today = Date.today();
        if (lower == 'today') {
            return today;
        }
        if (lower == 'tomorrow') {
            return today.addDays(1);
        }
        if (lower == 'yesterday') {
            return today.addDays(-1);
        }
        if (lower.contains('day after tomorrow')) {
            return today.addDays(2);
        }
        if (s.length() < 48) {
            if (lower.contains('tomorrow')) {
                return today.addDays(1);
            }
            if (lower.contains('today')) {
                return today;
            }
            if (lower.contains('yesterday')) {
                return today.addDays(-1);
            }
        }
        return null;
    }
}
