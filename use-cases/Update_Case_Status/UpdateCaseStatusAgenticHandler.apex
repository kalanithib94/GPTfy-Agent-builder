/**
 * @description
 *   UpdateCaseStatusAgenticHandler implements the AIAgenticInterface and serves as a handler
 *   for updating case status with optional resolution notes. Supports updating case status
 *   to 'In Progress', 'Closed', or other valid status values with proper validation.
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 12-18-2025
 */
public with sharing class UpdateCaseStatusAgenticHandler implements AIAgenticInterface {

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
                when 'update_Case_Status' {
                    return updateCaseStatus(parameters);
                }
                when else {
                    return errorResponse('Method is not defined. This handler only supports: update_Case_Status');
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    // SECTION 4: Implementation Method
    public String updateCaseStatus(Map<String, Object> parameters) {
        // 1. Check permissions
        if (!hasObjectPerm('Case', 'read')) {
            return errorResponse('Insufficient read permission on Case object.');
        }
        if (!hasObjectPerm('Case', 'update')) {
            return errorResponse('Insufficient update permission on Case object.');
        }

        // 2. Validate required parameters
        if (!parameters.containsKey('caseId') ||
            String.isBlank(String.valueOf(parameters.get('caseId')))) {
            return errorResponse('caseId is required.');
        }
        if (!parameters.containsKey('status') ||
            String.isBlank(String.valueOf(parameters.get('status')))) {
            return errorResponse('status is required.');
        }

        String caseId = String.valueOf(parameters.get('caseId'));
        String newStatus = String.valueOf(parameters.get('status'));

        // 3. Validate Case ID format
        if (!isValidId(caseId) || !caseId.startsWith('500')) {
            return errorResponse('Invalid Case ID format. Case ID must be a valid 15 or 18 character ID starting with 500.');
        }

        // 4. Validate status value
        List<String> validStatuses = new List<String>{
            'New', 'Working', 'In Progress', 'Escalated',
            'On Hold', 'Closed', 'Closed - Resolved', 'Closed - Not Resolved'
        };
        if (!validStatuses.contains(newStatus)) {
            return errorResponse('Invalid status value. Valid values: ' + String.join(validStatuses, ', '));
        }

        // 5. Query the case
        List<Case> cases = [
            SELECT Id, CaseNumber, Status, Subject, IsClosed
            FROM Case
            WHERE Id = :caseId
            LIMIT 1
        ];

        if (cases.isEmpty()) {
            return errorResponse('Case not found with ID: ' + caseId);
        }

        Case caseRecord = cases[0];

        // 6. Check if case is already closed
        if (caseRecord.IsClosed && newStatus != 'Closed' && !newStatus.startsWith('Closed')) {
            return errorResponse('Cannot reopen a closed case. Case Number: ' + caseRecord.CaseNumber + ' is already closed with status: ' + caseRecord.Status);
        }

        // 7. Perform update
        try {
            String oldStatus = caseRecord.Status;
            caseRecord.Status = newStatus;

            // Add resolution notes if provided
            if (parameters.containsKey('resolutionNotes') &&
                String.isNotBlank(String.valueOf(parameters.get('resolutionNotes')))) {
                String resolutionNotes = String.valueOf(parameters.get('resolutionNotes'));

                // Append to description or use a custom field
                // Option 1: Append to Description
                if (String.isNotBlank(caseRecord.Description)) {
                    caseRecord.Description += '\n\n--- Resolution Notes ---\n' + resolutionNotes;
                } else {
                    caseRecord.Description = '--- Resolution Notes ---\n' + resolutionNotes;
                }

                // Option 2: If you have a custom field like Resolution_Notes__c, use:
                // caseRecord.Resolution_Notes__c = resolutionNotes;
            }

            update caseRecord;

            // 8. Build redirect URL
            String redirectUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + caseRecord.Id;

            // 9. Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Successfully updated case status from "' + oldStatus + '" to "' + newStatus + '"',
                'caseId' => caseRecord.Id,
                'caseNumber' => caseRecord.CaseNumber,
                'oldStatus' => oldStatus,
                'newStatus' => newStatus,
                'subject' => caseRecord.Subject,
                'redirectUrl' => redirectUrl,
                'action' => 'redirect'
            });

        } catch (DmlException dmlEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'DML Error: ' + dmlEx.getDmlMessage(0)
            });
        } catch (Exception ex) {
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
