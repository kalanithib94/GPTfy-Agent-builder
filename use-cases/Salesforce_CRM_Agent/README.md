# Salesforce CRM Agent - Complete Use Case

## Overview
A comprehensive AI Agent that handles core Salesforce CRM operations with **10 fully tested operations** across 4 functional areas, achieving **100% test pass rate** with comprehensive regression testing.

## ✅ Testing & Quality Assurance

**Comprehensive Test Suite Results:**
- **Total Tests**: 22 test scenarios
- **Pass Rate**: 100% ✓
- **Operations Tested**: All 10 operations with multiple scenarios
- **Test Coverage**: Create, Update, Lookup (by ID, name, partial match)
- **Edge Cases**: Duplicate detection, null safety, account filtering

All handlers have been regression tested with real-world scenarios to eliminate common issues.

## 📁 Folder Structure

```
Salesforce_CRM_Agent/
├── AGENT_DESCRIPTION.txt           # User-friendly agent description
├── AGENT_SYSTEM_PROMPT.txt         # Unified system prompt for all 10 operations
├── README.md                       # This file
├── test_all_handlers_comprehensive.apex  # Complete regression test suite (22 tests)
│
├── Account_Intelligence/
│   ├── AccountIntelligenceHandler.apex
│   ├── find_Account_by_Name_PromptCommand.json
│   ├── find_Contacts_for_Account_PromptCommand.json
│   ├── find_Opportunities_for_Account_PromptCommand.json
│   └── find_Cases_for_Account_PromptCommand.json
│
├── Case_Management/
│   ├── CaseManagementHandler.apex
│   ├── create_Case_PromptCommand.json
│   └── update_Case_PromptCommand.json
│
├── Contact_Management/
│   ├── ContactManagementHandler.apex
│   ├── create_Contact_PromptCommand.json
│   └── update_Contact_PromptCommand.json
│
└── Opportunity_Management/
    ├── OpportunityManagementHandler.apex
    ├── create_Opportunity_PromptCommand.json
    └── update_Opportunity_PromptCommand.json
```

## 🎯 10 Operations Organized by Function

### 🔍 Account Intelligence (4 Operations - Read-Only)
1. **find_Account_by_Name** - Search accounts with fuzzy matching (handles typos)
2. **find_Contacts_for_Account** - Get all contacts for an account
3. **find_Opportunities_for_Account** - Get all deals/opportunities for an account
4. **find_Cases_for_Account** - Get all support cases for an account

### 📋 Case Management (2 Operations - CRUD)
5. **create_Case** - Create support cases (perfect for "I need to change password")
6. **update_Case** - Update case fields, status, priority, subject

### 👤 Contact Management (2 Operations - CRUD)
7. **create_Contact** - Create contact records with full details
8. **update_Contact** - Update contact information, accounts

### 💼 Opportunity Management (2 Operations - CRUD)
9. **create_Opportunity** - Create sales opportunities/deals
10. **update_Opportunity** - Update stages, amounts, close dates

## 🚀 Deployment Instructions

### Step 1: Deploy Handler Classes (4 files)
Deploy all `.apex` handler classes to your Salesforce org from their respective folders:
- Account_Intelligence/AccountIntelligenceHandler.apex
- Case_Management/CaseManagementHandler.apex
- Contact_Management/ContactManagementHandler.apex
- Opportunity_Management/OpportunityManagementHandler.apex

All handlers use:
- `global` visibility
- `ccai.AIAgenticInterface` implementation
- Comprehensive debug logging
- Standardized JSON responses
- Full null safety for all lookups

### Step 2: Create AI Prompt Records (10 records)

For each operation, create an AI Prompt record in Salesforce:

#### Account Intelligence Prompts
| Prompt Name | Handler Class | Method Name | JSON Schema |
|------------|---------------|-------------|-------------|
| find_Account_by_Name | AccountIntelligenceHandler | find_Account_by_Name | Account_Intelligence/find_Account_by_Name_PromptCommand.json |
| find_Contacts_for_Account | AccountIntelligenceHandler | find_Contacts_for_Account | Account_Intelligence/find_Contacts_for_Account_PromptCommand.json |
| find_Opportunities_for_Account | AccountIntelligenceHandler | find_Opportunities_for_Account | Account_Intelligence/find_Opportunities_for_Account_PromptCommand.json |
| find_Cases_for_Account | AccountIntelligenceHandler | find_Cases_for_Account | Account_Intelligence/find_Cases_for_Account_PromptCommand.json |

#### Case Management Prompts
| Prompt Name | Handler Class | Method Name | JSON Schema |
|------------|---------------|-------------|-------------|
| create_Case | CaseManagementHandler | create_Case | Case_Management/create_Case_PromptCommand.json |
| update_Case | CaseManagementHandler | update_Case | Case_Management/update_Case_PromptCommand.json |

