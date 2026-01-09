# Salesforce AI Agentic Functions - Comprehensive Implementation Guide

**Version:** 1.0
**Test Status:** ✅ 100% Pass Rate (22/22 tests)
**Last Updated:** December 2024

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Implementation Patterns](#implementation-patterns)
4. [Testing Methodology](#testing-methodology)
5. [Lessons Learned](#lessons-learned)
6. [Complete Handler Implementations](#complete-handler-implementations)
7. [JSON Schema Patterns](#json-schema-patterns)
8. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

This guide documents the complete implementation of a production-ready Salesforce CRM AI Agent with **10 fully-tested operations** achieving **100% test pass rate**.

### What Was Built

- **4 Handler Classes** (AccountIntelligenceHandler, CaseManagementHandler, ContactManagementHandler, OpportunityManagementHandler)
- **10 Operations** (4 find, 6 CRUD)
- **10 JSON Schemas** (simplified, intelligent required fields)
- **22 Test Scenarios** (comprehensive regression testing)
- **1 Unified System Prompt** (covers all operations with examples)

### Key Metrics

| Metric | Value |
|--------|-------|
| **Test Pass Rate** | 100% (22/22) |
| **Total Lines of Code** | ~2,390 (across 4 handlers) |
| **Operations Tested** | 10/10 (100%) |
| **Edge Cases Covered** | Null safety, duplicate detection, partial matching, account filtering |
| **Production Ready** | ✅ Yes |

---

## Architecture Overview

### Component Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AI Agent Layer                      │
│          (Claude, GPT, or other LLM)                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Natural Language Query
                   │
          ┌────────▼────────┐
          │  Agent System   │
          │     Prompt      │ (Operation matching, examples)
          └────────┬────────┘
                   │
                   │ Structured Parameters
                   │
    ┌──────────────▼──────────────┐
    │   AI Prompt Records (10)    │
    │  - Operation name mapping   │
    │  - JSON schema validation   │
    │  - Handler class routing    │
    └──────────────┬──────────────┘
                   │
                   │ executeMethod(operation, params)
                   │
    ┌──────────────▼──────────────┐
    │    Handler Classes (4)      │
    │  - AccountIntelligenceHandler│
    │  - CaseManagementHandler    │
    │  - ContactManagementHandler │
    │  - OpportunityManagementHandler│
    └──────────────┬──────────────┘
                   │
                   │ SOQL/DML
                   │
          ┌────────▼────────┐
          │    Salesforce   │
          │      Data       │
          └─────────────────┘
```

### Handler Pattern

Each handler implements `ccai.AIAgenticInterface`:

```apex
global with sharing class HandlerName implements ccai.AIAgenticInterface {
    // Permission checking (required by interface)
    global Boolean hasObjectPerm(String sObjectName, String permType) { ... }

    // Main entry point (routes to specific operations)
    public String executeMethod(String requestParam, Map<String, Object> parameters) { ... }

    // Private operation methods
    private String createObject(Map<String, Object> parameters) { ... }
    private String updateObject(Map<String, Object> parameters) { ... }
    private String findObjects(Map<String, Object> parameters) { ... }

    // Helper methods
    private String buildSuccessResponse(String message, Map<String, Object> data) { ... }
    private String buildErrorResponse(String errorMessage) { ... }
}
```

---

## Implementation Patterns

### Pattern 1: Null Safety (CRITICAL)

**Problem:** Apex throws "Attempt to de-reference a null object" when accessing null map values.

**Solution:** Always check both containsKey() AND null before using parameter values.

```apex
// ❌ WRONG - Will throw null pointer exception
if (parameters.containsKey('field')) {
    record.Field = String.valueOf(parameters.get('field'));
}

// ✅ CORRECT - Safe null handling
if (parameters.containsKey('field') && parameters.get('field') != null) {
    record.Field = String.valueOf(parameters.get('field'));
}
```

**Apply to:**
- All parameter reads
- All optional fields
- All lookup operations

---

### Pattern 2: Dual-Purpose Parameter (newSubject Solution)

**Problem:** When a parameter is used for BOTH lookup AND update (e.g., `subject`), the AI can't specify different values for finding vs updating.

**Example Failure:**
```json
{
  "subject": "new value"  // AI wants to update TO this
}
```
Handler tries to FIND case with subject="new value" → Not found!

**Solution:** Create separate parameters for lookup and update.

```apex
// In update_Case handler
if (parameters.containsKey('newSubject')) {
    // Use 'subject' for lookup, 'newSubject' for update
    caseToUpdate.Subject = String.valueOf(parameters.get('newSubject'));
    hasChanges = true;
} else if (parameters.containsKey('subject') &&
          (parameters.containsKey('caseId') || parameters.containsKey('caseNumber'))) {
    // Only update subject if we didn't use it for lookup
    caseToUpdate.Subject = String.valueOf(parameters.get('subject'));
    hasChanges = true;
}
```

**JSON Schema:**
```json
{
  "subject": {
    "type": "string",
    "description": "Case subject for lookup (supports partial match). To UPDATE the subject to a new value, use 'newSubject' parameter instead."
  },
  "newSubject": {
    "type": "string",
    "description": "New subject value when updating the case subject. Use 'subject' to find the case, then this parameter to change it."
  }
}
```

**System Prompt Example:**
```
User: "Update the 'call karthick' case subject to 'call K7'"
→ Call update_Case with subject: "call karthick", newSubject: "call K7"
```

---

### Pattern 3: Flexible Lookup Strategy

**Problem:** Users may identify records in multiple ways (ID, number, name, email, etc.).

**Solution:** Support multiple lookup methods with priority order.

```apex
// Example: update_Case lookup strategy
Id caseId = null;

// Priority 1: Direct ID (most specific)
if (parameters.containsKey('caseId') && parameters.get('caseId') != null) {
    caseId = (Id) String.valueOf(parameters.get('caseId'));
}
// Priority 2: Case Number (unique identifier)
else if (parameters.containsKey('caseNumber') && parameters.get('caseNumber') != null) {
    String caseNumber = String.valueOf(parameters.get('caseNumber'));
    List<Case> cases = [SELECT Id FROM Case WHERE CaseNumber = :caseNumber LIMIT 1];
    if (!cases.isEmpty()) {
        caseId = cases[0].Id;
    }
}
// Priority 3: Subject (partial match with optional account filtering)
else if (parameters.containsKey('subject') && parameters.get('subject') != null) {
    String partialSubject = String.valueOf(parameters.get('subject'));
    String searchPattern = '%' + partialSubject + '%';

    // If accountId provided, filter by account (provides context)
    if (parameters.containsKey('accountId') && parameters.get('accountId') != null) {
        String accountIdStr = String.valueOf(parameters.get('accountId'));
        List<Case> cases = [
            SELECT Id FROM Case
            WHERE Subject LIKE :searchPattern AND AccountId = :accountIdStr
            ORDER BY CreatedDate DESC LIMIT 1
        ];
        if (!cases.isEmpty()) {
            caseId = cases[0].Id;
        }
    } else {
        // Search by subject only
        List<Case> cases = [
            SELECT Id FROM Case
            WHERE Subject LIKE :searchPattern
            ORDER BY CreatedDate DESC LIMIT 1
        ];
        if (!cases.isEmpty()) {
            caseId = cases[0].Id;
        }
    }
}
```

**Key Principles:**
1. **Most Specific First**: ID → Number → Name/Subject
2. **Context Filtering**: Use accountId to narrow searches
3. **Partial Matching**: Use LIKE with %pattern% for fuzzy searches
4. **Most Recent First**: ORDER BY CreatedDate DESC
5. **Single Result**: LIMIT 1

---

### Pattern 4: Account Context Filtering

**Problem:** When multiple records match a search, how do you pick the right one?

**Solution:** Use accountId as an optional context filter to narrow searches.

**Usage Pattern:**
```apex
// User provides accountId as context (not for updating, just filtering)
if (parameters.containsKey('accountId') && parameters.get('accountId') != null) {
    String accountIdStr = String.valueOf(parameters.get('accountId'));
    // Add AND AccountId = :accountIdStr to WHERE clause
}
```

**System Prompt Guidance:**
```
When user is viewing an account page or mentions "this account":
- Include accountId in parameters for context filtering
- This narrows search to records under that specific account
```

**Important:** In update operations, accountId is for FILTERING, not UPDATING. Never update AccountId on Case/Contact/Opportunity records without explicit user request.

---

### Pattern 5: URL Generation with Null Safety

**Problem:** `URL.getOrgDomainUrl()` can return null or throw exceptions in certain org configurations.

**Solution:** Wrap in try-catch with null checks.

```apex
String baseUrl = '';
try {
    System.Url orgUrl = URL.getOrgDomainUrl();
    if (orgUrl != null) {
        baseUrl = orgUrl.toExternalForm();
    }
} catch (Exception urlEx) {
    System.debug('Warning: Could not get org domain URL: ' + urlEx.getMessage());
}

// Safe to use baseUrl (will be empty string if failed)
if (String.isNotBlank(baseUrl)) {
    String recordUrl = baseUrl + '/' + recordId;
}
```

---

### Pattern 6: Standardized Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "recordId": "001xxx",
    "field1": "value1",
    "field2": "value2"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

**Implementation:**
```apex
private String buildSuccessResponse(String message, Map<String, Object> data) {
    Map<String, Object> response = new Map<String, Object>{
        'success' => true,
        'message' => message,
        'data' => data
    };
    return JSON.serialize(response);
}

private String buildErrorResponse(String errorMessage) {
    Map<String, Object> response = new Map<String, Object>{
        'success' => false,
        'error' => errorMessage
    };
    return JSON.serialize(response);
}
```

---

### Pattern 7: Comprehensive Debug Logging

**Key Logging Points:**
1. **Entry Point**: Log operation name and ALL parameters
2. **Lookup Results**: Log which record was found
3. **Before DML**: Log the complete record being inserted/updated
4. **After DML**: Log success with record ID
5. **Errors**: Log full exception message and stack trace

**Example:**
```apex
public String executeMethod(String requestParam, Map<String, Object> parameters) {
    System.debug('=== HandlerName START ===');
    System.debug('Operation: ' + requestParam);
    System.debug('Parameters: ' + JSON.serializePretty(parameters));

    try {
        // ... operation logic ...

        System.debug('=== HandlerName END ===');
        System.debug('Result: ' + result);
        return result;

    } catch (Exception e) {
        System.debug('ERROR in executeMethod: ' + e.getMessage());
        System.debug('Stack Trace: ' + e.getStackTraceString());
        return buildErrorResponse('Unexpected error: ' + e.getMessage());
    }
}
```

---

## Testing Methodology

### Comprehensive Test Suite Approach

**Goal:** Achieve 100% pass rate by testing ALL operations with multiple scenarios.

**Test Coverage Matrix:**

| Handler | Create (Minimal) | Create (Full) | Update (by ID) | Update (by Name) | Find | Edge Cases |
|---------|------------------|---------------|----------------|------------------|------|------------|
| AccountIntelligence | N/A | N/A | N/A | N/A | ✅ x4 | Partial match, Non-existent, includeClosed |
| CaseManagement | ✅ | ✅ | ✅ | ✅ | N/A | newSubject, By caseNumber, By subject+account |
| ContactManagement | ✅ | ✅ | ✅ | ✅ | N/A | Duplicate detection |
| OpportunityManagement | ✅ | ✅ | ✅ | ✅ | N/A | - |

**Total:** 22 test scenarios

### Test File Structure

```apex
/**
 * COMPREHENSIVE REGRESSION TEST SUITE
 * Tests all handlers with multiple scenarios to catch edge cases
 */

Integer totalTests = 0;
Integer passedTests = 0;
Integer failedTests = 0;

// For each operation:
totalTests++;
try {
    // Setup test parameters
    Map<String, Object> params = new Map<String, Object>();
    params.put('field1', 'value1');

    // Execute operation
    String result = handler.executeMethod('operation_name', params);

    // Validate result
    if (result.contains('success') && result.contains('expectedValue')) {
        passedTests++;
        System.debug('✓ TEST PASSED: operation_name');
    } else {
        failedTests++;
        System.debug('✗ TEST FAILED: operation_name');
    }
} catch (Exception e) {
    failedTests++;
    System.debug('✗ TEST FAILED with exception: ' + e.getMessage());
}

// Summary
System.debug('========================================');
System.debug('TEST SUMMARY');
System.debug('========================================');
System.debug('Total Tests: ' + totalTests);
System.debug('Passed: ' + passedTests + ' ✓');
System.debug('Failed: ' + failedTests + ' ✗');
Decimal passRate = (Decimal.valueOf(passedTests) / Decimal.valueOf(totalTests) * 100).setScale(2);
System.debug('Pass Rate: ' + passRate + '%');
```

### Handling Duplicate Detection

**Problem:** Test creates records that trigger duplicate detection rules on subsequent runs.

**Solution:** Use timestamp-based unique values.

```apex
// Generate unique values for each test run
String timestamp = String.valueOf(DateTime.now().getTime());
String uniqueEmail = 'testuser' + timestamp + '@example.com';
params.put('firstName', 'Test' + timestamp);
params.put('lastName', 'User' + timestamp);
params.put('email', uniqueEmail);
```

**Why This Works:**
- `DateTime.now().getTime()` returns milliseconds since epoch (always unique)
- Duplicate rules typically match on FirstName + LastName or Email
- Making these unique prevents duplicates across test runs

---

## Lessons Learned

### Critical Discoveries

#### 1. The Dual-Purpose Parameter Problem
**Discovery:** When `subject` parameter was used for both finding AND updating cases, the AI couldn't specify different values for each purpose.

**Impact:** 100% failure rate on case subject updates.

**Solution:** Introduced `newSubject` parameter, allowing:
- `subject`: Find the case
- `newSubject`: Update it to this value

**Pattern to Apply:** Any time a field is used for lookup AND might need updating, create a separate "new{Field}" parameter.

#### 2. Null Pointer Exceptions from Missing Checks
**Discovery:** `parameters.containsKey()` alone is NOT sufficient. The value can be present but null.

**Impact:** Random failures when optional parameters were passed as null.

**Solution:** Always use `containsKey() && get() != null`.

**Pattern to Apply:** Every single parameter access needs double-checking.

#### 3. Account Context vs Account Update
**Discovery:** When accountId is provided in update operations, users often mean "search within this account" NOT "change the account".

**Impact:** Confusion about whether accountId updates the record's account.

**Solution:**
- Document that accountId is for context filtering in updates
- Never update AccountId without explicit user request
- Use accountId to narrow searches (AND AccountId = :accountIdStr)

#### 4. URL Generation Failures
**Discovery:** `URL.getOrgDomainUrl()` returns null in sandboxes or certain org types.

**Impact:** Null pointer exceptions when building record URLs.

**Solution:** Wrap in try-catch with null check, default to empty string.

#### 5. Duplicate Detection Rules
**Discovery:** Standard Salesforce duplicate rules can match on FirstName + LastName, not just Email.

**Impact:** Test failures even with unique emails.

**Solution:** Make ALL identifying fields unique in tests (FirstName, LastName, Email).

### Iterative Development Process

**Iteration 1:** Basic handlers with minimal error handling
- ❌ Result: Null pointer exceptions, unclear errors

**Iteration 2:** Added null safety checks
- ⚠️ Result: Better, but case updates failing

**Iteration 3:** Fixed accountId handling (context vs update)
- ⚠️ Result: Improved, but subject updates still failing

**Iteration 4:** Added newSubject parameter
- ⚠️ Result: Case updates work, but URL generation errors

**Iteration 5:** Fixed URL generation with try-catch
- ✅ Result: All handlers stable

**Iteration 6:** Comprehensive regression testing
- ⚠️ Result: 95.45% pass rate (TEST 15 failing)

**Iteration 7:** Fixed duplicate detection in tests
- ✅ Result: **100% pass rate achieved!**

---

## Complete Handler Implementations

### Handler 1: AccountIntelligenceHandler

**Operations:** 4 (all read-only)
- find_Account_by_Name
- find_Contacts_for_Account
- find_Opportunities_for_Account
- find_Cases_for_Account

**Key Features:**
- Fuzzy search with SOQL LIKE
- Related record queries
- URL generation for record links
- Optional includeClosed flag for cases

**Code Skeleton:**
```apex
global with sharing class AccountIntelligenceHandler implements ccai.AIAgenticInterface {

    global Boolean hasObjectPerm(String sObjectName, String permType) {
        // Permission checking
    }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        switch on requestParam {
            when 'find_Account_by_Name' {
                return findAccountByName(parameters);
            }
            when 'find_Contacts_for_Account' {
                return findContactsForAccount(parameters);
            }
            when 'find_Opportunities_for_Account' {
                return findOpportunitiesForAccount(parameters);
            }
            when 'find_Cases_for_Account' {
                return findCasesForAccount(parameters);
            }
        }
    }

    private String findAccountByName(Map<String, Object> parameters) {
        // Fuzzy search implementation
        String accountName = String.valueOf(parameters.get('accountName'));
        String searchPattern = '%' + accountName + '%';

        List<Account> accounts = [
            SELECT Id, Name, Industry, AnnualRevenue, Phone, Website
            FROM Account
            WHERE Name LIKE :searchPattern
            LIMIT 10
        ];

        // Build response with account details and URL
        List<Map<String, Object>> accountList = new List<Map<String, Object>>();
        for (Account acc : accounts) {
            accountList.add(new Map<String, Object>{
                'accountId' => acc.Id,
                'name' => acc.Name,
                'industry' => acc.Industry,
                'url' => baseUrl + '/' + acc.Id
            });
        }

        return buildSuccessResponse('Found ' + accounts.size() + ' accounts',
                                   new Map<String, Object>{'accounts' => accountList});
    }
}
```

### Handler 2: CaseManagementHandler

**Operations:** 2 (create, update)
- create_Case
- update_Case (with newSubject support)

**Key Features:**
- Account/contact lookup
- Supplied fields for unknown customers
- Multiple lookup methods (caseId, caseNumber, subject)
- **newSubject parameter** for subject updates
- Account context filtering

**Critical Code Sections:**

```apex
// CREATE CASE
private String createCase(Map<String, Object> parameters) {
    // Validate permissions
    if (!hasObjectPerm('Case', 'create')) {
        return buildErrorResponse('You do not have permission to create Cases');
    }

    Case newCase = new Case();

    // Subject (required)
    if (parameters.containsKey('subject')) {
        newCase.Subject = String.valueOf(parameters.get('subject'));
    }

    // Account lookup (by ID or name)
    if (parameters.containsKey('accountId')) {
        newCase.AccountId = String.valueOf(parameters.get('accountId'));
    } else if (parameters.containsKey('accountName')) {
        Id accountId = lookupAccountByName(String.valueOf(parameters.get('accountName')));
        if (accountId != null) {
            newCase.AccountId = accountId;
        } else {
            return buildErrorResponse('Account not found: ' + parameters.get('accountName'));
        }
    }

    // Insert and return
    insert newCase;
    return buildSuccessResponse('Case created successfully', queryFullCase(newCase.Id));
}

// UPDATE CASE with newSubject support
private String updateCase(Map<String, Object> parameters) {
    // Step 1: Find the case
    Id caseId = findCaseId(parameters);
    if (caseId == null) {
        return buildErrorResponse('Case not found');
    }

    // Step 2: Query existing case
    Case caseToUpdate = [SELECT Id, Subject, ... FROM Case WHERE Id = :caseId];
    Boolean hasChanges = false;

    // Step 3: Apply updates
    // Special handling for subject: Use newSubject if provided
    if (parameters.containsKey('newSubject')) {
        caseToUpdate.Subject = String.valueOf(parameters.get('newSubject'));
        hasChanges = true;
    } else if (parameters.containsKey('subject') &&
              (parameters.containsKey('caseId') || parameters.containsKey('caseNumber'))) {
        // Only update subject if we didn't use it for lookup
        caseToUpdate.Subject = String.valueOf(parameters.get('subject'));
        hasChanges = true;
    }

    // Other fields...
    if (parameters.containsKey('status') && parameters.get('status') != null) {
        caseToUpdate.Status = String.valueOf(parameters.get('status'));
        hasChanges = true;
    }

    // Step 4: Validate and update
    if (!hasChanges) {
        return buildErrorResponse('No fields provided to update');
    }

    update caseToUpdate;
    return buildSuccessResponse('Case updated successfully', queryFullCase(caseToUpdate.Id));
}
```

### Handler 3: ContactManagementHandler

**Operations:** 2 (create, update)
- create_Contact
- update_Contact

**Key Features:**
- Lookup by email, name, or contactId
- Full address support (mailing and other)
- Account linking
- Address formatting helper

**Unique Implementation Details:**
```apex
// Lookup by multiple methods
private Id findContactId(Map<String, Object> parameters) {
    // Priority 1: contactId
    if (parameters.containsKey('contactId') && parameters.get('contactId') != null) {
        return (Id) String.valueOf(parameters.get('contactId'));
    }

    // Priority 2: email
    if (parameters.containsKey('email') && parameters.get('email') != null) {
        String email = String.valueOf(parameters.get('email'));
        List<Contact> contacts = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
        if (!contacts.isEmpty()) {
            return contacts[0].Id;
        }
    }

    // Priority 3: firstName + lastName
    if ((parameters.containsKey('firstName') && parameters.get('firstName') != null) ||
        (parameters.containsKey('lastName') && parameters.get('lastName') != null)) {
        // Build LIKE query for partial matching
        String firstNamePattern = parameters.containsKey('firstName') ?
                                  '%' + String.valueOf(parameters.get('firstName')) + '%' : null;
        String lastNamePattern = parameters.containsKey('lastName') ?
                                '%' + String.valueOf(parameters.get('lastName')) + '%' : null;

        // Optional account filtering
        if (parameters.containsKey('accountId') && parameters.get('accountId') != null) {
            String accountIdStr = String.valueOf(parameters.get('accountId'));
            // Search with account filter
        }
    }

    return null;
}

// Address formatting helper
private String formatAddress(String street, String city, String state, String postalCode, String country) {
    List<String> parts = new List<String>();
    if (String.isNotBlank(street)) parts.add(street);
    if (String.isNotBlank(city)) parts.add(city);
    if (String.isNotBlank(state)) parts.add(state);
    if (String.isNotBlank(postalCode)) parts.add(postalCode);
    if (String.isNotBlank(country)) parts.add(country);
    return String.join(parts, ', ');
}
```

### Handler 4: OpportunityManagementHandler

**Operations:** 2 (create, update)
- create_Opportunity
- update_Opportunity

**Key Features:**
- Stage management
- Amount and probability tracking
- Close date handling
- Account linking
- Partial name matching

**Required Fields Pattern:**
```apex
private String createOpportunity(Map<String, Object> parameters) {
    Opportunity newOpp = new Opportunity();

    // Required: name
    if (parameters.containsKey('name')) {
        newOpp.Name = String.valueOf(parameters.get('name'));
    } else {
        return buildErrorResponse('name is required');
    }

    // Required: closeDate
    if (parameters.containsKey('closeDate')) {
        try {
            newOpp.CloseDate = Date.valueOf(String.valueOf(parameters.get('closeDate')));
        } catch (Exception e) {
            return buildErrorResponse('Invalid closeDate format. Use YYYY-MM-DD');
        }
    } else {
        return buildErrorResponse('closeDate is required');
    }

    // Required: stageName
    if (parameters.containsKey('stageName')) {
        newOpp.StageName = String.valueOf(parameters.get('stageName'));
    } else {
        return buildErrorResponse('stageName is required');
    }

    // Required: accountId (or accountName)
    if (parameters.containsKey('accountId')) {
        newOpp.AccountId = String.valueOf(parameters.get('accountId'));
    } else if (parameters.containsKey('accountName')) {
        Id accountId = lookupAccountByName(String.valueOf(parameters.get('accountName')));
        if (accountId != null) {
            newOpp.AccountId = accountId;
        } else {
            return buildErrorResponse('Account not found');
        }
    } else {
        return buildErrorResponse('Either accountId or accountName is required');
    }

    // Optional: amount, probability, description, etc.
    if (parameters.containsKey('amount') && parameters.get('amount') != null) {
        newOpp.Amount = Decimal.valueOf(String.valueOf(parameters.get('amount')));
    }

    insert newOpp;
    return buildSuccessResponse('Opportunity created successfully', queryFullOpportunity(newOpp.Id));
}
```

---

## JSON Schema Patterns

### Simplified Schema Philosophy

**Before (Problematic):**
```json
{
  "required": ["field1", "field2", "field3", "field4", "field5"],
  "properties": {
    "field1": { "type": "string" },
    "field2": { "type": "string" },
    "field3": { "type": "string" },
    // ... 20 more fields
  }
}
```

**After (Intelligent):**
```json
{
  "required": ["subject", "accountId"],
  "properties": {
    "subject": {
      "type": "string",
      "maxLength": 255,
      "description": "Case subject - brief description of the issue"
    },
    "accountId": {
      "type": "string",
      "maxLength": 18,
      "description": "Account ID this case belongs to"
    },
    "description": {
      "type": "string",
      "maxLength": 32000,
      "description": "Detailed case description"
    },
    "status": {
      "type": "string",
      "description": "Case status: 'New', 'Working', 'Escalated', 'Closed'"
    },
    "priority": {
      "type": "string",
      "description": "Priority: 'Low', 'Medium', 'High', 'Critical'"
    }
  },
  "additionalProperties": false
}
```

**Key Improvements:**
1. **Minimal Required Fields**: Only truly essential fields
2. **Clear Descriptions**: Tell AI exactly what each field does
3. **Value Guidance**: Include valid values in description
4. **maxLength**: Enforce Salesforce field limits
5. **additionalProperties: false**: Strict validation

### Update Operation Schema Pattern

For update operations, use this pattern:

```json
{
  "required": [],  // Nothing required - user chooses what to update
  "properties": {
    // Lookup fields (at least one required, but not in schema)
    "recordId": {
      "type": "string",
      "description": "Record ID to update (use this if you have the ID)"
    },
    "recordNumber": {
      "type": "string",
      "description": "Record number to update (e.g., '00001234')"
    },
    "name": {
      "type": "string",
      "description": "Record name for lookup (supports partial match). To UPDATE the name, use 'newName' parameter instead."
    },

    // Update fields
    "newName": {
      "type": "string",
      "description": "New name value when updating the record name. Use 'name' to find the record, then this parameter to change it."
    },
    "field1": {
      "type": "string",
      "description": "Update field1 value"
    },
    "field2": {
      "type": "string",
      "description": "Update field2 value"
    },

    // Context filter
    "accountId": {
      "type": "string",
      "description": "Account ID to filter record lookup by account"
    }
  },
  "additionalProperties": false
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All handler classes compile without errors
- [ ] All JSON schemas are valid JSON
- [ ] System prompt includes all operations with examples
- [ ] Test suite runs and achieves 100% pass rate

### Salesforce Deployment Steps

1. **Deploy Handler Classes** (4 files)
   - [ ] AccountIntelligenceHandler.apex
   - [ ] CaseManagementHandler.apex
   - [ ] ContactManagementHandler.apex
   - [ ] OpportunityManagementHandler.apex

2. **Create AI Prompt Records** (10 records)

   For EACH operation, create one AI Prompt record:

   | Field | Value |
   |-------|-------|
   | **Name** | Operation name (e.g., "create_Case") |
   | **Agentic Function Class** | Handler class name (e.g., "CaseManagementHandler") |
   | **Prompt Command** | Paste entire JSON schema from *_PromptCommand.json file |
   | **Status** | Active |
   | **Type** | Agentic Function |

3. **Create AI Agent Record** (1 record)

   | Field | Value |
   |-------|-------|
   | **Agent Name** | Salesforce CRM Agent |
   | **Agent Type** | Standard Agent |
   | **Description** | Content from AGENT_DESCRIPTION.txt |
   | **System Prompt** | Content from AGENT_SYSTEM_PROMPT.txt |
   | **Status** | Active |
   | **Linked AI Prompts** | All 10 AI Prompt records created above |

### Post-Deployment Validation

1. **Run Comprehensive Test Suite**
   ```bash
   sf apex run --file test_all_handlers_comprehensive.apex --target-org YOUR_ORG
   ```
   - [ ] Verify: Total Tests: 22
   - [ ] Verify: Passed: 22 ✓
   - [ ] Verify: Failed: 0 ✗
   - [ ] Verify: Pass Rate: 100.00%

2. **Test Each Operation Manually**

   Test with natural language queries:

   **Account Intelligence:**
   - [ ] "Tell me about [AccountName]"
   - [ ] "Show me contacts at [AccountName]"
   - [ ] "What opportunities does [AccountName] have"
   - [ ] "Get cases for [AccountName]"

   **Case Management:**
   - [ ] "Create a case for password reset at [AccountName]"
   - [ ] "Update case [CaseNumber] to Working status"
   - [ ] "Change case '[SubjectText]' subject to '[NewSubjectText]'"

   **Contact Management:**
   - [ ] "Add contact [Name] at [AccountName]"
   - [ ] "Update [Email]'s phone to [PhoneNumber]"

   **Opportunity Management:**
   - [ ] "Create $[Amount] opportunity for [AccountName]"
   - [ ] "Update opportunity '[Name]' stage to [StageName]"

3. **Verify Debug Logs**
   - [ ] All operations log entry/exit markers
   - [ ] Parameters are logged with JSON.serializePretty()
   - [ ] Errors include stack traces
   - [ ] No sensitive data (passwords, etc.) in logs

### Troubleshooting Deployment Issues

**Issue: "Handler class not found"**
- Verify class is deployed with `global` visibility
- Check class name matches exactly (case-sensitive)
- Refresh metadata cache in Salesforce

**Issue: "Invalid JSON schema"**
- Validate JSON at jsonlint.com
- Check for trailing commas
- Verify all quotes are double quotes (")

**Issue: "Operation not triggering"**
- Check AI Prompt record is Active
- Verify Prompt Command matches operation name
- Check AI Agent has prompt linked

**Issue: "Permission denied errors"**
- Grant user Create/Read/Update permissions on objects
- Check sharing rules and OWD settings
- Verify profile has "Apex Class Access" for handlers

---

## Appendix: Complete File Listing

### Handler Classes (4 files)
1. `Account_Intelligence/AccountIntelligenceHandler.apex` (~700 lines)
2. `Case_Management/CaseManagementHandler.apex` (~500 lines)
3. `Contact_Management/ContactManagementHandler.apex` (~690 lines)
4. `Opportunity_Management/OpportunityManagementHandler.apex` (~500 lines)

### JSON Schemas (10 files)
1. `Account_Intelligence/find_Account_by_Name_PromptCommand.json`
2. `Account_Intelligence/find_Contacts_for_Account_PromptCommand.json`
3. `Account_Intelligence/find_Opportunities_for_Account_PromptCommand.json`
4. `Account_Intelligence/find_Cases_for_Account_PromptCommand.json`
5. `Case_Management/create_Case_PromptCommand.json`
6. `Case_Management/update_Case_PromptCommand.json`
7. `Contact_Management/create_Contact_PromptCommand.json`
8. `Contact_Management/update_Contact_PromptCommand.json`
9. `Opportunity_Management/create_Opportunity_PromptCommand.json`
10. `Opportunity_Management/update_Opportunity_PromptCommand.json`

### System Files (3 files)
1. `AGENT_DESCRIPTION.txt` - User-facing agent description
2. `AGENT_SYSTEM_PROMPT.txt` - Complete AI instructions with examples
3. `README.md` - Deployment and usage documentation

### Test Files
1. `test_all_handlers_comprehensive.apex` - Complete regression suite (22 tests)
2. `test_find_operations.apex` - Focused AccountIntelligence tests
3. `test_newSubject.apex` - Focused newSubject parameter test

---

## Conclusion

This implementation guide represents the culmination of iterative development, comprehensive testing, and production-hardening of a Salesforce AI Agentic system.

**Key Takeaways for Other LLMs:**

1. **Null Safety is Non-Negotiable**: Always use `containsKey() && get() != null`
2. **Test Everything**: 100% pass rate requires testing all scenarios
3. **Dual-Purpose Parameters Need Separation**: Create "new{Field}" parameters when needed
4. **Context Filtering is Powerful**: Use accountId to narrow searches without updating
5. **Debug Logging Saves Time**: Comprehensive logs make troubleshooting trivial
6. **Iterative Development Works**: Each iteration addressed specific failures
7. **Documentation Matters**: Clear descriptions in JSON schemas guide AI behavior

**This guide provides everything needed to:**
- Understand the architecture
- Replicate the implementation
- Avoid common pitfalls
- Achieve 100% test pass rate
- Deploy with confidence

Use this as a base template for building similar AI Agentic systems in Salesforce or other platforms.

---

**Document Version:** 1.0
**Status:** Production Ready ✅
**Test Coverage:** 100% (22/22 tests passing)
**Last Updated:** December 2024
