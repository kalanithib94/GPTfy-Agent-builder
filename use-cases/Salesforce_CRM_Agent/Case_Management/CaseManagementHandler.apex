/**
 * CaseManagementHandler
 * Handler for creating and updating Case records via AI Agent
 *
 * Operations:
 * 1. create_Case - Create new case with comprehensive field support
 * 2. update_Case - Update existing case fields
 */
global with sharing class CaseManagementHandler implements ccai.AIAgenticInterface {

    // Permission checking required by interface
    global Boolean hasObjectPerm(String sObjectName, String permType) {
        try {
            Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(sObjectName).getDescribe();

            if (permType == 'create') {
                return describeResult.isCreateable();
            } else if (permType == 'update') {
                return describeResult.isUpdateable();
            } else if (permType == 'read') {
                return describeResult.isAccessible();
            } else if (permType == 'delete') {
                return describeResult.isDeletable();
            }

            return false;
        } catch (Exception e) {
            System.debug('Permission check error: ' + e.getMessage());
            return false;
        }
    }

    /**
     * Main entry point for all Case operations
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== CaseManagementHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;

            switch on requestParam {
                when 'create_Case', 'create_Case_on_Account' {
                    System.debug('DEBUG: Routing to createCase method');
                    result = createCase(parameters);
                }
                when 'update_Case', 'update_Case_on_Account' {
                    System.debug('DEBUG: Routing to updateCase method');
                    result = updateCase(parameters);
                }
                when else {
                    System.debug('ERROR: Unknown operation requested: ' + requestParam);
                    result = buildErrorResponse('Unknown operation: ' + requestParam);
                }
            }

            System.debug('=== CaseManagementHandler END ===');
            System.debug('Result: ' + result);
            return result;

        } catch (Exception e) {
            System.debug('ERROR in executeMethod: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    /**
     * CREATE CASE
     * Creates a new Case record with provided fields
     */
    private String createCase(Map<String, Object> parameters) {
        System.debug('--- Creating Case ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Case', 'create')) {
                return buildErrorResponse('You do not have permission to create Cases');
            }

            // Build Case record
            Case newCase = new Case();

            // Subject (most common field)
            if (parameters.containsKey('subject')) {
                newCase.Subject = String.valueOf(parameters.get('subject'));
            }

            // Description
            if (parameters.containsKey('description')) {
                newCase.Description = String.valueOf(parameters.get('description'));
            }

            // Status
            if (parameters.containsKey('status')) {
                newCase.Status = String.valueOf(parameters.get('status'));
            }

            // Priority
            if (parameters.containsKey('priority')) {
                newCase.Priority = String.valueOf(parameters.get('priority'));
            }

            // Origin (Web, Email, Phone, etc.)
            if (parameters.containsKey('origin')) {
                newCase.Origin = String.valueOf(parameters.get('origin'));
            }

            // Type (Problem, Question, Feature Request, etc.)
            if (parameters.containsKey('type')) {
                newCase.Type = String.valueOf(parameters.get('type'));
            }

            // Reason
            if (parameters.containsKey('reason')) {
                newCase.Reason = String.valueOf(parameters.get('reason'));
            }

            // Supplied fields (for Web-to-Case, Email-to-Case)
            if (parameters.containsKey('suppliedName')) {
                newCase.SuppliedName = String.valueOf(parameters.get('suppliedName'));
            }
            if (parameters.containsKey('suppliedEmail')) {
                newCase.SuppliedEmail = String.valueOf(parameters.get('suppliedEmail'));
            }
            if (parameters.containsKey('suppliedPhone')) {
                newCase.SuppliedPhone = String.valueOf(parameters.get('suppliedPhone'));
            }
            if (parameters.containsKey('suppliedCompany')) {
                newCase.SuppliedCompany = String.valueOf(parameters.get('suppliedCompany'));
            }

            // Account lookup
            if (parameters.containsKey('accountId')) {
                newCase.AccountId = String.valueOf(parameters.get('accountId'));
            } else if (parameters.containsKey('accountName')) {
                String accountName = String.valueOf(parameters.get('accountName'));
                Id accountId = lookupAccountByName(accountName);
                if (accountId != null) {
                    newCase.AccountId = accountId;
                } else {
                    return buildErrorResponse('Account not found with name: ' + accountName + '. Please use find_Account_by_Name first to get the correct account.');
                }
            }

            // Contact lookup
            if (parameters.containsKey('contactId')) {
                newCase.ContactId = String.valueOf(parameters.get('contactId'));
            } else if (parameters.containsKey('contactEmail')) {
                String contactEmail = String.valueOf(parameters.get('contactEmail'));
                Id contactId = lookupContactByEmail(contactEmail);
                if (contactId != null) {
                    newCase.ContactId = contactId;
                }
            }

            // Owner assignment
            if (parameters.containsKey('ownerId')) {
                newCase.OwnerId = String.valueOf(parameters.get('ownerId'));
            }

            System.debug('Case to insert: ' + JSON.serializePretty(newCase));

            // Insert the case
            insert newCase;

            System.debug('Case created successfully: ' + newCase.Id);

            // Query back the full record
            Case createdCase = [
                SELECT Id, CaseNumber, Subject, Description, Status, Priority,
                       Origin, Type, Reason, CreatedDate, Account.Name, Contact.Name,
                       Owner.Name, IsClosed, IsEscalated
                FROM Case
                WHERE Id = :newCase.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Case created successfully',
                new Map<String, Object>{
                    'caseId' => createdCase.Id,
                    'caseNumber' => createdCase.CaseNumber,
                    'subject' => createdCase.Subject,
                    'description' => createdCase.Description,
                    'status' => createdCase.Status,
                    'priority' => createdCase.Priority,
                    'origin' => createdCase.Origin,
                    'type' => createdCase.Type,
                    'reason' => createdCase.Reason,
                    'accountName' => createdCase.Account?.Name,
                    'contactName' => createdCase.Contact?.Name,
                    'ownerName' => createdCase.Owner?.Name,
                    'createdDate' => createdCase.CreatedDate,
                    'isClosed' => createdCase.IsClosed,
                    'isEscalated' => createdCase.IsEscalated
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error creating case: ' + e.getMessage());
            return buildErrorResponse('Failed to create case: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error creating case: ' + e.getMessage());
            return buildErrorResponse('Failed to create case: ' + e.getMessage());
        }
    }

    /**
     * UPDATE CASE
     * Updates an existing Case record
     */
    private String updateCase(Map<String, Object> parameters) {
        System.debug('--- Updating Case ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Case', 'update')) {
                return buildErrorResponse('You do not have permission to update Cases');
            }

            // Get Case ID - support multiple lookup methods
            Id caseId = null;

            if (parameters.containsKey('caseId') && parameters.get('caseId') != null && String.isNotBlank(String.valueOf(parameters.get('caseId')))) {
                System.debug('DEBUG: Looking up case by caseId');
                caseId = (Id) String.valueOf(parameters.get('caseId'));
                System.debug('DEBUG: caseId = ' + caseId);
            } else if (parameters.containsKey('caseNumber') && parameters.get('caseNumber') != null && String.isNotBlank(String.valueOf(parameters.get('caseNumber')))) {
                System.debug('DEBUG: Looking up case by caseNumber');
                String caseNumber = String.valueOf(parameters.get('caseNumber'));
                System.debug('DEBUG: caseNumber = ' + caseNumber);
                List<Case> cases = [SELECT Id FROM Case WHERE CaseNumber = :caseNumber LIMIT 1];
                if (!cases.isEmpty()) {
                    caseId = cases[0].Id;
                    System.debug('DEBUG: Found case: ' + caseId);
                } else {
                    return buildErrorResponse('Case not found with number: ' + caseNumber);
                }
            } else if (parameters.containsKey('subject') && parameters.get('subject') != null && String.isNotBlank(String.valueOf(parameters.get('subject')))) {
                System.debug('DEBUG: Looking up case by partial subject match');
                String partialSubject = String.valueOf(parameters.get('subject'));
                String searchPattern = '%' + partialSubject + '%';
                System.debug('DEBUG: searchPattern = ' + searchPattern);

                // If accountId provided, search within that account (accountId provides context)
                if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                    System.debug('DEBUG: Filtering by accountId for context');
                    String accountIdStr = String.valueOf(parameters.get('accountId'));
                    System.debug('DEBUG: accountId = ' + accountIdStr);
                    List<Case> cases = [
                        SELECT Id
                        FROM Case
                        WHERE Subject LIKE :searchPattern
                        AND AccountId = :accountIdStr
                        ORDER BY CreatedDate DESC
                        LIMIT 1
                    ];
                    if (!cases.isEmpty()) {
                        caseId = cases[0].Id;
                        System.debug('DEBUG: Found case under account: ' + caseId);
                    } else {
                        return buildErrorResponse('Case not found with subject containing "' + partialSubject + '" under the specified account');
                    }
                } else {
                    // Search by subject only
                    System.debug('DEBUG: Searching by subject without account filter');
                    List<Case> cases = [
                        SELECT Id
                        FROM Case
                        WHERE Subject LIKE :searchPattern
                        ORDER BY CreatedDate DESC
                        LIMIT 1
                    ];
                    if (!cases.isEmpty()) {
                        caseId = cases[0].Id;
                        System.debug('DEBUG: Found case: ' + caseId);
                    } else {
                        return buildErrorResponse('Case not found with subject containing: ' + partialSubject);
                    }
                }
            } else {
                return buildErrorResponse('Either caseId, caseNumber, or subject is required to find the case');
            }

            // Validate that we found a caseId
            if (caseId == null) {
                return buildErrorResponse('Failed to determine caseId for update');
            }
            System.debug('DEBUG: Final caseId for update: ' + caseId);

            // Query existing case to ensure it exists
            List<Case> existingCases = [
                SELECT Id, Subject, Description, Status, Priority, Origin, Type, Reason,
                       AccountId, ContactId, OwnerId
                FROM Case
                WHERE Id = :caseId
                LIMIT 1
            ];

            if (existingCases.isEmpty()) {
                return buildErrorResponse('Case not found with ID: ' + caseId);
            }

            Case caseToUpdate = existingCases[0];
            Boolean hasChanges = false;

            // Update Subject
            // Use newSubject if provided (for updating subject when 'subject' was used for lookup)
            // Otherwise use 'subject' only if caseId or caseNumber was provided (not used for lookup)
            if (parameters.containsKey('newSubject')) {
                caseToUpdate.Subject = String.valueOf(parameters.get('newSubject'));
                hasChanges = true;
            } else if (parameters.containsKey('subject') &&
                      (parameters.containsKey('caseId') || parameters.containsKey('caseNumber'))) {
                // Only update subject if we didn't use it for lookup
                caseToUpdate.Subject = String.valueOf(parameters.get('subject'));
                hasChanges = true;
            }

            // Update Description
            if (parameters.containsKey('description')) {
                caseToUpdate.Description = String.valueOf(parameters.get('description'));
                hasChanges = true;
            }

            // Update Status
            if (parameters.containsKey('status')) {
                caseToUpdate.Status = String.valueOf(parameters.get('status'));
                hasChanges = true;
            }

            // Update Priority
            if (parameters.containsKey('priority')) {
                caseToUpdate.Priority = String.valueOf(parameters.get('priority'));
                hasChanges = true;
            }

            // Update Origin
            if (parameters.containsKey('origin')) {
                caseToUpdate.Origin = String.valueOf(parameters.get('origin'));
                hasChanges = true;
            }

            // Update Type
            if (parameters.containsKey('type')) {
                caseToUpdate.Type = String.valueOf(parameters.get('type'));
                hasChanges = true;
            }

            // Update Reason
            if (parameters.containsKey('reason')) {
                caseToUpdate.Reason = String.valueOf(parameters.get('reason'));
                hasChanges = true;
            }

            // Note: accountId in update parameters is used for LOOKUP, not for changing the account
            // Account changes are not supported in case updates to maintain data integrity

            // Update Contact
            if (parameters.containsKey('contactId') && parameters.get('contactId') != null && String.isNotBlank(String.valueOf(parameters.get('contactId')))) {
                caseToUpdate.ContactId = String.valueOf(parameters.get('contactId'));
                hasChanges = true;
            } else if (parameters.containsKey('contactEmail') && parameters.get('contactEmail') != null && String.isNotBlank(String.valueOf(parameters.get('contactEmail')))) {
                String contactEmail = String.valueOf(parameters.get('contactEmail'));
                Id contactId = lookupContactByEmail(contactEmail);
                if (contactId != null) {
                    caseToUpdate.ContactId = contactId;
                    hasChanges = true;
                }
            }

            // Update Owner
            if (parameters.containsKey('ownerId') && parameters.get('ownerId') != null && String.isNotBlank(String.valueOf(parameters.get('ownerId')))) {
                caseToUpdate.OwnerId = String.valueOf(parameters.get('ownerId'));
                hasChanges = true;
            }

            if (!hasChanges) {
                return buildErrorResponse('No fields provided to update');
            }

            System.debug('Case to update: ' + JSON.serializePretty(caseToUpdate));

            // Update the case
            update caseToUpdate;

            System.debug('Case updated successfully: ' + caseToUpdate.Id);

            // Query back the full record
            Case updatedCase = [
                SELECT Id, CaseNumber, Subject, Description, Status, Priority,
                       Origin, Type, Reason, LastModifiedDate, Account.Name, Contact.Name,
                       Owner.Name, IsClosed, IsEscalated
                FROM Case
                WHERE Id = :caseToUpdate.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Case updated successfully',
                new Map<String, Object>{
                    'caseId' => updatedCase.Id,
                    'caseNumber' => updatedCase.CaseNumber,
                    'subject' => updatedCase.Subject,
                    'description' => updatedCase.Description,
                    'status' => updatedCase.Status,
                    'priority' => updatedCase.Priority,
                    'origin' => updatedCase.Origin,
                    'type' => updatedCase.Type,
                    'reason' => updatedCase.Reason,
                    'accountName' => updatedCase.Account?.Name,
                    'contactName' => updatedCase.Contact?.Name,
                    'ownerName' => updatedCase.Owner?.Name,
                    'lastModifiedDate' => updatedCase.LastModifiedDate,
                    'isClosed' => updatedCase.IsClosed,
                    'isEscalated' => updatedCase.IsEscalated
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error updating case: ' + e.getMessage());
            return buildErrorResponse('Failed to update case: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error updating case: ' + e.getMessage());
            return buildErrorResponse('Failed to update case: ' + e.getMessage());
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Lookup Account by name (with partial matching)
     */
    private Id lookupAccountByName(String accountName) {
        try {
            String searchPattern = '%' + accountName + '%';
            List<Account> accounts = [
                SELECT Id
                FROM Account
                WHERE Name LIKE :searchPattern
                LIMIT 1
            ];

            if (!accounts.isEmpty()) {
                System.debug('Account found: ' + accounts[0].Id);
                return accounts[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up account: ' + e.getMessage());
        }
        return null;
    }

    /**
     * Lookup Contact by email
     */
    private Id lookupContactByEmail(String email) {
        try {
            List<Contact> contacts = [
                SELECT Id
                FROM Contact
                WHERE Email = :email
                LIMIT 1
            ];

            if (!contacts.isEmpty()) {
                System.debug('Contact found: ' + contacts[0].Id);
                return contacts[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up contact: ' + e.getMessage());
        }
        return null;
    }

    /**
     * Build success response in standardized format
     */
    private String buildSuccessResponse(String message, Map<String, Object> data) {
        Map<String, Object> response = new Map<String, Object>{
            'success' => true,
            'message' => message,
            'data' => data
        };
        return JSON.serialize(response);
    }

    /**
     * Build error response in standardized format
     */
    private String buildErrorResponse(String errorMessage) {
        Map<String, Object> response = new Map<String, Object>{
            'success' => false,
            'error' => errorMessage
        };
        return JSON.serialize(response);
    }
}