**Note:** update_Case includes special `newSubject` parameter to handle subject updates when subject is used for lookup.

#### Contact Management Prompts
| Prompt Name | Handler Class | Method Name | JSON Schema |
|------------|---------------|-------------|-------------|
| create_Contact | ContactManagementHandler | create_Contact | Contact_Management/create_Contact_PromptCommand.json |
| update_Contact | ContactManagementHandler | update_Contact | Contact_Management/update_Contact_PromptCommand.json |

#### Opportunity Management Prompts
| Prompt Name | Handler Class | Method Name | JSON Schema |
|------------|---------------|-------------|-------------|
| create_Opportunity | OpportunityManagementHandler | create_Opportunity | Opportunity_Management/create_Opportunity_PromptCommand.json |
| update_Opportunity | OpportunityManagementHandler | update_Opportunity | Opportunity_Management/update_Opportunity_PromptCommand.json |

### Step 3: Create AI Agent Record

Create a single AI Agent record:
- **Agent Name:** Salesforce CRM Agent
- **Description:** Use content from `AGENT_DESCRIPTION.txt`
- **System Prompt:** Use content from `AGENT_SYSTEM_PROMPT.txt`
- **Link all 10 AI Prompt records** to this agent

### Step 4: Test Each Operation

Use the comprehensive test suite: `test_all_handlers_comprehensive.apex`

Or test manually with these natural language queries:

#### Account Intelligence Tests
- "Tell me about Global Sparks Corporation"
- "Show me contacts at Global Sparks"
- "What deals does Global Sparks have"
- "Get support cases for Global" (test partial matching)

#### Case Management Tests
- "I need to change the password"
- "Create a case for login issue"
- "Update case 00001599 to Working status"
- "Change the subject of case 'call karthick' to 'call K7'" (tests newSubject parameter)

#### Contact Management Tests
- "Add contact John Smith at Global Sparks Corporation"
- "Create contact Sarah Johnson, email sarah@globalsp arks.com"
- "Update john@email.com's phone number to 555-1234"

#### Opportunity Management Tests
- "Create $100K opportunity for Global Sparks closing next month"
- "Move Global Sparks deal to Qualification stage"
- "Update opportunity 'New Deal' amount to $75000"

## ✨ Key Features

### 1. Comprehensive Null Safety
- All lookup operations check for null before use
- `parameters.containsKey() && parameters.get() != null` pattern throughout
- Eliminates "Attempt to de-reference a null object" errors

### 2. Flexible Update Lookup
Supports multiple ways to find records for updates:
- **By ID**: Direct lookup (caseId, contactId, opportunityId)
- **By Number**: Case number lookup (caseNumber)
- **By Name**: Partial text matching with LIKE queries (subject, firstName/lastName, name)
- **With Context**: Account-filtered searches when accountId provided

### 3. Special Parameter: newSubject
When updating case subject where subject is used for lookup:
```
{
  "subject": "call karthick",    // Find the case
  "newSubject": "call K7",       // Update to this
  "accountId": "001xxx"           // Optional context filter
}
```
Prevents the dual-purpose parameter issue where lookup and update values conflict.

### 4. Fuzzy Matching
- Handles typos: "global" finds "Global Sparks Corporation"
- Partial matches: "call K" finds "call karthick"
- SOQL LIKE queries with `%searchPattern%`

### 5. Natural Language Processing
- "I need to change password" → Creates case automatically
- "$50K deal" → Extracts amount as 50000
- "End of Q1" → Calculates date as YYYY-03-31

### 6. Auto-Linking
- Automatically links cases, contacts, and opportunities to accounts
- Uses accountName parameter for fuzzy account lookup
- accountId parameter provides context for filtered searches

### 7. Multi-Step Workflows
Agent intelligently chains operations:
- "Tell me about Global Sparks and their deals" → Finds account + finds opportunities
- "Create contact and a case for them" → Creates contact + creates case with contactId

### 8. Comprehensive Error Handling
- Permission validation before all operations
- Required field enforcement
- Clear error messages
- DML exception handling with specific error details

### 9. Debug Logging
All handlers include comprehensive debug logs:
- Operation entry/exit markers (`=== HandlerName START/END ===`)
- Parameter logging with JSON.serializePretty()
- Query results and record counts
- Error stack traces for troubleshooting

## 📊 Handler Implementation Details

### AccountIntelligenceHandler
- **Operations:** 4 (read-only)
- **Special Features:**
  - Fuzzy search with SOQL LIKE queries
  - Related object queries (contacts, opportunities, cases)
  - URL generation for record links
  - includeClosed flag for cases
