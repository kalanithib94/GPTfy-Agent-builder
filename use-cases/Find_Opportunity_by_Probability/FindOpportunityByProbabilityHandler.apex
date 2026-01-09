/**
 * @description
 *   FindOpportunityByProbabilityHandler implements the AIAgenticInterface and serves as a handler
 *   for finding Opportunity records by probability threshold. It supports filtering opportunities
 *   with probability above a specified value, access control checks, standardized error handling,
 *   and JSON-formatted responses for AI agent workflows.
 *
 *   Supported Operations:
 *   - find_Opportunity_by_Probability: Finds opportunities with probability >= threshold
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 18-12-2025
 * @last modified by    : Claude
 */
public with sharing class FindOpportunityByProbabilityHandler implements AIAgenticInterface {

    /**
     * @description
     *   Checks the current user's object-level permission (CRUD) for the specified sObject type.
     * @param sObjectName   The API name of the Salesforce object (e.g., 'Opportunity').
     * @param permType      Permission type: 'read', 'create', 'update', 'delete'.
     * @return Boolean      True if permission is available; false otherwise.
     */
    private Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(sObjectName).getDescribe();
        if (permType == 'read')      return describeResult.isAccessible();
        if (permType == 'create')    return describeResult.isCreateable();
        if (permType == 'update')    return describeResult.isUpdateable();
        if (permType == 'delete')    return describeResult.isDeletable();
        return false;
    }

    /**
     * @description
     *   Utility method for returning a JSON error response with exception details.
     * @param ex      The exception caught during method execution.
     * @return String Serialized JSON object indicating failure and including the message.
     */
    private String errorResponse(Exception ex) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => ex.getMessage(),
            'stackTrace' => ex.getStackTraceString()
        });
    }

    /**
     * @description
     *   Utility method for returning a JSON error response with a custom string message.
     * @param message Error message to include in the response.
     * @return String Serialized JSON object indicating failure and including the message.
     */
    private String errorResponse(String message) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => message
        });
    }

    /**
     * @description
     *   Entry point for dispatching supported agentic function calls.
     *   This handler only supports 'find_Opportunity_by_Probability' operation.
     * @param requestParam  The functional method or action to execute.
     * @param parameters    Input parameters for the operation.
     * @return String       JSON-encoded operation response or error.
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            switch on requestParam {
                when 'find_Opportunity_by_Probability' {
                    return findOpportunityByProbability(parameters);
                }
                when else {
                    return errorResponse('Method is not defined. This handler only supports: find_Opportunity_by_Probability');
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    /**
     * @description
     *   Finds Opportunity records with probability greater than or equal to the specified threshold.
     *   Returns a JSON response with the matching opportunities.
     * @param parameters   Map containing:
     *                     - 'minimumProbability' (Optional): Probability threshold (default: 70)
     *                     - 'includeClosed' (Optional): Whether to include closed opportunities (default: false)
     * @return String      JSON response with success status, opportunity list, and count.
     */
    public String findOpportunityByProbability(Map<String, Object> parameters) {
        // Check read permission on Opportunity object
        if (!hasObjectPerm('Opportunity', 'read')) {
            return errorResponse('Insufficient read permission on Opportunity object.');
        }

        try {
            // Get minimum probability (default to 70 if not provided)
            Decimal minimumProbability = 70;
            if (parameters.containsKey('minimumProbability') &&
                parameters.get('minimumProbability') != null) {

                Object probValue = parameters.get('minimumProbability');
                if (probValue instanceof Decimal) {
                    minimumProbability = (Decimal) probValue;
                } else if (probValue instanceof Integer) {
                    minimumProbability = (Integer) probValue;
                } else {
                    minimumProbability = Decimal.valueOf(String.valueOf(probValue));
                }
            }

            // Validate probability range (0-100)
            if (minimumProbability < 0 || minimumProbability > 100) {
                return errorResponse('Probability must be between 0 and 100.');
            }

            // Get includeClosed flag (default to false)
            Boolean includeClosed = false;
            if (parameters.containsKey('includeClosed') &&
                parameters.get('includeClosed') != null) {
                includeClosed = Boolean.valueOf(parameters.get('includeClosed'));
            }

            // Build SOQL query
            String query = 'SELECT Id, Name, AccountId, Account.Name, StageName, ' +
                          'Probability, Amount, CloseDate, Owner.Name ' +
                          'FROM Opportunity ' +
                          'WHERE Probability >= :minimumProbability';

            // Add closed filter if needed
            if (!includeClosed) {
                query += ' AND IsClosed = false';
            }

            query += ' ORDER BY Probability DESC, Amount DESC NULLS LAST';

            // Execute query
            List<Opportunity> opportunities = Database.query(query);

            // Calculate total pipeline value
            Decimal totalAmount = 0;
            for (Opportunity opp : opportunities) {
                if (opp.Amount != null) {
                    totalAmount += opp.Amount;
                }
            }

            // Build response with opportunity details
            List<Map<String, Object>> opportunityDetails = new List<Map<String, Object>>();
            for (Opportunity opp : opportunities) {
                opportunityDetails.add(new Map<String, Object>{
                    'Id' => opp.Id,
                    'Name' => opp.Name,
                    'AccountId' => opp.AccountId,
                    'AccountName' => opp.Account?.Name,
                    'StageName' => opp.StageName,
                    'Probability' => opp.Probability,
                    'Amount' => opp.Amount,
                    'CloseDate' => opp.CloseDate,
                    'OwnerName' => opp.Owner?.Name
                });
            }

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + opportunities.size() + ' opportunities with probability >= ' +
                            minimumProbability + '%',
                'count' => opportunities.size(),
                'minimumProbability' => minimumProbability,
                'includeClosed' => includeClosed,
                'totalPipelineValue' => totalAmount,
                'opportunities' => opportunityDetails,
                'OpportunityId' => (opportunities.size() > 0 ? opportunities[0].Id : null)
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
}
