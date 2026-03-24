/**
 * @description
 *   CPQAgentHandler implements AIAgenticInterface for full Salesforce CPQ operations:
 *   Pricebook lookup, Opportunity CRUD, SBQQ Quote CRUD, SBQQ QuoteLine CRUD with bundle support.
 *   Always look up pricebook/pricebook entries before creating quote line items.
 *
 * @author              AI Agentic Architecture
 * @group               Plumcloud Labs
 * @last modified on    02-25-2026
 */
global with sharing class CPQAgentHandler implements ccai.AIAgenticInterface {

    private static final String OBJ_QUOTE = 'SBQQ__Quote__c';
    private static final String OBJ_QUOTE_LINE = 'SBQQ__QuoteLine__c';

    global Boolean hasObjectPerm(String sObjectName, String permType) {
        try {
            Schema.SObjectType t = Schema.getGlobalDescribe().get(sObjectName);
            if (t == null) return false;
            Schema.DescribeSObjectResult d = t.getDescribe();
            if (permType == 'read') return d.isAccessible();
            if (permType == 'create') return d.isCreateable();
            if (permType == 'update') return d.isUpdateable();
            if (permType == 'delete') return d.isDeletable();
            return false;
        } catch (Exception e) {
            System.debug('Permission check error: ' + e.getMessage());
            return false;
        }
    }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        System.debug('=== CPQAgentHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;
            switch on requestParam {
                when 'find_Pricebook' { result = findPricebook(parameters); }
                when 'find_PricebookEntry' { result = findPricebookEntry(parameters); }
                when 'create_CPQ_Opportunity' { result = createOpportunity(parameters); }
                when 'find_CPQ_Opportunity' { result = findOpportunity(parameters); }
                when 'update_CPQ_Opportunity' { result = updateOpportunity(parameters); }
                when 'create_SBQQ_Quote' { result = createSBQQQuote(parameters); }
                when 'find_SBQQ_Quote' { result = findSBQQQuote(parameters); }
                when 'update_SBQQ_Quote' { result = updateSBQQQuote(parameters); }
                when 'delete_SBQQ_Quote' { result = deleteSBQQQuote(parameters); }
                when 'create_SBQQ_QuoteLine' { result = createSBQQQuoteLine(parameters); }
                when 'update_SBQQ_QuoteLine' { result = updateSBQQQuoteLine(parameters); }
                when 'delete_SBQQ_QuoteLine' { result = deleteSBQQQuoteLine(parameters); }
                when else { result = buildErrorResponse('Unknown operation: ' + requestParam); }
            }
            System.debug('=== CPQAgentHandler END ===');
            return result;
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    // ---------- Pricebook ----------
    private String findPricebook(Map<String, Object> parameters) {
        if (!hasObjectPerm('Pricebook2', 'read')) {
            return buildErrorResponse('Insufficient permission to read Pricebook2.');
        }
        try {
            String nameFilter = parameters.containsKey('name') ? '%' + String.escapeSingleQuotes(String.valueOf(parameters.get('name'))) + '%' : null;
            Boolean standardOnly = parameters.containsKey('standardOnly') && Boolean.valueOf(parameters.get('standardOnly'));

            List<Pricebook2> pbs;
            if (nameFilter != null && standardOnly) {
                pbs = [SELECT Id, Name, IsStandard, IsActive, Description FROM Pricebook2 WHERE Name LIKE :nameFilter AND IsStandard = true AND IsActive = true ORDER BY Name LIMIT 50];
            } else if (nameFilter != null) {
                pbs = [SELECT Id, Name, IsStandard, IsActive, Description FROM Pricebook2 WHERE Name LIKE :nameFilter AND IsActive = true ORDER BY Name LIMIT 50];
            } else if (standardOnly) {
                pbs = [SELECT Id, Name, IsStandard, IsActive, Description FROM Pricebook2 WHERE IsStandard = true AND IsActive = true ORDER BY Name LIMIT 50];
            } else {
                pbs = [SELECT Id, Name, IsStandard, IsActive, Description FROM Pricebook2 WHERE IsActive = true ORDER BY Name LIMIT 50];
            }

            List<Map<String, Object>> items = new List<Map<String, Object>>();
            for (Pricebook2 pb : pbs) {
                items.add(new Map<String, Object>{
                    'id' => pb.Id,
                    'name' => pb.Name,
                    'isStandard' => pb.IsStandard,
                    'isActive' => pb.IsActive,
                    'description' => pb.Description
                });
            }
            return buildSuccessResponse('Found ' + items.size() + ' pricebook(s).', new Map<String, Object>{ 'pricebooks' => items, 'count' => items.size() });
        } catch (Exception e) {
            return buildErrorResponse('find_Pricebook failed: ' + e.getMessage());
        }
    }

    private String findPricebookEntry(Map<String, Object> parameters) {
        if (!hasObjectPerm('PricebookEntry', 'read')) {
            return buildErrorResponse('Insufficient permission to read PricebookEntry.');
        }
        String pricebookId = parameters.containsKey('pricebookId') ? String.valueOf(parameters.get('pricebookId')) : null;
        String productName = parameters.containsKey('productName') ? String.valueOf(parameters.get('productName')) : null;
        String productCode = parameters.containsKey('productCode') ? String.valueOf(parameters.get('productCode')) : null;

        if (String.isBlank(pricebookId)) {
            return buildErrorResponse('pricebookId is required to find PricebookEntry.');
        }
        if (String.isBlank(productName) && String.isBlank(productCode)) {
            return buildErrorResponse('productName or productCode is required.');
        }

        try {
            List<PricebookEntry> pbes;
            if (String.isNotBlank(productCode)) {
                List<Product2> prods = [SELECT Id FROM Product2 WHERE ProductCode = :productCode AND IsActive = true LIMIT 1];
                if (prods.isEmpty()) return buildErrorResponse('No active product found with ProductCode: ' + productCode);
                pbes = [SELECT Id, Name, Product2Id, Product2.Name, Product2.ProductCode, UnitPrice, IsActive FROM PricebookEntry WHERE Pricebook2Id = :pricebookId AND Product2Id = :prods[0].Id AND IsActive = true LIMIT 20];
            } else {
                String searchPattern = '%' + String.escapeSingleQuotes(productName) + '%';
                pbes = [SELECT Id, Name, Product2Id, Product2.Name, Product2.ProductCode, UnitPrice, IsActive FROM PricebookEntry WHERE Pricebook2Id = :pricebookId AND Product2.Name LIKE :searchPattern AND IsActive = true LIMIT 20];
            }

            List<Map<String, Object>> items = new List<Map<String, Object>>();
            for (PricebookEntry pbe : pbes) {
                items.add(new Map<String, Object>{
                    'id' => pbe.Id,
                    'productId' => pbe.Product2Id,
                    'productName' => pbe.Product2 != null ? pbe.Product2.Name : null,
                    'productCode' => pbe.Product2 != null ? pbe.Product2.ProductCode : null,
                    'unitPrice' => pbe.UnitPrice,
                    'isActive' => pbe.IsActive
                });
            }
            return buildSuccessResponse('Found ' + items.size() + ' pricebook entr(y/ies).', new Map<String, Object>{ 'pricebookEntries' => items, 'count' => items.size() });
        } catch (Exception e) {
            return buildErrorResponse('find_PricebookEntry failed: ' + e.getMessage());
        }
    }

    // ---------- Opportunity ----------
    private String createOpportunity(Map<String, Object> parameters) {
        if (!hasObjectPerm('Opportunity', 'create')) return buildErrorResponse('Insufficient permission to create Opportunity.');
        if (!parameters.containsKey('name')) return buildErrorResponse('name is required.');
        if (!parameters.containsKey('closeDate')) return buildErrorResponse('closeDate is required (YYYY-MM-DD).');
        if (!parameters.containsKey('stageName')) return buildErrorResponse('stageName is required.');

        try {
            Opportunity o = new Opportunity();
            o.Name = String.valueOf(parameters.get('name'));
            o.CloseDate = Date.valueOf(String.valueOf(parameters.get('closeDate')));
            o.StageName = String.valueOf(parameters.get('stageName'));

            if (parameters.containsKey('accountId') && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                o.AccountId = String.valueOf(parameters.get('accountId'));
            } else if (parameters.containsKey('accountName')) {
                Id accId = lookupAccountByName(String.valueOf(parameters.get('accountName')));
                if (accId == null) return buildErrorResponse('Account not found: ' + parameters.get('accountName'));
                o.AccountId = accId;
            } else {
                return buildErrorResponse('accountId or accountName is required.');
            }

            if (parameters.containsKey('amount')) o.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount')));
            if (parameters.containsKey('probability')) o.Probability = Decimal.valueOf(String.valueOf(parameters.get('probability')));
            if (parameters.containsKey('pricebook2Id')) o.Pricebook2Id = String.valueOf(parameters.get('pricebook2Id'));
            if (parameters.containsKey('description')) o.Description = String.valueOf(parameters.get('description'));
            if (parameters.containsKey('type')) o.Type = String.valueOf(parameters.get('type'));
            if (parameters.containsKey('nextStep')) o.NextStep = String.valueOf(parameters.get('nextStep'));

            insert o;
            return buildSuccessResponse('Opportunity created.', new Map<String, Object>{ 'opportunityId' => o.Id, 'name' => o.Name });
        } catch (Exception e) {
            return buildErrorResponse('create_CPQ_Opportunity failed: ' + e.getMessage());
        }
    }

    private String findOpportunity(Map<String, Object> parameters) {
        if (!hasObjectPerm('Opportunity', 'read')) return buildErrorResponse('Insufficient permission to read Opportunity.');
        String nameOrId = parameters.containsKey('opportunityId') ? String.valueOf(parameters.get('opportunityId')) : (parameters.containsKey('name') ? String.valueOf(parameters.get('name')) : null);
        if (String.isBlank(nameOrId)) return buildErrorResponse('opportunityId or name is required.');

        try {
            List<Opportunity> opps;
            if (nameOrId.length() == 15 || nameOrId.length() == 18) {
                opps = [SELECT Id, Name, AccountId, Account.Name, StageName, CloseDate, Amount, Probability, Pricebook2Id, CreatedDate FROM Opportunity WHERE Id = :nameOrId LIMIT 1];
            } else {
                String pattern = '%' + String.escapeSingleQuotes(nameOrId) + '%';
                opps = [SELECT Id, Name, AccountId, Account.Name, StageName, CloseDate, Amount, Probability, Pricebook2Id, CreatedDate FROM Opportunity WHERE Name LIKE :pattern ORDER BY CreatedDate DESC LIMIT 20];
            }
            if (opps.isEmpty()) return buildErrorResponse('No opportunity found for: ' + nameOrId);

            List<Map<String, Object>> items = new List<Map<String, Object>>();
            for (Opportunity o : opps) {
                items.add(new Map<String, Object>{
                    'opportunityId' => o.Id, 'name' => o.Name, 'accountId' => o.AccountId, 'accountName' => o.Account != null ? o.Account.Name : null,
                    'stageName' => o.StageName, 'closeDate' => o.CloseDate != null ? o.CloseDate.format() : null, 'amount' => o.Amount, 'probability' => o.Probability,
                    'pricebook2Id' => o.Pricebook2Id
                });
            }
            return buildSuccessResponse('Found ' + items.size() + ' opportunity(ies).', new Map<String, Object>{ 'opportunities' => items, 'count' => items.size(), 'primaryOpportunityId' => opps[0].Id });
        } catch (Exception e) {
            return buildErrorResponse('find_CPQ_Opportunity failed: ' + e.getMessage());
        }
    }

    private String updateOpportunity(Map<String, Object> parameters) {
        if (!hasObjectPerm('Opportunity', 'update')) return buildErrorResponse('Insufficient permission to update Opportunity.');
        String oppId = resolveOpportunityId(parameters);
        if (oppId == null) return buildErrorResponse('opportunityId or name is required.');

        try {
            Opportunity o = [SELECT Id, Name, StageName, CloseDate, Amount, Probability, Description, Pricebook2Id FROM Opportunity WHERE Id = :oppId LIMIT 1];
            Boolean changed = false;
            if (parameters.containsKey('stageName')) { o.StageName = String.valueOf(parameters.get('stageName')); changed = true; }
            if (parameters.containsKey('closeDate')) { o.CloseDate = Date.valueOf(String.valueOf(parameters.get('closeDate'))); changed = true; }
            if (parameters.containsKey('amount')) { o.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount'))); changed = true; }
            if (parameters.containsKey('probability')) { o.Probability = Decimal.valueOf(String.valueOf(parameters.get('probability'))); changed = true; }
            if (parameters.containsKey('description')) { o.Description = String.valueOf(parameters.get('description')); changed = true; }
            if (parameters.containsKey('pricebook2Id')) { o.Pricebook2Id = String.valueOf(parameters.get('pricebook2Id')); changed = true; }
            if (parameters.containsKey('name')) { o.Name = String.valueOf(parameters.get('name')); changed = true; }
            if (!changed) return buildErrorResponse('No updatable fields provided.');
            update o;
            return buildSuccessResponse('Opportunity updated.', new Map<String, Object>{ 'opportunityId' => o.Id });
        } catch (Exception e) {
            return buildErrorResponse('update_CPQ_Opportunity failed: ' + e.getMessage());
        }
    }

    // ---------- SBQQ Quote ----------
    private String createSBQQQuote(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE, 'create')) return buildErrorResponse('Insufficient permission to create SBQQ Quote.');
        if (!parameters.containsKey('name')) return buildErrorResponse('name is required for SBQQ Quote.');

        Boolean hasOpportunity = (parameters.containsKey('opportunityId') && String.isNotBlank(String.valueOf(parameters.get('opportunityId'))))
            || (parameters.containsKey('opportunityName') && String.isNotBlank(String.valueOf(parameters.get('opportunityName'))));
        Boolean hasAccount = (parameters.containsKey('accountId') && String.isNotBlank(String.valueOf(parameters.get('accountId'))))
            || (parameters.containsKey('accountName') && String.isNotBlank(String.valueOf(parameters.get('accountName'))));

        if (!hasOpportunity && !hasAccount) {
            return buildErrorResponse('Provide either opportunityId/opportunityName (existing opportunity) or accountId/accountName to automatically find pricebook and create opportunity, then create quote.');
        }

        try {
            Id oppId = null;
            Id pricebookIdUsed = null;

            if (hasOpportunity) {
                oppId = parameters.containsKey('opportunityId') ? Id.valueOf(String.valueOf(parameters.get('opportunityId'))) : lookupOpportunityByName(String.valueOf(parameters.get('opportunityName')));
                if (oppId == null) return buildErrorResponse('Opportunity not found.');
            } else {
                // Automatically find pricebook and create opportunity
                Id pricebookId = getStandardPricebookId();
                if (pricebookId == null) {
                    List<Pricebook2> pbs = [SELECT Id FROM Pricebook2 WHERE IsActive = true ORDER BY IsStandard DESC NULLS LAST LIMIT 1];
                    pricebookId = pbs.isEmpty() ? null : pbs[0].Id;
                }
                if (pricebookId == null) return buildErrorResponse('No active pricebook found. Cannot create opportunity for quote.');

                Id accountId = parameters.containsKey('accountId') ? Id.valueOf(String.valueOf(parameters.get('accountId'))) : lookupAccountByName(String.valueOf(parameters.get('accountName')));
                if (accountId == null) return buildErrorResponse('Account not found. Provide valid accountId or accountName.');

                String oppName = String.valueOf(parameters.get('name'));
                Date closeDate = Date.today().addMonths(3);
                if (parameters.containsKey('closeDate') && String.isNotBlank(String.valueOf(parameters.get('closeDate')))) {
                    closeDate = Date.valueOf(String.valueOf(parameters.get('closeDate')));
                }
                String stageName = 'Prospecting';
                if (parameters.containsKey('stageName') && String.isNotBlank(String.valueOf(parameters.get('stageName')))) {
                    stageName = String.valueOf(parameters.get('stageName'));
                }

                Opportunity o = new Opportunity(
                    Name = oppName,
                    AccountId = accountId,
                    CloseDate = closeDate,
                    StageName = stageName,
                    Pricebook2Id = pricebookId
                );
                if (parameters.containsKey('amount')) o.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount')));
                if (parameters.containsKey('description')) o.Description = String.valueOf(parameters.get('description'));
                insert o;
                oppId = o.Id;
                pricebookIdUsed = pricebookId;
            }

            SObject q = Schema.getGlobalDescribe().get(OBJ_QUOTE).newSObject();
            q.put('Name', String.valueOf(parameters.get('name')));
            q.put('SBQQ__Opportunity2__c', oppId);

            if (parameters.containsKey('SBQQ__Primary__c')) q.put('SBQQ__Primary__c', Boolean.valueOf(parameters.get('SBQQ__Primary__c')));
            if (parameters.containsKey('SBQQ__Status__c')) q.put('SBQQ__Status__c', String.valueOf(parameters.get('SBQQ__Status__c')));
            if (parameters.containsKey('SBQQ__ExpirationDate__c')) q.put('SBQQ__ExpirationDate__c', Date.valueOf(String.valueOf(parameters.get('SBQQ__ExpirationDate__c'))));
            if (parameters.containsKey('SBQQ__PriceBook__c')) {
                q.put('SBQQ__PriceBook__c', String.valueOf(parameters.get('SBQQ__PriceBook__c')));
            } else if (pricebookIdUsed != null) {
                q.put('SBQQ__PriceBook__c', pricebookIdUsed);
            }

            insert q;
            Id quoteId = (Id) q.get('Id');
            Map<String, Object> data = new Map<String, Object>{ 'quoteId' => quoteId, 'name' => parameters.get('name'), 'opportunityId' => oppId };
            if (pricebookIdUsed != null) data.put('pricebookId', pricebookIdUsed);
            return buildSuccessResponse(hasOpportunity ? 'SBQQ Quote created.' : 'Pricebook found, opportunity created, SBQQ Quote created.', data);
        } catch (Exception e) {
            return buildErrorResponse('create_SBQQ_Quote failed: ' + e.getMessage());
        }
    }

    private String findSBQQQuote(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE, 'read')) return buildErrorResponse('Insufficient permission to read SBQQ Quote.');
        String opportunityId = parameters.containsKey('opportunityId') ? String.valueOf(parameters.get('opportunityId')) : null;
        String quoteName = parameters.containsKey('name') ? String.valueOf(parameters.get('name')) : null;
        String quoteId = parameters.containsKey('quoteId') ? String.valueOf(parameters.get('quoteId')) : null;

        try {
            List<SObject> quotes;
            if (String.isNotBlank(quoteId)) {
                quotes = Database.query('SELECT Id, Name, SBQQ__Opportunity2__c, SBQQ__Opportunity2__r.Name, SBQQ__Status__c, SBQQ__Primary__c, SBQQ__ExpirationDate__c, SBQQ__PriceBook__c, CreatedDate FROM ' + OBJ_QUOTE + ' WHERE Id = :quoteId LIMIT 1');
            } else if (String.isNotBlank(opportunityId)) {
                quotes = Database.query('SELECT Id, Name, SBQQ__Opportunity2__c, SBQQ__Opportunity2__r.Name, SBQQ__Status__c, SBQQ__Primary__c, SBQQ__ExpirationDate__c, SBQQ__PriceBook__c, CreatedDate FROM ' + OBJ_QUOTE + ' WHERE SBQQ__Opportunity2__c = :opportunityId ORDER BY CreatedDate DESC');
            } else if (String.isNotBlank(quoteName)) {
                String pattern = '%' + String.escapeSingleQuotes(quoteName) + '%';
                quotes = Database.query('SELECT Id, Name, SBQQ__Opportunity2__c, SBQQ__Opportunity2__r.Name, SBQQ__Status__c, SBQQ__Primary__c, SBQQ__ExpirationDate__c, SBQQ__PriceBook__c, CreatedDate FROM ' + OBJ_QUOTE + ' WHERE Name LIKE :pattern ORDER BY CreatedDate DESC LIMIT 20');
            } else {
                return buildErrorResponse('quoteId, opportunityId, or name is required.');
            }
            if (quotes == null || quotes.isEmpty()) return buildErrorResponse('No SBQQ Quote found.');

            List<Map<String, Object>> items = new List<Map<String, Object>>();
            for (SObject q : quotes) {
                items.add(new Map<String, Object>{
                    'quoteId' => q.get('Id'), 'name' => q.get('Name'), 'opportunityId' => q.get('SBQQ__Opportunity2__c'),
                    'opportunityName' => q.getSObject('SBQQ__Opportunity2__r') != null ? q.getSObject('SBQQ__Opportunity2__r').get('Name') : null,
                    'status' => q.get('SBQQ__Status__c'), 'primary' => q.get('SBQQ__Primary__c'), 'expirationDate' => q.get('SBQQ__ExpirationDate__c'), 'priceBookId' => q.get('SBQQ__PriceBook__c')
                });
            }
            return buildSuccessResponse('Found ' + items.size() + ' SBQQ Quote(s).', new Map<String, Object>{ 'quotes' => items, 'count' => items.size(), 'primaryQuoteId' => quotes[0].get('Id') });
        } catch (Exception e) {
            return buildErrorResponse('find_SBQQ_Quote failed: ' + e.getMessage());
        }
    }

    private String updateSBQQQuote(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE, 'update')) return buildErrorResponse('Insufficient permission to update SBQQ Quote.');
        String qId = resolveSBQQQuoteId(parameters);
        if (qId == null) return buildErrorResponse('quoteId or name is required.');

        try {
            SObject q = Database.query('SELECT Id, Name, SBQQ__Status__c, SBQQ__Primary__c, SBQQ__ExpirationDate__c, SBQQ__PriceBook__c FROM ' + OBJ_QUOTE + ' WHERE Id = :qId LIMIT 1')[0];
            Boolean changed = false;
            if (parameters.containsKey('name')) { q.put('Name', String.valueOf(parameters.get('name'))); changed = true; }
            if (parameters.containsKey('SBQQ__Status__c')) { q.put('SBQQ__Status__c', String.valueOf(parameters.get('SBQQ__Status__c'))); changed = true; }
            if (parameters.containsKey('SBQQ__Primary__c')) { q.put('SBQQ__Primary__c', Boolean.valueOf(parameters.get('SBQQ__Primary__c'))); changed = true; }
            if (parameters.containsKey('SBQQ__ExpirationDate__c')) { q.put('SBQQ__ExpirationDate__c', Date.valueOf(String.valueOf(parameters.get('SBQQ__ExpirationDate__c')))); changed = true; }
            if (parameters.containsKey('SBQQ__PriceBook__c')) { q.put('SBQQ__PriceBook__c', String.valueOf(parameters.get('SBQQ__PriceBook__c'))); changed = true; }
            if (!changed) return buildErrorResponse('No updatable fields provided.');
            update q;
            return buildSuccessResponse('SBQQ Quote updated.', new Map<String, Object>{ 'quoteId' => qId });
        } catch (Exception e) {
            return buildErrorResponse('update_SBQQ_Quote failed: ' + e.getMessage());
        }
    }

    private String deleteSBQQQuote(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE, 'delete')) return buildErrorResponse('Insufficient permission to delete SBQQ Quote.');
        String qId = resolveSBQQQuoteId(parameters);
        if (qId == null) return buildErrorResponse('quoteId or name is required.');
        try {
            SObject q = Schema.getGlobalDescribe().get(OBJ_QUOTE).newSObject();
            q.put('Id', qId);
            delete q;
            return buildSuccessResponse('SBQQ Quote deleted.', new Map<String, Object>{ 'quoteId' => qId });
        } catch (Exception e) {
            return buildErrorResponse('delete_SBQQ_Quote failed: ' + e.getMessage());
        }
    }

    // ---------- SBQQ Quote Line (with pricebook lookup and bundle) ----------
    private String createSBQQQuoteLine(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE_LINE, 'create')) return buildErrorResponse('Insufficient permission to create SBQQ Quote Line.');
        if (!parameters.containsKey('quoteId') && !parameters.containsKey('quoteName')) return buildErrorResponse('quoteId or quoteName is required.');
        if (!parameters.containsKey('quantity')) return buildErrorResponse('quantity is required.');
        if (!parameters.containsKey('productId') && !parameters.containsKey('productName') && !parameters.containsKey('pricebookEntryId')) {
            return buildErrorResponse('productId, productName, or pricebookEntryId is required. Prefer looking up pricebook first via find_PricebookEntry.');
        }

        try {
            Id quoteId = resolveSBQQQuoteIdForLine(parameters);
            if (quoteId == null) return buildErrorResponse('Quote not found.');

            Id pricebookEntryId = null;
            if (parameters.containsKey('pricebookEntryId')) {
                pricebookEntryId = Id.valueOf(String.valueOf(parameters.get('pricebookEntryId')));
            } else {
                Id pricebookId = null;
                if (parameters.containsKey('pricebookId')) {
                    pricebookId = Id.valueOf(String.valueOf(parameters.get('pricebookId')));
                } else {
                    List<SObject> quotes = Database.query('SELECT SBQQ__PriceBook__c FROM ' + OBJ_QUOTE + ' WHERE Id = :quoteId LIMIT 1');
                    if (!quotes.isEmpty() && quotes[0].get('SBQQ__PriceBook__c') != null) {
                        pricebookId = (Id) quotes[0].get('SBQQ__PriceBook__c');
                    }
                }
                if (pricebookId == null) pricebookId = getStandardPricebookId();
                if (parameters.containsKey('productId')) {
                    pricebookEntryId = lookupPricebookEntryByProductId(Id.valueOf(String.valueOf(parameters.get('productId'))), pricebookId);
                } else if (parameters.containsKey('productName')) {
                    pricebookEntryId = lookupPricebookEntryByProductName(String.valueOf(parameters.get('productName')), pricebookId);
                }
            }
            if (pricebookEntryId == null) return buildErrorResponse('Could not resolve PricebookEntry. Use find_PricebookEntry with pricebookId and productName/productCode first.');

            SObject line = Schema.getGlobalDescribe().get(OBJ_QUOTE_LINE).newSObject();
            line.put('SBQQ__Quote__c', quoteId);
            line.put('SBQQ__Quantity__c', Decimal.valueOf(String.valueOf(parameters.get('quantity'))));
            if (Schema.getGlobalDescribe().get(OBJ_QUOTE_LINE).getDescribe().fields.getMap().containsKey('SBQQ__PricebookEntryId__c')) {
                line.put('SBQQ__PricebookEntryId__c', pricebookEntryId);
            }
            if (Schema.getGlobalDescribe().get(OBJ_QUOTE_LINE).getDescribe().fields.getMap().containsKey('SBQQ__Product__c')) {
                Id productId = getProductIdFromPricebookEntry(pricebookEntryId);
                if (productId != null) line.put('SBQQ__Product__c', productId);
            }
            if (parameters.containsKey('requiredByQuoteLineId')) {
                line.put('SBQQ__RequiredBy__c', String.valueOf(parameters.get('requiredByQuoteLineId')));
            }
            if (parameters.containsKey('SBQQ__ListPrice__c')) line.put('SBQQ__ListPrice__c', Decimal.valueOf(String.valueOf(parameters.get('SBQQ__ListPrice__c'))));
            if (parameters.containsKey('SBQQ__Number__c')) line.put('SBQQ__Number__c', Integer.valueOf(parameters.get('SBQQ__Number__c')));
            if (parameters.containsKey('SBQQ__CustomerPrice__c')) line.put('SBQQ__CustomerPrice__c', Decimal.valueOf(String.valueOf(parameters.get('SBQQ__CustomerPrice__c'))));

            insert line;
            Id lineId = (Id) line.get('Id');
            return buildSuccessResponse('SBQQ Quote Line created (use requiredByQuoteLineId for bundle children).', new Map<String, Object>{ 'quoteLineId' => lineId, 'quoteId' => quoteId });
        } catch (Exception e) {
            return buildErrorResponse('create_SBQQ_QuoteLine failed: ' + e.getMessage());
        }
    }

    private String updateSBQQQuoteLine(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE_LINE, 'update')) return buildErrorResponse('Insufficient permission to update SBQQ Quote Line.');
        String lineId = parameters.containsKey('quoteLineId') ? String.valueOf(parameters.get('quoteLineId')) : null;
        if (String.isBlank(lineId)) return buildErrorResponse('quoteLineId is required.');

        try {
            SObject line = Database.query('SELECT Id, SBQQ__Quantity__c, SBQQ__ListPrice__c, SBQQ__CustomerPrice__c, SBQQ__Number__c FROM ' + OBJ_QUOTE_LINE + ' WHERE Id = :lineId LIMIT 1')[0];
            Boolean changed = false;
            if (parameters.containsKey('quantity')) { line.put('SBQQ__Quantity__c', Decimal.valueOf(String.valueOf(parameters.get('quantity')))); changed = true; }
            if (parameters.containsKey('SBQQ__ListPrice__c')) { line.put('SBQQ__ListPrice__c', Decimal.valueOf(String.valueOf(parameters.get('SBQQ__ListPrice__c')))); changed = true; }
            if (parameters.containsKey('SBQQ__CustomerPrice__c')) { line.put('SBQQ__CustomerPrice__c', Decimal.valueOf(String.valueOf(parameters.get('SBQQ__CustomerPrice__c')))); changed = true; }
            if (parameters.containsKey('SBQQ__Number__c')) { line.put('SBQQ__Number__c', Integer.valueOf(parameters.get('SBQQ__Number__c'))); changed = true; }
            if (!changed) return buildErrorResponse('No updatable fields provided.');
            update line;
            return buildSuccessResponse('SBQQ Quote Line updated.', new Map<String, Object>{ 'quoteLineId' => lineId });
        } catch (Exception e) {
            return buildErrorResponse('update_SBQQ_QuoteLine failed: ' + e.getMessage());
        }
    }

    private String deleteSBQQQuoteLine(Map<String, Object> parameters) {
        if (!hasObjectPerm(OBJ_QUOTE_LINE, 'delete')) return buildErrorResponse('Insufficient permission to delete SBQQ Quote Line.');
        String lineId = parameters.containsKey('quoteLineId') ? String.valueOf(parameters.get('quoteLineId')) : null;
        if (String.isBlank(lineId)) return buildErrorResponse('quoteLineId is required.');
        try {
            SObject line = Schema.getGlobalDescribe().get(OBJ_QUOTE_LINE).newSObject();
            line.put('Id', lineId);
            delete line;
            return buildSuccessResponse('SBQQ Quote Line deleted.', new Map<String, Object>{ 'quoteLineId' => lineId });
        } catch (Exception e) {
            return buildErrorResponse('delete_SBQQ_QuoteLine failed: ' + e.getMessage());
        }
    }

    // ---------- Helpers ----------
    private Id lookupAccountByName(String name) {
        List<Account> accs = [SELECT Id FROM Account WHERE Name = :name LIMIT 1];
        return accs.isEmpty() ? null : accs[0].Id;
    }

    private Id lookupOpportunityByName(String name) {
        List<Opportunity> opps = [SELECT Id FROM Opportunity WHERE Name = :name LIMIT 1];
        if (!opps.isEmpty()) return opps[0].Id;
        String pattern = '%' + String.escapeSingleQuotes(name) + '%';
        opps = [SELECT Id FROM Opportunity WHERE Name LIKE :pattern ORDER BY CreatedDate DESC LIMIT 1];
        return opps.isEmpty() ? null : opps[0].Id;
    }

    private String resolveOpportunityId(Map<String, Object> parameters) {
        if (parameters.containsKey('opportunityId') && String.isNotBlank(String.valueOf(parameters.get('opportunityId')))) return String.valueOf(parameters.get('opportunityId'));
        if (parameters.containsKey('name')) {
            Id id = lookupOpportunityByName(String.valueOf(parameters.get('name')));
            return id != null ? String.valueOf(id) : null;
        }
        return null;
    }

    private String resolveSBQQQuoteId(Map<String, Object> parameters) {
        if (parameters.containsKey('quoteId') && String.isNotBlank(String.valueOf(parameters.get('quoteId')))) return String.valueOf(parameters.get('quoteId'));
        if (parameters.containsKey('name')) {
            String pattern = '%' + String.escapeSingleQuotes(String.valueOf(parameters.get('name'))) + '%';
            List<SObject> qs = Database.query('SELECT Id FROM ' + OBJ_QUOTE + ' WHERE Name LIKE :pattern ORDER BY CreatedDate DESC LIMIT 1');
            return (qs != null && !qs.isEmpty()) ? String.valueOf(qs[0].get('Id')) : null;
        }
        return null;
    }

    private Id resolveSBQQQuoteIdForLine(Map<String, Object> parameters) {
        if (parameters.containsKey('quoteId') && String.isNotBlank(String.valueOf(parameters.get('quoteId')))) return Id.valueOf(String.valueOf(parameters.get('quoteId')));
        if (parameters.containsKey('quoteName')) {
            String pattern = '%' + String.escapeSingleQuotes(String.valueOf(parameters.get('quoteName'))) + '%';
            List<SObject> qs = Database.query('SELECT Id FROM ' + OBJ_QUOTE + ' WHERE Name LIKE :pattern ORDER BY CreatedDate DESC LIMIT 1');
            return (qs != null && !qs.isEmpty()) ? (Id) qs[0].get('Id') : null;
        }
        return null;
    }

    private Id getStandardPricebookId() {
        List<Pricebook2> pbs = [SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1];
        return pbs.isEmpty() ? null : pbs[0].Id;
    }

    private Id lookupPricebookEntryByProductId(Id productId, Id pricebookId) {
        List<PricebookEntry> pbes = [SELECT Id FROM PricebookEntry WHERE Product2Id = :productId AND Pricebook2Id = :pricebookId AND IsActive = true LIMIT 1];
        return pbes.isEmpty() ? null : pbes[0].Id;
    }

    private Id lookupPricebookEntryByProductName(String productName, Id pricebookId) {
        String pattern = '%' + String.escapeSingleQuotes(productName) + '%';
        List<Product2> prods = [SELECT Id FROM Product2 WHERE Name LIKE :pattern AND IsActive = true LIMIT 1];
        if (prods.isEmpty()) return null;
        return lookupPricebookEntryByProductId(prods[0].Id, pricebookId);
    }

    private Id getProductIdFromPricebookEntry(Id pbeId) {
        List<PricebookEntry> pbes = [SELECT Product2Id FROM PricebookEntry WHERE Id = :pbeId LIMIT 1];
        return (pbes != null && !pbes.isEmpty()) ? pbes[0].Product2Id : null;
    }

    private String buildSuccessResponse(String message, Map<String, Object> data) {
        Map<String, Object> payload = new Map<String, Object>{ 'success' => true, 'message' => message };
        if (data != null) payload.putAll(data);
        return JSON.serialize(payload);
    }

    private String buildErrorResponse(String errorMessage) {
        return JSON.serialize(new Map<String, Object>{ 'success' => false, 'error' => errorMessage });
    }
}
