/**
 * @description
 *   AccountIntelligenceHandler implements the AIAgenticInterface and serves as a multi-operation
 *   handler for account intelligence operations. Supports finding accounts by name and retrieving
 *   all related records including contacts, opportunities, and cases. Provides comprehensive
 *   account information with proper validation, access control, and standardized responses.
 *
 *   Supported Operations:
 *   - find_Account_by_Name: Finds account records by name with fuzzy matching
 *   - find_Contacts_for_Account: Retrieves contacts for a specific account
 *   - find_Opportunities_for_Account: Retrieves opportunities for a specific account
 *   - find_Cases_for_Account: Retrieves cases for a specific account
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 12-22-2025
 * @last modified by    : Claude
 */
global with sharing class AccountIntelligenceHandler implements ccai.AIAgenticInterface {

    // SECTION 1: Permission Check Method
    global Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(sObjectName).getDescribe();
        if (permType == 'read')      return describeResult.isAccessible();
        if (permType == 'create')    return describeResult.isCreateable();
        if (permType == 'update')    return describeResult.isUpdateable();
        if (permType == 'delete')    return describeResult.isDeletable();
        return false;
    }

    // SECTION 2: Error Response Methods
    private String errorResponse(Exception ex) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => ex.getMessage(),
            'stackTrace' => ex.getStackTraceString()
        });
    }

    private String errorResponse(String message) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => message
        });
    }

    // SECTION 3: Request Dispatcher - Multiple Operations
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== AccountIntelligenceHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        String response = '';
        try {
            switch on requestParam {
                when 'find_Account_by_Name' {
                    response = findAccountByName(parameters);
                }
                when 'find_Contacts_for_Account' {
                    response = findContactsForAccount(parameters);
                }
                when 'find_Opportunities_for_Account' {
                    response = findOpportunitiesForAccount(parameters);
                }
                when 'find_Cases_for_Account' {
                    response = findCasesForAccount(parameters);
                }
                when else {
                    response = errorResponse('Method is not defined. Supported methods: find_Account_by_Name, find_Contacts_for_Account, find_Opportunities_for_Account, find_Cases_for_Account');
                }
            }
        } catch (Exception ex) {
            response = errorResponse(ex);
        }

        // DEBUG: Log response status
        Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(response);
        System.debug('Response Status: ' + responseMap.get('status'));
        System.debug('Response Success: ' + responseMap.get('success'));
        System.debug('=== AccountIntelligenceHandler END ===');

        return response;
    }

    // SECTION 4: Implementation Methods

    /**
     * @description
     *   Finds Account records by name using fuzzy matching (LIKE search).
     *   Returns account details including ID for subsequent related object queries.
     * @param parameters   Map containing:
     *                     - 'accountName' (Required): Account name or partial name
     *                     - 'limit' (Optional): Maximum number of results (default: 10)
     * @return String      JSON response with success status, account list, and count.
     */
    public String findAccountByName(Map<String, Object> parameters) {
        // Check read permission on Account object
        if (!hasObjectPerm('Account', 'read')) {
            return errorResponse('Insufficient read permission on Account object.');
        }

        try {
            // Validate required parameter: accountName
            if (!parameters.containsKey('accountName') ||
                String.isBlank(String.valueOf(parameters.get('accountName')))) {
                return errorResponse('accountName is required.');
            }

            String accountName = String.valueOf(parameters.get('accountName')).trim();

            // Get limit (default to 10)
            Integer resultLimit = 10;
            if (parameters.containsKey('limit') && parameters.get('limit') != null) {
                Object limitValue = parameters.get('limit');
                if (limitValue instanceof Integer) {
                    resultLimit = (Integer) limitValue;
                } else {
                    resultLimit = Integer.valueOf(String.valueOf(limitValue));
                }
            }

            // Validate limit range
            if (resultLimit < 1 || resultLimit > 100) {
                return errorResponse('limit must be between 1 and 100.');
            }

            // Use fuzzy search strategy: SOSL first (handles typos), fallback to SOQL LIKE
            List<Account> accounts = fuzzySearchAccounts(accountName, resultLimit);

            if (accounts.isEmpty()) {
                return JSON.serialize(new Map<String, Object>{
                    'success' => true,
                    'status' => 'success',
                    'message' => 'No accounts found with name matching: ' + accountName,
                    'count' => 0,
                    'accounts' => new List<Object>()
                });
            }

            // Build response with account details
            List<Map<String, Object>> accountDetails = new List<Map<String, Object>>();

            // Get base URL once, with null safety
            String baseUrl = '';
            try {
                System.Url orgUrl = URL.getOrgDomainUrl();
                if (orgUrl != null) {
                    baseUrl = orgUrl.toExternalForm();
                }
            } catch (Exception urlEx) {
                System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
            }

            for (Account acc : accounts) {
                // Safely get owner name
                String ownerName = null;
                if (acc.Owner != null && acc.Owner.Name != null) {
                    ownerName = acc.Owner.Name;
                }

                // Build record URL
                String recordUrl = '';
                if (String.isNotBlank(baseUrl) && acc.Id != null) {
                    recordUrl = baseUrl + '/' + acc.Id;
                }

                accountDetails.add(new Map<String, Object>{
                    'Id' => acc.Id,
                    'Name' => acc.Name,
                    'Type' => acc.Type,
                    'Industry' => acc.Industry,
                    'AnnualRevenue' => acc.AnnualRevenue,
                    'Phone' => acc.Phone,
                    'Website' => acc.Website,
                    'BillingCity' => acc.BillingCity,
                    'BillingState' => acc.BillingState,
                    'BillingCountry' => acc.BillingCountry,
                    'OwnerName' => ownerName,
                    'CreatedDate' => acc.CreatedDate,
                    'recordUrl' => recordUrl
                });
            }

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + accounts.size() + ' account(s) matching: ' + accountName,
                'count' => accounts.size(),
                'searchTerm' => accountName,
                'accounts' => accountDetails,
                'primaryAccountId' => accounts[0].Id,
                'primaryAccountName' => accounts[0].Name
            });

        } catch (QueryException qEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'Query Error: ' + qEx.getMessage()
            });
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    /**
     * @description
     *   Finds Contact records for a specific account. Accepts either accountId or accountName.
     *   Returns contact details including email, phone, and title.
     * @param parameters   Map containing:
     *                     - 'accountId' (Optional): Account Salesforce ID
     *                     - 'accountName' (Optional): Account name for lookup
     *                     At least one of accountId or accountName must be provided.
     * @return String      JSON response with success status, contact list, and count.
     */
    public String findContactsForAccount(Map<String, Object> parameters) {
        // Check read permissions
        if (!hasObjectPerm('Account', 'read')) {
            return errorResponse('Insufficient read permission on Account object.');
        }
        if (!hasObjectPerm('Contact', 'read')) {
            return errorResponse('Insufficient read permission on Contact object.');
        }

        try {
            // Resolve accountId from parameters
            String accountId = resolveAccountId(parameters);
            if (accountId == null) {
                return errorResponse('Either accountId or accountName is required.');
            }

            // Validate Account ID format
            if (!isValidId(accountId) || !accountId.startsWith('001')) {
                return errorResponse('Invalid Account ID format. Must be 15 or 18 characters starting with 001.');
            }

            // Query account to verify it exists
            List<Account> accounts = [
                SELECT Id, Name
                FROM Account
                WHERE Id = :accountId
                LIMIT 1
            ];

            if (accounts.isEmpty()) {
                return errorResponse('Account not found with ID: ' + accountId);
            }

            Account account = accounts[0];

            // Query contacts for this account
            List<Contact> contacts = [
                SELECT Id, Name, Title, Email, Phone, MobilePhone,
                       Department, MailingCity, MailingState,
                       MailingCountry, CreatedDate
                FROM Contact
                WHERE AccountId = :accountId
                ORDER BY Name
            ];

            // Build response with contact details
            List<Map<String, Object>> contactDetails = new List<Map<String, Object>>();

            // Get base URL once, with null safety
            String baseUrl = '';
            try {
                System.Url orgUrl = URL.getOrgDomainUrl();
                if (orgUrl != null) {
                    baseUrl = orgUrl.toExternalForm();
                }
            } catch (Exception urlEx) {
                System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
            }

            for (Contact con : contacts) {
                // Build record URL
                String recordUrl = '';
                if (String.isNotBlank(baseUrl) && con.Id != null) {
                    recordUrl = baseUrl + '/' + con.Id;
                }

                contactDetails.add(new Map<String, Object>{
                    'Id' => con.Id,
                    'Name' => con.Name,
                    'Title' => con.Title,
                    'Email' => con.Email,
                    'Phone' => con.Phone,
                    'MobilePhone' => con.MobilePhone,
                    'Department' => con.Department,
                    'MailingCity' => con.MailingCity,
                    'MailingState' => con.MailingState,
                    'MailingCountry' => con.MailingCountry,
                    'CreatedDate' => con.CreatedDate,
                    'recordUrl' => recordUrl
                });
            }

            // Build account URL
            String accountUrl = '';
            if (String.isNotBlank(baseUrl) && account.Id != null) {
                accountUrl = baseUrl + '/' + account.Id;
            }

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + contacts.size() + ' contact(s) for account: ' + account.Name,
                'count' => contacts.size(),
                'accountId' => account.Id,
                'accountName' => account.Name,
                'contacts' => contactDetails,
                'accountUrl' => accountUrl
            });

        } catch (QueryException qEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'Query Error: ' + qEx.getMessage()
            });
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    /**
     * @description
     *   Finds Opportunity records for a specific account. Accepts either accountId or accountName.
     *   Returns opportunity details including stage, amount, probability, and close date.
     * @param parameters   Map containing:
     *                     - 'accountId' (Optional): Account Salesforce ID
     *                     - 'accountName' (Optional): Account name for lookup
     *                     - 'includeClosedWon' (Optional): Include closed won opportunities (default: true)
     *                     - 'includeClosedLost' (Optional): Include closed lost opportunities (default: false)
     *                     At least one of accountId or accountName must be provided.
     * @return String      JSON response with success status, opportunity list, and metrics.
     */
    public String findOpportunitiesForAccount(Map<String, Object> parameters) {
        // Check read permissions
        if (!hasObjectPerm('Account', 'read')) {
            return errorResponse('Insufficient read permission on Account object.');
        }
        if (!hasObjectPerm('Opportunity', 'read')) {
            return errorResponse('Insufficient read permission on Opportunity object.');
        }

        try {
            // Resolve accountId from parameters
            String accountId = resolveAccountId(parameters);
            if (accountId == null) {
                return errorResponse('Either accountId or accountName is required.');
            }

            // Validate Account ID format
            if (!isValidId(accountId) || !accountId.startsWith('001')) {
                return errorResponse('Invalid Account ID format. Must be 15 or 18 characters starting with 001.');
            }

            // Get filter flags
            Boolean includeClosedWon = true;
            if (parameters.containsKey('includeClosedWon') && parameters.get('includeClosedWon') != null) {
                includeClosedWon = Boolean.valueOf(parameters.get('includeClosedWon'));
            }

            Boolean includeClosedLost = false;
            if (parameters.containsKey('includeClosedLost') && parameters.get('includeClosedLost') != null) {
                includeClosedLost = Boolean.valueOf(parameters.get('includeClosedLost'));
            }

            // Query account to verify it exists
            List<Account> accounts = [
                SELECT Id, Name
                FROM Account
                WHERE Id = :accountId
                LIMIT 1
            ];

            if (accounts.isEmpty()) {
                return errorResponse('Account not found with ID: ' + accountId);
            }

            Account account = accounts[0];

            // Build SOQL query based on filters
            String query = 'SELECT Id, Name, StageName, Amount, Probability, ' +
                          'CloseDate, Type, LeadSource, Owner.Name, CreatedDate, ' +
                          'IsClosed, IsWon ' +
                          'FROM Opportunity ' +
                          'WHERE AccountId = :accountId';

            // Add stage filters
            if (!includeClosedWon || !includeClosedLost) {
                List<String> conditions = new List<String>();
                if (!includeClosedWon) {
                    conditions.add('IsWon = false');
                }
                if (!includeClosedLost) {
                    conditions.add('(IsClosed = false OR IsWon = true)');
                }
                if (!conditions.isEmpty()) {
                    query += ' AND (' + String.join(conditions, ' OR ') + ')';
                }
            }

            query += ' ORDER BY CloseDate DESC, Amount DESC NULLS LAST';

            List<Opportunity> opportunities = Database.query(query);

            // Calculate metrics
            Decimal totalAmount = 0;
            Decimal openAmount = 0;
            Decimal wonAmount = 0;
            Integer openCount = 0;
            Integer wonCount = 0;
            Integer lostCount = 0;

            for (Opportunity opp : opportunities) {
                if (opp.Amount != null) {
                    totalAmount += opp.Amount;
                    if (opp.IsWon) {
                        wonAmount += opp.Amount;
                    } else if (!opp.IsClosed) {
                        openAmount += opp.Amount;
                    }
                }
                if (opp.IsWon) {
                    wonCount++;
                } else if (opp.IsClosed) {
                    lostCount++;
                } else {
                    openCount++;
                }
            }

            // Build response with opportunity details
            List<Map<String, Object>> opportunityDetails = new List<Map<String, Object>>();

            // Get base URL once, with null safety
            String baseUrl = '';
            try {
                System.Url orgUrl = URL.getOrgDomainUrl();
                if (orgUrl != null) {
                    baseUrl = orgUrl.toExternalForm();
                }
            } catch (Exception urlEx) {
                System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
            }

            for (Opportunity opp : opportunities) {
                // Safely get owner name
                String ownerName = null;
                if (opp.Owner != null && opp.Owner.Name != null) {
                    ownerName = opp.Owner.Name;
                }

                // Build record URL
                String recordUrl = '';
                if (String.isNotBlank(baseUrl) && opp.Id != null) {
                    recordUrl = baseUrl + '/' + opp.Id;
                }

                opportunityDetails.add(new Map<String, Object>{
                    'Id' => opp.Id,
                    'Name' => opp.Name,
                    'StageName' => opp.StageName,
                    'Amount' => opp.Amount,
                    'Probability' => opp.Probability,
                    'CloseDate' => opp.CloseDate,
                    'Type' => opp.Type,
                    'LeadSource' => opp.LeadSource,
                    'OwnerName' => ownerName,
                    'IsClosed' => opp.IsClosed,
                    'IsWon' => opp.IsWon,
                    'CreatedDate' => opp.CreatedDate,
                    'recordUrl' => recordUrl
                });
            }

            // Build account URL
            String accountUrl = '';
            if (String.isNotBlank(baseUrl) && account.Id != null) {
                accountUrl = baseUrl + '/' + account.Id;
            }

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + opportunities.size() + ' opportunit(ies) for account: ' + account.Name,
                'count' => opportunities.size(),
                'accountId' => account.Id,
                'accountName' => account.Name,
                'opportunities' => opportunityDetails,
                'metrics' => new Map<String, Object>{
                    'totalPipelineValue' => totalAmount,
                    'openPipelineValue' => openAmount,
                    'wonAmount' => wonAmount,
                    'openCount' => openCount,
                    'wonCount' => wonCount,
                    'lostCount' => lostCount
                },
                'accountUrl' => accountUrl
            });

        } catch (QueryException qEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'Query Error: ' + qEx.getMessage()
            });
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    /**
     * @description
     *   Finds Case records for a specific account. Accepts either accountId or accountName.
     *   Returns case details including status, priority, subject, and owner.
     * @param parameters   Map containing:
     *                     - 'accountId' (Optional): Account Salesforce ID
     *                     - 'accountName' (Optional): Account name for lookup
     *                     - 'includeClosed' (Optional): Include closed cases (default: false)
     *                     At least one of accountId or accountName must be provided.
     * @return String      JSON response with success status, case list, and metrics.
     */
    public String findCasesForAccount(Map<String, Object> parameters) {
        // Check read permissions
        if (!hasObjectPerm('Account', 'read')) {
            return errorResponse('Insufficient read permission on Account object.');
        }
        if (!hasObjectPerm('Case', 'read')) {
            return errorResponse('Insufficient read permission on Case object.');
        }

        try {
            // Resolve accountId from parameters
            String accountId = resolveAccountId(parameters);
            if (accountId == null) {
                return errorResponse('Either accountId or accountName is required.');
            }

            // Validate Account ID format
            if (!isValidId(accountId) || !accountId.startsWith('001')) {
                return errorResponse('Invalid Account ID format. Must be 15 or 18 characters starting with 001.');
            }

            // Get includeClosed flag
            Boolean includeClosed = false;
            if (parameters.containsKey('includeClosed') && parameters.get('includeClosed') != null) {
                includeClosed = Boolean.valueOf(parameters.get('includeClosed'));
            }

            // Query account to verify it exists
            List<Account> accounts = [
                SELECT Id, Name
                FROM Account
                WHERE Id = :accountId
                LIMIT 1
            ];

            if (accounts.isEmpty()) {
                return errorResponse('Account not found with ID: ' + accountId);
            }

            Account account = accounts[0];

            // Build SOQL query
            String query = 'SELECT Id, CaseNumber, Subject, Status, Priority, ' +
                          'Origin, Type, Reason, Owner.Name, CreatedDate, ' +
                          'ClosedDate, IsClosed ' +
                          'FROM Case ' +
                          'WHERE AccountId = :accountId';

            if (!includeClosed) {
                query += ' AND IsClosed = false';
            }

            query += ' ORDER BY CreatedDate DESC';

            List<Case> cases = Database.query(query);

            // Calculate metrics
            Integer openCount = 0;
            Integer closedCount = 0;
            Map<String, Integer> statusCounts = new Map<String, Integer>();
            Map<String, Integer> priorityCounts = new Map<String, Integer>();

            for (Case c : cases) {
                if (c.IsClosed) {
                    closedCount++;
                } else {
                    openCount++;
                }

                // Count by status
                String status = c.Status != null ? c.Status : 'Unknown';
                statusCounts.put(status, statusCounts.containsKey(status) ? statusCounts.get(status) + 1 : 1);

                // Count by priority
                String priority = c.Priority != null ? c.Priority : 'Unknown';
                priorityCounts.put(priority, priorityCounts.containsKey(priority) ? priorityCounts.get(priority) + 1 : 1);
            }

            // Build response with case details
            List<Map<String, Object>> caseDetails = new List<Map<String, Object>>();

            // Get base URL once, with null safety
            String baseUrl = '';
            try {
                System.Url orgUrl = URL.getOrgDomainUrl();
                if (orgUrl != null) {
                    baseUrl = orgUrl.toExternalForm();
                }
            } catch (Exception urlEx) {
                System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
            }

            for (Case c : cases) {
                // Safely get owner name
                String ownerName = null;
                if (c.Owner != null && c.Owner.Name != null) {
                    ownerName = c.Owner.Name;
                }

                // Build record URL
                String recordUrl = '';
                if (String.isNotBlank(baseUrl) && c.Id != null) {
                    recordUrl = baseUrl + '/' + c.Id;
                }

                caseDetails.add(new Map<String, Object>{
                    'Id' => c.Id,
                    'CaseNumber' => c.CaseNumber,
                    'Subject' => c.Subject,
                    'Status' => c.Status,
                    'Priority' => c.Priority,
                    'Origin' => c.Origin,
                    'Type' => c.Type,
                    'Reason' => c.Reason,
                    'OwnerName' => ownerName,
                    'CreatedDate' => c.CreatedDate,
                    'ClosedDate' => c.ClosedDate,
                    'IsClosed' => c.IsClosed,
                    'recordUrl' => recordUrl
                });
            }

            // Build account URL
            String accountUrl = '';
            if (String.isNotBlank(baseUrl) && account.Id != null) {
                accountUrl = baseUrl + '/' + account.Id;
            }

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + cases.size() + ' case(s) for account: ' + account.Name,
                'count' => cases.size(),
                'accountId' => account.Id,
                'accountName' => account.Name,
                'cases' => caseDetails,
                'metrics' => new Map<String, Object>{
                    'openCount' => openCount,
                    'closedCount' => closedCount,
                    'statusBreakdown' => statusCounts,
                    'priorityBreakdown' => priorityCounts
                },
                'accountUrl' => accountUrl
            });

        } catch (QueryException qEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'Query Error: ' + qEx.getMessage()
            });
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    // SECTION 5: Shared Helper Methods

    /**
     * @description
     *   Resolves an accountId from parameters. Accepts either accountId directly
     *   or accountName which is looked up via SOQL.
     * @param parameters   Map containing either 'accountId' or 'accountName'
     * @return String      The resolved Account ID, or null if neither provided or not found
     */
    private String resolveAccountId(Map<String, Object> parameters) {
        String accountId = null;

        // If accountId provided, use it
        if (parameters.containsKey('accountId') &&
            String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
            accountId = String.valueOf(parameters.get('accountId')).trim();
        }
        // Otherwise, look up by name using fuzzy search
        else if (parameters.containsKey('accountName') &&
                 String.isNotBlank(String.valueOf(parameters.get('accountName')))) {
            String accountName = String.valueOf(parameters.get('accountName')).trim();
            List<Account> accounts = fuzzySearchAccounts(accountName, 1);
            if (!accounts.isEmpty()) {
                accountId = accounts[0].Id;
            }
        }

        return accountId;
    }

    /**
     * @description
     *   Performs fuzzy account search using SOSL (for typo tolerance) with fallback to SOQL LIKE.
     *   This method handles misspellings like "gaslume" finding "Galume Energy".
     * @param searchTerm   The account name or partial name to search for
     * @param resultLimit  Maximum number of results to return
     * @return List<Account> List of matching account records
     */
    private List<Account> fuzzySearchAccounts(String searchTerm, Integer resultLimit) {
        System.debug('>>> fuzzySearchAccounts START');
        System.debug('Search Term: ' + searchTerm);
        System.debug('Result Limit: ' + resultLimit);

        List<Account> accounts = new List<Account>();

        // Strategy 1: Try SOSL for fuzzy matching
        try {
            String soslSearchTerm = searchTerm + '*';
            System.debug('SOSL Search Term: ' + soslSearchTerm);

            List<List<SObject>> searchResults = [
                FIND :soslSearchTerm IN NAME FIELDS
                RETURNING Account(
                    Id, Name, Type, Industry, AnnualRevenue,
                    Phone, Website, BillingCity, BillingState,
                    BillingCountry, Owner.Name, CreatedDate
                    ORDER BY Name
                    LIMIT :resultLimit
                )
            ];

            System.debug('SOSL Results Count: ' + (searchResults.isEmpty() ? 0 : searchResults[0].size()));

            if (!searchResults.isEmpty() && !searchResults[0].isEmpty()) {
                accounts = (List<Account>) searchResults[0];
                System.debug('SOSL Found ' + accounts.size() + ' accounts');
                for (Account acc : accounts) {
                    System.debug('  - ' + acc.Name + ' (Id: ' + acc.Id + ')');
                }
            } else {
                System.debug('SOSL returned no results');
            }
        } catch (Exception soslEx) {
            System.debug('SOSL FAILED: ' + soslEx.getMessage());
            System.debug('SOSL Stack Trace: ' + soslEx.getStackTraceString());
        }

        // Strategy 2: Fallback to SOQL LIKE if SOSL returned no results
        if (accounts.isEmpty()) {
            System.debug('Trying SOQL LIKE fallback...');
            try {
                String searchPattern = '%' + searchTerm + '%';
                System.debug('SOQL Pattern: ' + searchPattern);

                accounts = [
                    SELECT Id, Name, Type, Industry, AnnualRevenue,
                           Phone, Website, BillingCity, BillingState,
                           BillingCountry, Owner.Name, CreatedDate
                    FROM Account
                    WHERE Name LIKE :searchPattern
                    ORDER BY Name
                    LIMIT :resultLimit
                ];

                System.debug('SOQL Found ' + accounts.size() + ' accounts');
                for (Account acc : accounts) {
                    System.debug('  - ' + acc.Name + ' (Id: ' + acc.Id + ')');
                }
            } catch (Exception soqlEx) {
                System.debug('SOQL FAILED: ' + soqlEx.getMessage());
                System.debug('SOQL Stack Trace: ' + soqlEx.getStackTraceString());
            }
        }

        System.debug('<<< fuzzySearchAccounts END - Returning ' + accounts.size() + ' accounts');
        return accounts;
    }

    /**
     * @description
     *   Validates a Salesforce record ID format (15 or 18 characters, alphanumeric).
     * @param recordId   The ID string to validate
     * @return Boolean   True if valid ID format, false otherwise
     */
    private Boolean isValidId(String recordId) {
        if (String.isBlank(recordId)) {
            return false;
        }
        Integer idLength = recordId.length();
        if (idLength != 15 && idLength != 18) {
            return false;
        }
        return recordId.isAlphanumeric();
    }
}
