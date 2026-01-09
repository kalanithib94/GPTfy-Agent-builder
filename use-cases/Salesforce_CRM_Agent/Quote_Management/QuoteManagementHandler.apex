/**
 * QuoteManagementHandler
 * Handler for creating and updating Quote records via AI Agent
 *
 * Operations:
 * 1. create_Quote - Create new quote with comprehensive field support
 * 2. update_Quote - Update existing quote fields
 */
global with sharing class QuoteManagementHandler implements ccai.AIAgenticInterface {

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
     * Main entry point for all Quote operations
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== QuoteManagementHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;

            switch on requestParam {
                when 'create_Quote' {
                    result = createQuote(parameters);
                }
                when 'update_Quote' {
                    result = updateQuote(parameters);
                }
                when else {
                    result = buildErrorResponse('Unknown operation: ' + requestParam);
                }
            }

            System.debug('=== QuoteManagementHandler END ===');
            System.debug('Result: ' + result);
            return result;

        } catch (Exception e) {
            System.debug('ERROR in executeMethod: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    /**
     * CREATE QUOTE
     * Creates a new Quote record with provided fields
     */
    private String createQuote(Map<String, Object> parameters) {
        System.debug('--- Creating Quote ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Quote', 'create')) {
                return buildErrorResponse('You do not have permission to create Quotes');
            }

            // Build Quote record
            Quote newQuote = new Quote();

            // Name (REQUIRED)
            if (parameters.containsKey('name')) {
                newQuote.Name = String.valueOf(parameters.get('name'));
            } else {
                return buildErrorResponse('name is required to create a Quote');
            }

            // OpportunityId (REQUIRED)
            if (parameters.containsKey('opportunityId')) {
                newQuote.OpportunityId = String.valueOf(parameters.get('opportunityId'));
            } else if (parameters.containsKey('opportunityName')) {
                String oppName = String.valueOf(parameters.get('opportunityName'));
                Id oppId = lookupOpportunityByName(oppName);
                if (oppId != null) {
                    newQuote.OpportunityId = oppId;
                } else {
                    return buildErrorResponse('Opportunity not found with name: ' + oppName);
                }
            } else {
                return buildErrorResponse('Either opportunityId or opportunityName is required to create a Quote');
            }

            // ExpirationDate
            if (parameters.containsKey('expirationDate')) {
                try {
                    String expDateStr = String.valueOf(parameters.get('expirationDate'));
                    newQuote.ExpirationDate = Date.valueOf(expDateStr);
                } catch (Exception e) {
                    System.debug('Invalid expirationDate format: ' + e.getMessage());
                }
            }

            // Status
            if (parameters.containsKey('status')) {
                newQuote.Status = String.valueOf(parameters.get('status'));
            }

            // Description
            if (parameters.containsKey('description')) {
                newQuote.Description = String.valueOf(parameters.get('description'));
            }

            // Discount
            if (parameters.containsKey('discount')) {
                try {
                    newQuote.Discount = Decimal.valueOf(String.valueOf(parameters.get('discount')));
                } catch (Exception e) {
                    System.debug('Invalid discount format: ' + e.getMessage());
                }
            }

            // Tax
            if (parameters.containsKey('tax')) {
                try {
                    newQuote.Tax = Decimal.valueOf(String.valueOf(parameters.get('tax')));
                } catch (Exception e) {
                    System.debug('Invalid tax format: ' + e.getMessage());
                }
            }

            // ShippingHandling
            if (parameters.containsKey('shippingHandling')) {
                try {
                    newQuote.ShippingHandling = Decimal.valueOf(String.valueOf(parameters.get('shippingHandling')));
                } catch (Exception e) {
                    System.debug('Invalid shippingHandling format: ' + e.getMessage());
                }
            }

            System.debug('Quote to insert: ' + JSON.serializePretty(newQuote));

            // Insert the quote
            insert newQuote;

            System.debug('Quote created successfully: ' + newQuote.Id);

            // Query back the full record
            Quote createdQuote = [
                SELECT Id, QuoteNumber, Name, Status, ExpirationDate, Description,
                       Discount, Tax, ShippingHandling, GrandTotal, Opportunity.Name,
                       CreatedDate, IsSyncing
                FROM Quote
                WHERE Id = :newQuote.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Quote created successfully',
                new Map<String, Object>{
                    'quoteId' => createdQuote.Id,
                    'quoteNumber' => createdQuote.QuoteNumber,
                    'name' => createdQuote.Name,
                    'status' => createdQuote.Status,
                    'expirationDate' => createdQuote.ExpirationDate,
                    'description' => createdQuote.Description,
                    'discount' => createdQuote.Discount,
                    'tax' => createdQuote.Tax,
                    'shippingHandling' => createdQuote.ShippingHandling,
                    'grandTotal' => createdQuote.GrandTotal,
                    'opportunityName' => createdQuote.Opportunity?.Name,
                    'createdDate' => createdQuote.CreatedDate,
                    'isSyncing' => createdQuote.IsSyncing
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error creating quote: ' + e.getMessage());
            return buildErrorResponse('Failed to create quote: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error creating quote: ' + e.getMessage());
            return buildErrorResponse('Failed to create quote: ' + e.getMessage());
        }
    }

    /**
     * UPDATE QUOTE
     * Updates an existing Quote record
     */
    private String updateQuote(Map<String, Object> parameters) {
        System.debug('--- Updating Quote ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Quote', 'update')) {
                return buildErrorResponse('You do not have permission to update Quotes');
            }

            // Get Quote ID or Quote Number or Name
            Id quoteId = null;

            if (parameters.containsKey('quoteId')) {
                quoteId = String.valueOf(parameters.get('quoteId'));
            } else if (parameters.containsKey('quoteNumber')) {
                String quoteNumber = String.valueOf(parameters.get('quoteNumber'));
                List<Quote> quotes = [SELECT Id FROM Quote WHERE QuoteNumber = :quoteNumber LIMIT 1];
                if (!quotes.isEmpty()) {
                    quoteId = quotes[0].Id;
                } else {
                    return buildErrorResponse('Quote not found with number: ' + quoteNumber);
                }
            } else if (parameters.containsKey('name')) {
                String quoteName = String.valueOf(parameters.get('name'));
                List<Quote> quotes = [SELECT Id FROM Quote WHERE Name = :quoteName LIMIT 1];
                if (!quotes.isEmpty()) {
                    quoteId = quotes[0].Id;
                } else {
                    return buildErrorResponse('Quote not found with name: ' + quoteName);
                }
            } else {
                return buildErrorResponse('Either quoteId, quoteNumber, or name is required to update a quote');
            }

            // Query existing quote
            List<Quote> existingQuotes = [
                SELECT Id, Name, Status, ExpirationDate, Description, Discount,
                       Tax, ShippingHandling, OpportunityId
                FROM Quote
                WHERE Id = :quoteId
                LIMIT 1
            ];

            if (existingQuotes.isEmpty()) {
                return buildErrorResponse('Quote not found with ID: ' + quoteId);
            }

            Quote quoteToUpdate = existingQuotes[0];
            Boolean hasChanges = false;

            // Update Name
            if (parameters.containsKey('name')) {
                quoteToUpdate.Name = String.valueOf(parameters.get('name'));
                hasChanges = true;
            }

            // Update Status
            if (parameters.containsKey('status')) {
                quoteToUpdate.Status = String.valueOf(parameters.get('status'));
                hasChanges = true;
            }

            // Update ExpirationDate
            if (parameters.containsKey('expirationDate')) {
                try {
                    String expDateStr = String.valueOf(parameters.get('expirationDate'));
                    quoteToUpdate.ExpirationDate = Date.valueOf(expDateStr);
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid expirationDate format: ' + e.getMessage());
                }
            }

            // Update Description
            if (parameters.containsKey('description')) {
                quoteToUpdate.Description = String.valueOf(parameters.get('description'));
                hasChanges = true;
            }

            // Update Discount
            if (parameters.containsKey('discount')) {
                try {
                    quoteToUpdate.Discount = Decimal.valueOf(String.valueOf(parameters.get('discount')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid discount format: ' + e.getMessage());
                }
            }

            // Update Tax
            if (parameters.containsKey('tax')) {
                try {
                    quoteToUpdate.Tax = Decimal.valueOf(String.valueOf(parameters.get('tax')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid tax format: ' + e.getMessage());
                }
            }

            // Update ShippingHandling
            if (parameters.containsKey('shippingHandling')) {
                try {
                    quoteToUpdate.ShippingHandling = Decimal.valueOf(String.valueOf(parameters.get('shippingHandling')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid shippingHandling format: ' + e.getMessage());
                }
            }

            // Update Opportunity
            if (parameters.containsKey('opportunityId')) {
                quoteToUpdate.OpportunityId = String.valueOf(parameters.get('opportunityId'));
                hasChanges = true;
            } else if (parameters.containsKey('opportunityName')) {
                String oppName = String.valueOf(parameters.get('opportunityName'));
                Id oppId = lookupOpportunityByName(oppName);
                if (oppId != null) {
                    quoteToUpdate.OpportunityId = oppId;
                    hasChanges = true;
                } else {
                    return buildErrorResponse('Opportunity not found with name: ' + oppName);
                }
            }

            if (!hasChanges) {
                return buildErrorResponse('No fields provided to update');
            }

            System.debug('Quote to update: ' + JSON.serializePretty(quoteToUpdate));

            // Update the quote
            update quoteToUpdate;

            System.debug('Quote updated successfully: ' + quoteToUpdate.Id);

            // Query back the full record
            Quote updatedQuote = [
                SELECT Id, QuoteNumber, Name, Status, ExpirationDate, Description,
                       Discount, Tax, ShippingHandling, GrandTotal, Opportunity.Name,
                       LastModifiedDate, IsSyncing
                FROM Quote
                WHERE Id = :quoteToUpdate.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Quote updated successfully',
                new Map<String, Object>{
                    'quoteId' => updatedQuote.Id,
                    'quoteNumber' => updatedQuote.QuoteNumber,
                    'name' => updatedQuote.Name,
                    'status' => updatedQuote.Status,
                    'expirationDate' => updatedQuote.ExpirationDate,
                    'description' => updatedQuote.Description,
                    'discount' => updatedQuote.Discount,
                    'tax' => updatedQuote.Tax,
                    'shippingHandling' => updatedQuote.ShippingHandling,
                    'grandTotal' => updatedQuote.GrandTotal,
                    'opportunityName' => updatedQuote.Opportunity?.Name,
                    'lastModifiedDate' => updatedQuote.LastModifiedDate,
                    'isSyncing' => updatedQuote.IsSyncing
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error updating quote: ' + e.getMessage());
            return buildErrorResponse('Failed to update quote: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error updating quote: ' + e.getMessage());
            return buildErrorResponse('Failed to update quote: ' + e.getMessage());
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Lookup Opportunity by name
     */
    private Id lookupOpportunityByName(String oppName) {
        try {
            List<Opportunity> opps = [
                SELECT Id
                FROM Opportunity
                WHERE Name = :oppName
                LIMIT 1
            ];

            if (!opps.isEmpty()) {
                System.debug('Opportunity found: ' + opps[0].Id);
                return opps[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up opportunity: ' + e.getMessage());
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
