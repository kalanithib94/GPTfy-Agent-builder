/**
 * @description
 *   DocumentIntelligenceHandler implements the AIAgenticInterface and provides
 *   simple read-only operations to help identify Salesforce Files (ContentDocument)
 *   by name, optionally scoped to a specific record.
 *
 *   Supported Operations:
 *   - find_Document_by_Name: Finds documents/files by title with optional
 *     record filter and result limit.
 *
 * @author              AI Agentic Architecture
 * @group               Plumcloud Labs
 */
global with sharing class DocumentIntelligenceHandler implements ccai.AIAgenticInterface {

    global Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.SObjectType t = Schema.getGlobalDescribe().get(sObjectName);
        if (t == null) return false;
        Schema.DescribeSObjectResult d = t.getDescribe();
        if (permType == 'read')      return d.isAccessible();
        if (permType == 'create')    return d.isCreateable();
        if (permType == 'update')    return d.isUpdateable();
        if (permType == 'delete')    return d.isDeletable();
        return false;
    }

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

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        System.debug('=== DocumentIntelligenceHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        String response;
        try {
            switch on requestParam {
                when 'find_Document_by_Name' {
                    response = findDocumentByName(parameters);
                }
                when else {
                    response = errorResponse('Method is not defined. Supported methods: find_Document_by_Name');
                }
            }
        } catch (Exception ex) {
            response = errorResponse(ex);
        }

        System.debug('Response: ' + response);
        System.debug('=== DocumentIntelligenceHandler END ===');
        return response;
    }

    /**
     * Finds Salesforce Files (ContentDocument) by title.
     * Parameters: documentName (required), linkedRecordId (optional), limit (optional).
     */
    public String findDocumentByName(Map<String, Object> parameters) {
        if (!hasObjectPerm('ContentDocument', 'read')) {
            return errorResponse('Insufficient read permission on ContentDocument object.');
        }

        try {
            if (!parameters.containsKey('documentName') ||
                String.isBlank(String.valueOf(parameters.get('documentName')))) {
                return errorResponse('documentName is required.');
            }

            String documentName = String.valueOf(parameters.get('documentName')).trim();

            Integer resultLimit = 10;
            if (parameters.containsKey('limit') && parameters.get('limit') != null) {
                Object limitValue = parameters.get('limit');
                if (limitValue instanceof Integer) {
                    resultLimit = (Integer) limitValue;
                } else {
                    try {
                        resultLimit = Integer.valueOf(String.valueOf(limitValue));
                    } catch (Exception e) {
                        // keep default
                    }
                }
            }
            if (resultLimit <= 0) resultLimit = 10;

            String pattern = '%' + String.escapeSingleQuotes(documentName) + '%';
            List<Map<String, Object>> docs = new List<Map<String, Object>>();

            String baseUrl = '';
            try {
                System.Url orgUrl = URL.getOrgDomainUrl();
                if (orgUrl != null) baseUrl = orgUrl.toExternalForm();
            } catch (Exception urlEx) {
                System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
            }

            Id linkedRecordId;
            if (parameters.containsKey('linkedRecordId') &&
                !String.isBlank(String.valueOf(parameters.get('linkedRecordId')))) {
                try {
                    linkedRecordId = Id.valueOf(String.valueOf(parameters.get('linkedRecordId')));
                } catch (Exception e) {
                    return errorResponse('linkedRecordId must be a valid Salesforce Id.');
                }
            }

            if (linkedRecordId != null) {
                List<ContentDocumentLink> links = [
                    SELECT ContentDocument.Id,
                           ContentDocument.Title,
                           ContentDocument.FileExtension,
                           ContentDocument.FileType,
                           ContentDocument.LatestPublishedVersionId,
                           ContentDocument.CreatedDate,
                           ContentDocument.Owner.Name
                    FROM ContentDocumentLink
                    WHERE LinkedEntityId = :linkedRecordId
                      AND ContentDocument.Title LIKE :pattern
                    ORDER BY ContentDocument.CreatedDate DESC
                    LIMIT :resultLimit
                ];

                for (ContentDocumentLink link : links) {
                    ContentDocument cd = link.ContentDocument;
                    if (cd == null) continue;
                    String docUrl = String.isNotBlank(baseUrl) ? baseUrl + '/' + cd.Id : null;
                    docs.add(new Map<String, Object>{
                        'documentId' => cd.Id,
                        'title' => cd.Title,
                        'fileExtension' => cd.FileExtension,
                        'fileType' => cd.FileType,
                        'latestVersionId' => cd.LatestPublishedVersionId,
                        'createdDate' => cd.CreatedDate,
                        'ownerName' => cd.Owner != null ? cd.Owner.Name : null,
                        'linkedRecordId' => linkedRecordId,
                        'detailUrl' => docUrl
                    });
                }
            } else {
                List<ContentDocument> cds = [
                    SELECT Id, Title, FileExtension, FileType, LatestPublishedVersionId,
                           CreatedDate, Owner.Name
                    FROM ContentDocument
                    WHERE Title LIKE :pattern
                    ORDER BY CreatedDate DESC
                    LIMIT :resultLimit
                ];

                for (ContentDocument cd : cds) {
                    String docUrl = String.isNotBlank(baseUrl) ? baseUrl + '/' + cd.Id : null;
                    docs.add(new Map<String, Object>{
                        'documentId' => cd.Id,
                        'title' => cd.Title,
                        'fileExtension' => cd.FileExtension,
                        'fileType' => cd.FileType,
                        'latestVersionId' => cd.LatestPublishedVersionId,
                        'createdDate' => cd.CreatedDate,
                        'ownerName' => cd.Owner != null ? cd.Owner.Name : null,
                        'detailUrl' => docUrl
                    });
                }
            }

            if (docs.isEmpty()) {
                return JSON.serialize(new Map<String, Object>{
                    'success' => true,
                    'status' => 'success',
                    'message' => 'No documents found with name matching: ' + documentName,
                    'count' => 0,
                    'documents' => new List<Object>()
                });
            }

            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Found ' + docs.size() + ' document(s).',
                'count' => docs.size(),
                'documents' => docs,
                'primaryDocumentId' => docs[0].get('documentId')
            });
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }
}