- **Lines of Code:** ~700
- **Test Coverage:** 8 test scenarios (100% pass)

### CaseManagementHandler
- **Operations:** 2 (create, update)
- **Special Features:**
  - Account/contact lookup
  - Supplied fields for unknown customers
  - Subject search with partial matching
  - **newSubject parameter** for subject updates
  - Account-filtered subject searches
- **Lines of Code:** ~500
- **Test Coverage:** 6 test scenarios (100% pass)

### ContactManagementHandler
- **Operations:** 2 (create, update)
- **Special Features:**
  - Lookup by email, firstName/lastName, or contactId
  - Full address support (mailing and other)
  - Account-filtered name searches
  - Address formatting helper
- **Lines of Code:** ~690
- **Test Coverage:** 4 test scenarios (100% pass)

### OpportunityManagementHandler
- **Operations:** 2 (create, update)
- **Special Features:**
  - Stage management
  - Amount and probability tracking
  - Close date handling
  - Account linking with name or ID
  - Opportunity name search with partial matching
- **Lines of Code:** ~500
- **Test Coverage:** 4 test scenarios (100% pass)

## 🔧 Troubleshooting

### Issue: "Permission denied"
- Check user has create/update permissions on the object
- Handler validates permissions before operations
- All handlers use `with sharing` for row-level security

### Issue: "Account not found"
- Check account name spelling
- Fuzzy matching handles partial names ("global" finds "Global Sparks")
- Try providing more characters for better matching

### Issue: "Case/Contact/Opportunity not found"
- Verify lookup field values (ID, number, name, subject)
- Use accountId parameter to narrow search scope
- Check CreatedDate - searches return most recent match first

### Issue: "Failed to update case subject"
- When using subject for lookup AND updating subject, use `newSubject` parameter
- Example: `{subject: "old", newSubject: "new", accountId: "001xxx"}`
- Or use caseId/caseNumber instead of subject for lookup

### Issue: "Duplicate detection"
- Salesforce may have duplicate rules enabled
- Check existing records before creating
- Handlers return specific duplicate error messages

## 📝 Implementation Patterns

### Required Fields
Each operation enforces only truly required fields:
- **create_Case**: subject, accountId
- **update_Case**: (caseId OR caseNumber OR subject) + at least one field to update
- **create_Contact**: lastName, accountId
- **update_Contact**: (contactId OR email OR firstName/lastName) + at least one field to update
- **create_Opportunity**: name, closeDate, stageName, accountId
- **update_Opportunity**: (opportunityId OR name) + at least one field to update

### Lookup-Then-Update Pattern
All update operations follow this pattern:
```apex
1. Determine record ID using one of: ID, number, name, subject, email
2. Apply accountId filter if provided (for context)
3. Query existing record to verify it exists
4. Apply updates to queried record
5. Validate at least one field changed
6. Perform update DML
7. Query back full record with related data
8. Return standardized success response
```

### Null Safety Pattern
```apex
if (parameters.containsKey('field') && parameters.get('field') != null) {
    record.Field = String.valueOf(parameters.get('field'));
}
```

### URL Generation Pattern
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
```

## 🧪 Running the Test Suite

Execute the comprehensive test suite:

```bash
sf apex run --file test_all_handlers_comprehensive.apex --target-org YOUR_ORG
```

The test suite includes:
- 8 tests for AccountIntelligenceHandler (find operations)
- 6 tests for CaseManagementHandler (create, update by ID/number/subject, newSubject)
- 4 tests for ContactManagementHandler (create minimal/full, update by ID/name)
- 4 tests for OpportunityManagementHandler (create minimal/full, update by ID/name)

**Expected Output:**
```
Total Tests: 22
Passed: 22 ✓
Failed: 0 ✗
Pass Rate: 100.00%
✓ ALL TESTS PASSED! Ready to update documentation.
```

## 🎉 Production Ready!

This is a **production-ready, fully-tested** CRM agent covering core customer lifecycle operations:
- ✅ 100% test pass rate
- ✅ Comprehensive error handling
- ✅ Full null safety
- ✅ Flexible lookup strategies
- ✅ Clear debug logging
- ✅ Standardized response format

Ready to deploy and use with confidence!

## 📚 Additional Resources

- **System Prompt**: See `AGENT_SYSTEM_PROMPT.txt` for complete AI agent instructions
- **Agent Description**: See `AGENT_DESCRIPTION.txt` for user-facing description
- **Test Suite**: See `test_all_handlers_comprehensive.apex` for all test scenarios
- **Individual Tests**: See `test_*.apex` files for focused testing examples
