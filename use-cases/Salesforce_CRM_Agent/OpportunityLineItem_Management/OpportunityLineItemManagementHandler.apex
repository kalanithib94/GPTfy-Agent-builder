/**
 * OpportunityLineItemManagementHandler
 * Handler for creating and updating OpportunityLineItem records via AI Agent
 *
 * Operations:
 * 1. create_OpportunityLineItem - Create new opportunity product/line item
 * 2. update_OpportunityLineItem - Update existing opportunity product/line item
 */
global with sharing class OpportunityLineItemManagementHandler implements ccai.AIAgenticInterface {

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
     * Main entry point for all OpportunityLineItem operations
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== OpportunityLineItemManagementHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;

            switch on requestParam {
                when 'create_OpportunityLineItem' {
                    result = createOpportunityLineItem(parameters);
                }
                when 'update_OpportunityLineItem' {
                    result = updateOpportunityLineItem(parameters);
                }
                when else {
                    result = buildErrorResponse('Unknown operation: ' + requestParam);
                }
            }

            System.debug('=== OpportunityLineItemManagementHandler END ===');
            System.debug('Result: ' + result);
            return result;

        } catch (Exception e) {
            System.debug('ERROR in executeMethod: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    /**
     * CREATE OPPORTUNITY LINE ITEM
     * Creates a new OpportunityLineItem record (adds product to opportunity)
     */
    private String createOpportunityLineItem(Map<String, Object> parameters) {
        System.debug('--- Creating OpportunityLineItem ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('OpportunityLineItem', 'create')) {
                return buildErrorResponse('You do not have permission to create Opportunity Line Items');
            }

            // Build OpportunityLineItem record
            OpportunityLineItem newLineItem = new OpportunityLineItem();

            // OpportunityId (REQUIRED)
            if (parameters.containsKey('opportunityId')) {
                newLineItem.OpportunityId = String.valueOf(parameters.get('opportunityId'));
            } else if (parameters.containsKey('opportunityName')) {
                String oppName = String.valueOf(parameters.get('opportunityName'));
                Id oppId = lookupOpportunityByName(oppName);
                if (oppId != null) {
                    newLineItem.OpportunityId = oppId;
                } else {
                    return buildErrorResponse('Opportunity not found with name: ' + oppName);
                }
            } else {
                return buildErrorResponse('Either opportunityId or opportunityName is required');
            }

            // PricebookEntryId (REQUIRED) - lookup by Product2Id/productName
            if (parameters.containsKey('pricebookEntryId')) {
                newLineItem.PricebookEntryId = String.valueOf(parameters.get('pricebookEntryId'));
            } else if (parameters.containsKey('productId')) {
                String productId = String.valueOf(parameters.get('productId'));
                Id pbeId = lookupPricebookEntryByProductId(productId, newLineItem.OpportunityId);
                if (pbeId != null) {
                    newLineItem.PricebookEntryId = pbeId;
                } else {
                    return buildErrorResponse('PricebookEntry not found for Product ID: ' + productId);
                }
            } else if (parameters.containsKey('productName')) {
                String productName = String.valueOf(parameters.get('productName'));
                Id pbeId = lookupPricebookEntryByProductName(productName, newLineItem.OpportunityId);
                if (pbeId != null) {
                    newLineItem.PricebookEntryId = pbeId;
                } else {
                    return buildErrorResponse('Product not found with name: ' + productName);
                }
            } else {
                return buildErrorResponse('Either pricebookEntryId, productId, or productName is required');
            }

            // Quantity (REQUIRED)
            if (parameters.containsKey('quantity')) {
                try {
                    newLineItem.Quantity = Decimal.valueOf(String.valueOf(parameters.get('quantity')));
                } catch (Exception e) {
                    return buildErrorResponse('Invalid quantity format. Must be a number.');
                }
            } else {
                return buildErrorResponse('quantity is required');
            }

            // UnitPrice (can use standard price or custom)
            if (parameters.containsKey('unitPrice')) {
                try {
                    newLineItem.UnitPrice = Decimal.valueOf(String.valueOf(parameters.get('unitPrice')));
                } catch (Exception e) {
                    System.debug('Invalid unitPrice format: ' + e.getMessage());
                }
            }

            // TotalPrice (alternative to UnitPrice * Quantity)
            if (parameters.containsKey('totalPrice')) {
                try {
                    newLineItem.TotalPrice = Decimal.valueOf(String.valueOf(parameters.get('totalPrice')));
                } catch (Exception e) {
                    System.debug('Invalid totalPrice format: ' + e.getMessage());
                }
            }

            // Discount
            if (parameters.containsKey('discount')) {
                try {
                    newLineItem.Discount = Decimal.valueOf(String.valueOf(parameters.get('discount')));
                } catch (Exception e) {
                    System.debug('Invalid discount format: ' + e.getMessage());
                }
            }

            // Description
            if (parameters.containsKey('description')) {
                newLineItem.Description = String.valueOf(parameters.get('description'));
            }

            // ServiceDate
            if (parameters.containsKey('serviceDate')) {
                try {
                    String serviceDateStr = String.valueOf(parameters.get('serviceDate'));
                    newLineItem.ServiceDate = Date.valueOf(serviceDateStr);
                } catch (Exception e) {
                    System.debug('Invalid serviceDate format: ' + e.getMessage());
                }
            }

            System.debug('OpportunityLineItem to insert: ' + JSON.serializePretty(newLineItem));

            // Insert the line item
            insert newLineItem;

            System.debug('OpportunityLineItem created successfully: ' + newLineItem.Id);

            // Query back the full record
            OpportunityLineItem createdLineItem = [
                SELECT Id, OpportunityId, Opportunity.Name, Product2Id, Product2.Name,
                       Quantity, UnitPrice, TotalPrice, Discount, Description,
                       ServiceDate, CreatedDate
                FROM OpportunityLineItem
                WHERE Id = :newLineItem.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Opportunity Line Item created successfully',
                new Map<String, Object>{
                    'lineItemId' => createdLineItem.Id,
                    'opportunityId' => createdLineItem.OpportunityId,
                    'opportunityName' => createdLineItem.Opportunity?.Name,
                    'productId' => createdLineItem.Product2Id,
                    'productName' => createdLineItem.Product2?.Name,
                    'quantity' => createdLineItem.Quantity,
                    'unitPrice' => createdLineItem.UnitPrice,
                    'totalPrice' => createdLineItem.TotalPrice,
                    'discount' => createdLineItem.Discount,
                    'description' => createdLineItem.Description,
                    'serviceDate' => createdLineItem.ServiceDate,
                    'createdDate' => createdLineItem.CreatedDate
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error creating opportunity line item: ' + e.getMessage());
            return buildErrorResponse('Failed to create opportunity line item: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error creating opportunity line item: ' + e.getMessage());
            return buildErrorResponse('Failed to create opportunity line item: ' + e.getMessage());
        }
    }

    /**
     * UPDATE OPPORTUNITY LINE ITEM
     * Updates an existing OpportunityLineItem record
     */
    private String updateOpportunityLineItem(Map<String, Object> parameters) {
        System.debug('--- Updating OpportunityLineItem ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('OpportunityLineItem', 'update')) {
                return buildErrorResponse('You do not have permission to update Opportunity Line Items');
            }

            // Get OpportunityLineItem ID
            Id lineItemId = null;

            if (parameters.containsKey('lineItemId')) {
                lineItemId = String.valueOf(parameters.get('lineItemId'));
            } else {
                return buildErrorResponse('lineItemId is required to update an opportunity line item');
            }

            // Query existing line item
            List<OpportunityLineItem> existingLineItems = [
                SELECT Id, OpportunityId, PricebookEntryId, Quantity, UnitPrice,
                       TotalPrice, Discount, Description, ServiceDate
                FROM OpportunityLineItem
                WHERE Id = :lineItemId
                LIMIT 1
            ];

            if (existingLineItems.isEmpty()) {
                return buildErrorResponse('Opportunity Line Item not found with ID: ' + lineItemId);
            }

            OpportunityLineItem lineItemToUpdate = existingLineItems[0];
            Boolean hasChanges = false;

            // Update Quantity
            if (parameters.containsKey('quantity')) {
                try {
                    lineItemToUpdate.Quantity = Decimal.valueOf(String.valueOf(parameters.get('quantity')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid quantity format: ' + e.getMessage());
                }
            }

            // Update UnitPrice
            if (parameters.containsKey('unitPrice')) {
                try {
                    lineItemToUpdate.UnitPrice = Decimal.valueOf(String.valueOf(parameters.get('unitPrice')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid unitPrice format: ' + e.getMessage());
                }
            }

            // Update TotalPrice
            if (parameters.containsKey('totalPrice')) {
                try {
                    lineItemToUpdate.TotalPrice = Decimal.valueOf(String.valueOf(parameters.get('totalPrice')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid totalPrice format: ' + e.getMessage());
                }
            }

            // Update Discount
            if (parameters.containsKey('discount')) {
                try {
                    lineItemToUpdate.Discount = Decimal.valueOf(String.valueOf(parameters.get('discount')));
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid discount format: ' + e.getMessage());
                }
            }

            // Update Description
            if (parameters.containsKey('description')) {
                lineItemToUpdate.Description = String.valueOf(parameters.get('description'));
                hasChanges = true;
            }

            // Update ServiceDate
            if (parameters.containsKey('serviceDate')) {
                try {
                    String serviceDateStr = String.valueOf(parameters.get('serviceDate'));
                    lineItemToUpdate.ServiceDate = Date.valueOf(serviceDateStr);
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid serviceDate format: ' + e.getMessage());
                }
            }

            if (!hasChanges) {
                return buildErrorResponse('No fields provided to update');
            }

            System.debug('OpportunityLineItem to update: ' + JSON.serializePretty(lineItemToUpdate));

            // Update the line item
            update lineItemToUpdate;

            System.debug('OpportunityLineItem updated successfully: ' + lineItemToUpdate.Id);

            // Query back the full record
            OpportunityLineItem updatedLineItem = [
                SELECT Id, OpportunityId, Opportunity.Name, Product2Id, Product2.Name,
                       Quantity, UnitPrice, TotalPrice, Discount, Description,
                       ServiceDate, LastModifiedDate
                FROM OpportunityLineItem
                WHERE Id = :lineItemToUpdate.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Opportunity Line Item updated successfully',
                new Map<String, Object>{
                    'lineItemId' => updatedLineItem.Id,
                    'opportunityId' => updatedLineItem.OpportunityId,
                    'opportunityName' => updatedLineItem.Opportunity?.Name,
                    'productId' => updatedLineItem.Product2Id,
                    'productName' => updatedLineItem.Product2?.Name,
                    'quantity' => updatedLineItem.Quantity,
                    'unitPrice' => updatedLineItem.UnitPrice,
                    'totalPrice' => updatedLineItem.TotalPrice,
                    'discount' => updatedLineItem.Discount,
                    'description' => updatedLineItem.Description,
                    'serviceDate' => updatedLineItem.ServiceDate,
                    'lastModifiedDate' => updatedLineItem.LastModifiedDate
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error updating opportunity line item: ' + e.getMessage());
            return buildErrorResponse('Failed to update opportunity line item: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error updating opportunity line item: ' + e.getMessage());
            return buildErrorResponse('Failed to update opportunity line item: ' + e.getMessage());
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
     * Lookup PricebookEntry by Product2Id
     */
    private Id lookupPricebookEntryByProductId(String productId, Id oppId) {
        try {
            // Get the opportunity's pricebook
            List<Opportunity> opps = [SELECT Pricebook2Id FROM Opportunity WHERE Id = :oppId LIMIT 1];
            if (opps.isEmpty()) {
                return null;
            }

            Id pricebookId = opps[0].Pricebook2Id;
            if (pricebookId == null) {
                // Use standard pricebook
                pricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;
            }

            List<PricebookEntry> pbes = [
                SELECT Id
                FROM PricebookEntry
                WHERE Product2Id = :productId
                AND Pricebook2Id = :pricebookId
                AND IsActive = true
                LIMIT 1
            ];

            if (!pbes.isEmpty()) {
                System.debug('PricebookEntry found: ' + pbes[0].Id);
                return pbes[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up pricebook entry: ' + e.getMessage());
        }
        return null;
    }

    /**
     * Lookup PricebookEntry by Product Name
     */
    private Id lookupPricebookEntryByProductName(String productName, Id oppId) {
        try {
            // Get the opportunity's pricebook
            List<Opportunity> opps = [SELECT Pricebook2Id FROM Opportunity WHERE Id = :oppId LIMIT 1];
            if (opps.isEmpty()) {
                return null;
            }

            Id pricebookId = opps[0].Pricebook2Id;
            if (pricebookId == null) {
                // Use standard pricebook
                pricebookId = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1].Id;
            }

            // Find product by name
            String searchPattern = '%' + productName + '%';
            List<Product2> products = [
                SELECT Id
                FROM Product2
                WHERE Name LIKE :searchPattern
                AND IsActive = true
                LIMIT 1
            ];

            if (products.isEmpty()) {
                return null;
            }

            Id productId = products[0].Id;

            // Find pricebook entry
            List<PricebookEntry> pbes = [
                SELECT Id
                FROM PricebookEntry
                WHERE Product2Id = :productId
                AND Pricebook2Id = :pricebookId
                AND IsActive = true
                LIMIT 1
            ];

            if (!pbes.isEmpty()) {
                System.debug('PricebookEntry found for product: ' + productName);
                return pbes[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up pricebook entry by product name: ' + e.getMessage());
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
