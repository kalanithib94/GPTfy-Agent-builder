/**
 * @description
 *   UpdateOpportunityStageDateHandler implements the AIAgenticInterface and serves as a handler
 *   for updating opportunity stage and close date. This specialized handler focuses on moving
 *   opportunities through the sales pipeline by updating StageName and CloseDate fields.
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 01-09-2026
 */
public with sharing class UpdateOpportunityStageDateHandler implements AIAgenticInterface {

    // SECTION 1: Permission Check Method
    private Boolean hasObjectPerm(String sObjectName, String permType) {
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

    // SECTION 3: Request Dispatcher
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            switch on requestParam {
                when 'update_Opportunity_Stage_CloseDate' {
                    return updateOpportunityStageDate(parameters);
                }
                when else {
                    return errorResponse('Method is not defined. This handler only supports: update_Opportunity_Stage_CloseDate');
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    // SECTION 4: Implementation Method
    public String updateOpportunityStageDate(Map<String, Object> parameters) {
        System.debug('=== UpdateOpportunityStageDateHandler START ===');
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        // 1. Check permissions
        if (!hasObjectPerm('Opportunity', 'read')) {
            return errorResponse('Insufficient read permission on Opportunity object.');
        }
        if (!hasObjectPerm('Opportunity', 'update')) {
            return errorResponse('Insufficient update permission on Opportunity object.');
        }

        // 2. Validate required parameters
        if (!parameters.containsKey('opportunityId') ||
            String.isBlank(String.valueOf(parameters.get('opportunityId')))) {
            return errorResponse('opportunityId is required.');
        }
        if (!parameters.containsKey('stageName') ||
            String.isBlank(String.valueOf(parameters.get('stageName')))) {
            return errorResponse('stageName is required.');
        }
        if (!parameters.containsKey('closeDate') ||
            String.isBlank(String.valueOf(parameters.get('closeDate')))) {
            return errorResponse('closeDate is required.');
        }

        String opportunityId = String.valueOf(parameters.get('opportunityId'));
        String newStageName = String.valueOf(parameters.get('stageName'));
        String closeDateStr = String.valueOf(parameters.get('closeDate'));

        // 3. Validate Opportunity ID format
        if (!isValidId(opportunityId) || !opportunityId.startsWith('006')) {
            return errorResponse('Invalid Opportunity ID format. Opportunity ID must be a valid 15 or 18 character ID starting with 006.');
        }

        // 4. Validate and parse Close Date
        Date newCloseDate;
        try {
            newCloseDate = Date.valueOf(closeDateStr);
        } catch (Exception e) {
            return errorResponse('Invalid closeDate format. Use YYYY-MM-DD format (e.g., 2026-03-31).');
        }

        // 5. Query the opportunity
        List<Opportunity> opps = [
            SELECT Id, Name, StageName, CloseDate, Amount, Probability,
                   Account.Name, Owner.Name, IsClosed, IsWon
            FROM Opportunity
            WHERE Id = :opportunityId
            LIMIT 1
        ];

        if (opps.isEmpty()) {
            return errorResponse('Opportunity not found with ID: ' + opportunityId);
        }

        Opportunity oppRecord = opps[0];
        System.debug('Found Opportunity: ' + oppRecord.Name);

        // 6. Check if opportunity is already closed
        if (oppRecord.IsClosed) {
            return errorResponse('Cannot update a closed opportunity. Opportunity "' + oppRecord.Name + '" is already closed with stage: ' + oppRecord.StageName);
        }

        // 7. Perform update
        try {
            String oldStageName = oppRecord.StageName;
            Date oldCloseDate = oppRecord.CloseDate;

            oppRecord.StageName = newStageName;
            oppRecord.CloseDate = newCloseDate;

            System.debug('Updating opportunity: ' + JSON.serializePretty(oppRecord));

            update oppRecord;

            System.debug('Opportunity updated successfully: ' + oppRecord.Id);

            // 8. Query back the full updated record
            Opportunity updatedOpp = [
                SELECT Id, Name, StageName, CloseDate, Amount, Probability,
                       Type, LeadSource, Description, NextStep, LastModifiedDate,
                       Account.Name, Owner.Name, IsClosed, IsWon
                FROM Opportunity
                WHERE Id = :oppRecord.Id
                LIMIT 1
            ];

            // 9. Build redirect URL
            String redirectUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + updatedOpp.Id;

            // 10. Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Successfully updated opportunity "' + updatedOpp.Name + '" from stage "' + oldStageName + '" to "' + newStageName + '" and moved close date from ' + oldCloseDate + ' to ' + newCloseDate,
                'data' => new Map<String, Object>{
                    'opportunityId' => updatedOpp.Id,
                    'name' => updatedOpp.Name,
                    'oldStageName' => oldStageName,
                    'newStageName' => updatedOpp.StageName,
                    'oldCloseDate' => oldCloseDate,
                    'newCloseDate' => updatedOpp.CloseDate,
                    'amount' => updatedOpp.Amount,
                    'probability' => updatedOpp.Probability,
                    'type' => updatedOpp.Type,
                    'leadSource' => updatedOpp.LeadSource,
                    'description' => updatedOpp.Description,
                    'nextStep' => updatedOpp.NextStep,
                    'accountName' => updatedOpp.Account?.Name,
                    'ownerName' => updatedOpp.Owner?.Name,
                    'lastModifiedDate' => updatedOpp.LastModifiedDate,
                    'isClosed' => updatedOpp.IsClosed,
                    'isWon' => updatedOpp.IsWon,
                    'redirectUrl' => redirectUrl
                },
                'action' => 'redirect'
            });

        } catch (DmlException dmlEx) {
            System.debug('DML Error: ' + dmlEx.getMessage());
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'DML Error: ' + dmlEx.getDmlMessage(0)
            });
        } catch (Exception ex) {
            System.debug('Error: ' + ex.getMessage());
            return errorResponse(ex);
        }
    }

    // SECTION 5: Helper Method
    private Boolean isValidId(String recordId) {
        if (String.isBlank(recordId)) {
            return false;
        }
        // Check if it's 15 or 18 characters
        Integer idLength = recordId.length();
        if (idLength != 15 && idLength != 18) {
            return false;
        }
        // Basic alphanumeric check
        return recordId.isAlphanumeric();
    }
}
