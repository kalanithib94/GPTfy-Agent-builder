/**
 * OpportunityManagementHandler
 * Handler for creating and updating Opportunity records via AI Agent
 *
 * Operations:
 * 1. create_Opportunity - Create new opportunity with comprehensive field support
 * 2. update_Opportunity - Update existing opportunity fields
 */
global with sharing class OpportunityManagementHandler implements ccai.AIAgenticInterface {

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
     * Main entry point for all Opportunity operations
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== OpportunityManagementHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;

            switch on requestParam {
                when 'create_Opportunity', 'create_Opportunity_on_Account' {
                    System.debug('DEBUG: Routing to createOpportunity method');
                    result = createOpportunity(parameters);
                }
                when 'update_Opportunity', 'update_Opportunity_on_Account' {
                    System.debug('DEBUG: Routing to updateOpportunity method');
                    result = updateOpportunity(parameters);
                }
                when else {
                    System.debug('ERROR: Unknown operation requested: ' + requestParam);
                    result = buildErrorResponse('Unknown operation: ' + requestParam);
                }
            }

            System.debug('=== OpportunityManagementHandler END ===');
            System.debug('Result: ' + result);
            return result;

        } catch (Exception e) {
            System.debug('ERROR in executeMethod: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    /**
     * CREATE OPPORTUNITY
     * Creates a new Opportunity record with provided fields
     */
    private String createOpportunity(Map<String, Object> parameters) {
        System.debug('--- Creating Opportunity ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Opportunity', 'create')) {
                return buildErrorResponse('You do not have permission to create Opportunities');
            }

            // Build Opportunity record
            Opportunity newOpp = new Opportunity();

            // Name (REQUIRED)
            if (parameters.containsKey('name')) {
                newOpp.Name = String.valueOf(parameters.get('name'));
            } else {
                return buildErrorResponse('name is required to create an Opportunity');
            }

            // CloseDate (REQUIRED)
            if (parameters.containsKey('closeDate')) {
                try {
                    String closeDateStr = String.valueOf(parameters.get('closeDate'));
                    newOpp.CloseDate = Date.valueOf(closeDateStr);
                } catch (Exception e) {
                    return buildErrorResponse('Invalid closeDate format. Use YYYY-MM-DD format.');
                }
            } else {
                return buildErrorResponse('closeDate is required to create an Opportunity');
            }

            // StageName (REQUIRED, validated against org picklist)
            if (parameters.containsKey('stageName')) {
                String stageInput = String.valueOf(parameters.get('stageName')).trim();
                String resolvedStage = resolveStageName(stageInput);
                if (resolvedStage == null) {
                    List<String> validStages = getValidStageNames();
                    return buildErrorResponse('Invalid stage "' + stageInput + '". Valid stages: ' + String.join(validStages, ', '));
                }
                newOpp.StageName = resolvedStage;
            } else {
                return buildErrorResponse('stageName is required to create an Opportunity');
            }

            // Amount
            if (parameters.containsKey('amount')) {
                try {
                    newOpp.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount')));
                } catch (Exception e) {
                    System.debug('Invalid amount format: ' + e.getMessage());
                }
            }

            // Probability
            if (parameters.containsKey('probability')) {
                try {
                    newOpp.Probability = Decimal.valueOf(String.valueOf(parameters.get('probability')));
                } catch (Exception e) {
                    System.debug('Invalid probability format: ' + e.getMessage());
                }
            }

            // Type
            if (parameters.containsKey('type')) {
                newOpp.Type = String.valueOf(parameters.get('type'));
            }

            // LeadSource
            if (parameters.containsKey('leadSource')) {
                newOpp.LeadSource = String.valueOf(parameters.get('leadSource'));
            }

            // Description
            if (parameters.containsKey('description')) {
                newOpp.Description = String.valueOf(parameters.get('description'));
            }

            // NextStep
            if (parameters.containsKey('nextStep')) {
                newOpp.NextStep = String.valueOf(parameters.get('nextStep'));
            }

            // Account lookup
            if (parameters.containsKey('accountId')) {
                newOpp.AccountId = String.valueOf(parameters.get('accountId'));
            } else if (parameters.containsKey('accountName')) {
                String accountName = String.valueOf(parameters.get('accountName'));
                Id accountId = lookupAccountByName(accountName);
                if (accountId != null) {
                    newOpp.AccountId = accountId;
                } else {
                    return buildErrorResponse('Account not found with name: ' + accountName + '. Please use find_Account_by_Name first to get the correct account.');
                }
            }

            // Owner assignment
            if (parameters.containsKey('ownerId')) {
                newOpp.OwnerId = String.valueOf(parameters.get('ownerId'));
            }

            System.debug('Opportunity to insert: ' + JSON.serializePretty(newOpp));

            // Insert the opportunity
            insert newOpp;

            System.debug('Opportunity created successfully: ' + newOpp.Id);

            // Query back the full record
            Opportunity createdOpp = [
                SELECT Id, Name, Amount, StageName, CloseDate, Probability,
                       Type, LeadSource, Description, NextStep, CreatedDate,
                       Account.Name, Owner.Name, IsClosed, IsWon
                FROM Opportunity
                WHERE Id = :newOpp.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Opportunity created successfully',
                new Map<String, Object>{
                    'opportunityId' => createdOpp.Id,
                    'name' => createdOpp.Name,
                    'amount' => createdOpp.Amount,
                    'stageName' => createdOpp.StageName,
                    'closeDate' => createdOpp.CloseDate,
                    'probability' => createdOpp.Probability,
                    'type' => createdOpp.Type,
                    'leadSource' => createdOpp.LeadSource,
                    'description' => createdOpp.Description,
                    'nextStep' => createdOpp.NextStep,
                    'accountName' => createdOpp.Account?.Name,
                    'ownerName' => createdOpp.Owner?.Name,
                    'createdDate' => createdOpp.CreatedDate,
                    'isClosed' => createdOpp.IsClosed,
                    'isWon' => createdOpp.IsWon
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error creating opportunity: ' + e.getMessage());
            return buildErrorResponse('Failed to create opportunity: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error creating opportunity: ' + e.getMessage());
            return buildErrorResponse('Failed to create opportunity: ' + e.getMessage());
        }
    }

    /**
     * UPDATE OPPORTUNITY
     * Updates an existing Opportunity record
     */
    private String updateOpportunity(Map<String, Object> parameters) {
        System.debug('--- Updating Opportunity ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Opportunity', 'update')) {
                return buildErrorResponse('You do not have permission to update Opportunities');
            }

            // Get Opportunity ID - support multiple lookup methods
            Id oppId = null;

            if (parameters.containsKey('opportunityId') && parameters.get('opportunityId') != null && String.isNotBlank(String.valueOf(parameters.get('opportunityId')))) {
                System.debug('DEBUG: Looking up opportunity by opportunityId');
                oppId = (Id) String.valueOf(parameters.get('opportunityId'));
                System.debug('DEBUG: opportunityId = ' + oppId);
            } else if (parameters.containsKey('name') && parameters.get('name') != null && String.isNotBlank(String.valueOf(parameters.get('name')))) {
                System.debug('DEBUG: Looking up opportunity by partial name match');
                String partialName = String.valueOf(parameters.get('name'));
                String searchPattern = '%' + partialName + '%';
                System.debug('DEBUG: searchPattern = ' + searchPattern);

                // If accountId provided, search within that account (accountId provides context)
                if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                    System.debug('DEBUG: Filtering by accountId for context');
                    String accountIdStr = String.valueOf(parameters.get('accountId'));
                    System.debug('DEBUG: accountId = ' + accountIdStr);
                    List<Opportunity> opps = [
                        SELECT Id
                        FROM Opportunity
                        WHERE Name LIKE :searchPattern AND AccountId = :accountIdStr
                        ORDER BY CreatedDate DESC
                        LIMIT 1
                    ];
                    if (!opps.isEmpty()) {
                        oppId = opps[0].Id;
                        System.debug('DEBUG: Found opportunity under account: ' + oppId);
                    } else {
                        return buildErrorResponse('Opportunity not found with name containing "' + partialName + '" under the specified account');
                    }
                } else {
                    // Search by name only
                    System.debug('DEBUG: Searching by name without account filter');
                    List<Opportunity> opps = [
                        SELECT Id
                        FROM Opportunity
                        WHERE Name LIKE :searchPattern
                        ORDER BY CreatedDate DESC
                        LIMIT 1
                    ];
                    if (!opps.isEmpty()) {
                        oppId = opps[0].Id;
                        System.debug('DEBUG: Found opportunity: ' + oppId);
                    } else {
                        return buildErrorResponse('Opportunity not found with name containing: ' + partialName);
                    }
                }
            } else {
                return buildErrorResponse('Either opportunityId or name is required to find the opportunity');
            }

            // Validate that we found an opportunityId
            if (oppId == null) {
                return buildErrorResponse('Failed to determine opportunityId for update');
            }
            System.debug('DEBUG: Final opportunityId for update: ' + oppId);

            // Query existing opportunity
            List<Opportunity> existingOpps = [
                SELECT Id, Name, Amount, StageName, CloseDate, Probability,
                       Type, LeadSource, Description, NextStep, AccountId, OwnerId
                FROM Opportunity
                WHERE Id = :oppId
                LIMIT 1
            ];

            if (existingOpps.isEmpty()) {
                return buildErrorResponse('Opportunity not found with ID: ' + oppId);
            }

            Opportunity oppToUpdate = existingOpps[0];
            Boolean hasChanges = false;

            // Update Name
            if (parameters.containsKey('name')) {
                oppToUpdate.Name = String.valueOf(parameters.get('name'));
                hasChanges = true;
            }

            // Update Amount
            if (parameters.containsKey('amount')) {
                try {
                    oppToUpdate.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid amount format: ' + e.getMessage());
                }
            }

            // Update StageName (validate against org picklist, use exact API value)
            if (parameters.containsKey('stageName')) {
                String newStage = String.valueOf(parameters.get('stageName')).trim();
                if (String.isBlank(newStage)) {
                    return buildErrorResponse('stageName cannot be blank');
                }
                String matchedStage = resolveStageName(newStage);
                if (matchedStage == null) {
                    List<String> validStages = getValidStageNames();
                    return buildErrorResponse('Invalid stage "' + newStage + '". Valid stages for this org: ' + String.join(validStages, ', '));
                }
                oppToUpdate.StageName = matchedStage;
                hasChanges = true;
            }

            // Update CloseDate
            if (parameters.containsKey('closeDate')) {
                try {
                    String closeDateStr = String.valueOf(parameters.get('closeDate'));
                    oppToUpdate.CloseDate = Date.valueOf(closeDateStr);
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid closeDate format: ' + e.getMessage());
                }
            }

            // Update Probability
            if (parameters.containsKey('probability')) {
                try {
                    oppToUpdate.Probability = Decimal.valueOf(String.valueOf(parameters.get('probability')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid probability format: ' + e.getMessage());
                }
            }

            // Update Type
            if (parameters.containsKey('type')) {
                oppToUpdate.Type = String.valueOf(parameters.get('type'));
                hasChanges = true;
            }

            // Update LeadSource
            if (parameters.containsKey('leadSource')) {
                oppToUpdate.LeadSource = String.valueOf(parameters.get('leadSource'));
                hasChanges = true;
            }

            // Update Description
            if (parameters.containsKey('description')) {
                oppToUpdate.Description = String.valueOf(parameters.get('description'));
                hasChanges = true;
            }

            // Update NextStep
            if (parameters.containsKey('nextStep')) {
                oppToUpdate.NextStep = String.valueOf(parameters.get('nextStep'));
                hasChanges = true;
            }

            // Update Account
            if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                oppToUpdate.AccountId = String.valueOf(parameters.get('accountId'));
                hasChanges = true;
            } else if (parameters.containsKey('accountName') && parameters.get('accountName') != null && String.isNotBlank(String.valueOf(parameters.get('accountName')))) {
                String accountName = String.valueOf(parameters.get('accountName'));
                Id accountId = lookupAccountByName(accountName);
                if (accountId != null) {
                    oppToUpdate.AccountId = accountId;
                    hasChanges = true;
                } else {
                    return buildErrorResponse('Account not found with name: ' + accountName + '. Please use find_Account_by_Name first to get the correct account.');
                }
            }

            // Update Owner
            if (parameters.containsKey('ownerId') && parameters.get('ownerId') != null && String.isNotBlank(String.valueOf(parameters.get('ownerId')))) {
                oppToUpdate.OwnerId = String.valueOf(parameters.get('ownerId'));
                hasChanges = true;
            }

            if (!hasChanges) {
                return buildErrorResponse('No fields provided to update');
            }

            System.debug('Opportunity to update: ' + JSON.serializePretty(oppToUpdate));

            // Update the opportunity
            update oppToUpdate;

            System.debug('Opportunity updated successfully: ' + oppToUpdate.Id);

            // Query back the full record
            Opportunity updatedOpp = [
                SELECT Id, Name, Amount, StageName, CloseDate, Probability,
                       Type, LeadSource, Description, NextStep, LastModifiedDate,
                       Account.Name, Owner.Name, IsClosed, IsWon
                FROM Opportunity
                WHERE Id = :oppToUpdate.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Opportunity updated successfully',
                new Map<String, Object>{
                    'opportunityId' => updatedOpp.Id,
                    'name' => updatedOpp.Name,
                    'amount' => updatedOpp.Amount,
                    'stageName' => updatedOpp.StageName,
                    'closeDate' => updatedOpp.CloseDate,
                    'probability' => updatedOpp.Probability,
                    'type' => updatedOpp.Type,
                    'leadSource' => updatedOpp.LeadSource,
                    'description' => updatedOpp.Description,
                    'nextStep' => updatedOpp.NextStep,
                    'accountName' => updatedOpp.Account?.Name,
                    'ownerName' => updatedOpp.Owner?.Name,
                    'lastModifiedDate' => updatedOpp.LastModifiedDate,
                    'isClosed' => updatedOpp.IsClosed,
                    'isWon' => updatedOpp.IsWon
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error updating opportunity: ' + e.getMessage());
            return buildErrorResponse('Failed to update opportunity: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error updating opportunity: ' + e.getMessage());
            return buildErrorResponse('Failed to update opportunity: ' + e.getMessage());
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Resolve user-provided stage to exact org picklist value (case-insensitive match)
     * Returns null if no match
     */
    private String resolveStageName(String userInput) {
        if (String.isBlank(userInput)) return null;
        for (String valid : getValidStageNames()) {
            if (valid.equalsIgnoreCase(userInput)) return valid;
        }
        return null;
    }

    /**
     * Get valid StageName values from Opportunity picklist
     */
    private List<String> getValidStageNames() {
        List<String> values = new List<String>();
        try {
            for (Schema.PicklistEntry pe : Opportunity.StageName.getDescribe().getPicklistValues()) {
                if (pe.isActive()) values.add(pe.getValue());
            }
        } catch (Exception e) {
            System.debug('Could not describe StageName picklist: ' + e.getMessage());
        }
        return values;
    }

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
