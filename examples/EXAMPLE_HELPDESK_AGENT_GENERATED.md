# Example: Auto-Generated Helpdesk Agent

This is an example showing what an LLM would generate when given the agent description.

---

## Input Description

> "Create a helpdesk agent that can assist users with common IT support issues, troubleshoot technical problems, guide users through software installations, reset passwords, and provide solutions to frequently asked questions. The agent should be friendly, patient, and capable of escalating complex issues to human support staff."

---

## Generated Output

### Summary
- **Agent Name**: `create_Case_for_Support`
- **Purpose**: Create IT support cases with smart categorization and priority detection
- **Objects**: Case, Contact
- **Operation**: CREATE

---

## File 1: CreateSupportCaseAgenticHandler.apex

```apex
/**
 * @description
 *   CreateSupportCaseAgenticHandler implements the AIAgenticInterface and serves as a handler
 *   for creating IT support cases with intelligent categorization and priority detection.
 *   Supports password resets, software installations, hardware issues, and general IT support.
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 18-12-2025
 */
public with sharing class CreateSupportCaseAgenticHandler implements AIAgenticInterface {

    private Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe().get(sObjectName).getDescribe();
        if (permType == 'read')   return describeResult.isAccessible();
        if (permType == 'create') return describeResult.isCreateable();
        if (permType == 'update') return describeResult.isUpdateable();
        if (permType == 'delete') return describeResult.isDeletable();
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
        try {
            switch on requestParam {
                when 'create_Case_for_Support' {
                    return createSupportCase(parameters);
                }
                when else {
                    return errorResponse('Method is not defined. This handler only supports: create_Case_for_Support');
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    public String createSupportCase(Map<String, Object> parameters) {
        // Check permissions
        if (!hasObjectPerm('Case', 'create')) {
            return errorResponse('Insufficient create permission on Case object.');
        }

        // Validate required parameters
        if (!parameters.containsKey('subject') ||
            String.isBlank(String.valueOf(parameters.get('subject')))) {
            return errorResponse('Subject is required.');
        }

        if (!parameters.containsKey('description') ||
            String.isBlank(String.valueOf(parameters.get('description')))) {
            return errorResponse('Description is required.');
        }

        try {
            String subject = String.valueOf(parameters.get('subject'));
            String description = String.valueOf(parameters.get('description'));
            String descLower = description.toLowerCase();

            Case supportCase = new Case();
            supportCase.Subject = subject;
            supportCase.Description = description;

            // Smart Priority Detection
            String priority = 'Medium';
            if (parameters.containsKey('priority')) {
                priority = String.valueOf(parameters.get('priority'));
            } else {
                // Auto-detect from keywords
                if (descLower.contains('urgent') || descLower.contains('critical') ||
                    descLower.contains('emergency') || descLower.contains('down') ||
                    descLower.contains('not working') || descLower.contains('broken')) {
                    priority = 'High';
                } else if (descLower.contains('question') || descLower.contains('how to')) {
                    priority = 'Low';
                }
            }
            supportCase.Priority = priority;

            // Smart Category Detection
            String category = 'Other';
            if (parameters.containsKey('category')) {
                category = String.valueOf(parameters.get('category'));
            } else {
                // Auto-detect from description
                if (descLower.contains('password') || descLower.contains('reset') ||
                    descLower.contains('forgot') || descLower.contains('login')) {
                    category = 'Password Reset';
                } else if (descLower.contains('install') || descLower.contains('software') ||
                           descLower.contains('application') || descLower.contains('program')) {
                    category = 'Software Installation';
                } else if (descLower.contains('hardware') || descLower.contains('laptop') ||
                           descLower.contains('computer') || descLower.contains('mouse') ||
                           descLower.contains('keyboard') || descLower.contains('monitor')) {
                    category = 'Hardware Issue';
                } else if (descLower.contains('network') || descLower.contains('wifi') ||
                           descLower.contains('internet') || descLower.contains('connection')) {
                    category = 'Network Problem';
                } else if (descLower.contains('email') || descLower.contains('outlook') ||
                           descLower.contains('mail')) {
                    category = 'Email Issue';
                }
            }
            supportCase.Type = category;

            // Set Origin
            supportCase.Origin = parameters.containsKey('origin') ?
                String.valueOf(parameters.get('origin')) : 'Chat';

            // Associate with Contact if email provided
            if (parameters.containsKey('contactEmail') &&
                String.isNotBlank(String.valueOf(parameters.get('contactEmail')))) {

                String email = String.valueOf(parameters.get('contactEmail'));

                if (hasObjectPerm('Contact', 'read')) {
                    List<Contact> contacts = [
                        SELECT Id, AccountId, Name
                        FROM Contact
                        WHERE Email = :email
                        LIMIT 1
                    ];

                    if (!contacts.isEmpty()) {
                        supportCase.ContactId = contacts[0].Id;
                        if (contacts[0].AccountId != null) {
                            supportCase.AccountId = contacts[0].AccountId;
                        }
                    }
                }
            }

            // Insert the case
            insert supportCase;

            // Query for Case Number
            supportCase = [SELECT Id, CaseNumber FROM Case WHERE Id = :supportCase.Id LIMIT 1];

            // Build redirect URL
            String redirectUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + supportCase.Id;

            // Return success response
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status' => 'success',
                'message' => 'Support case created successfully',
                'caseId' => supportCase.Id,
                'caseNumber' => supportCase.CaseNumber,
                'subject' => subject,
                'priority' => priority,
                'category' => category,
                'redirectUrl' => redirectUrl,
                'action' => 'redirect'
            });

        } catch (DmlException dmlEx) {
            return JSON.serialize(new Map<String, Object>{
                'success' => false,
                'status' => 'errored',
                'message' => 'DML Error: ' + dmlEx.getDmlMessage(0)
            });
        } catch (QueryException qEx) {
            return errorResponse('Query Error: ' + qEx.getMessage());
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }
}
```

---

## File 2: create_Case_for_Support_PromptCommand.json

```json
{
  "type": "object",
  "required": ["subject", "description"],
  "properties": {
    "subject": {
      "type": "string",
      "maxLength": 255,
      "description": "ONLY the case subject/title. Extract from 'Subject: [value]' or 'Issue: [value]' or 'Problem: [value]' patterns. Example: if input is 'Subject: Cannot access email', extract 'Cannot access email' only. This field is REQUIRED."
    },
    "description": {
      "type": "string",
      "description": "ONLY the detailed description. Extract from 'Description: [value]' or 'Details: [value]' patterns. Include all relevant information about the issue, steps tried, error messages, etc. This field is REQUIRED."
    },
    "priority": {
      "type": "string",
      "enum": ["High", "Medium", "Low"],
      "description": "ONLY the priority level. Extract from 'Priority: [value]' patterns. Valid values: 'High', 'Medium', 'Low'. If keywords like 'urgent', 'critical', 'emergency', 'down', 'not working' appear in description, set to 'High'. If 'question' or 'how to' appears, set to 'Low'. Default: 'Medium'."
    },
    "category": {
      "type": "string",
      "enum": ["Password Reset", "Software Installation", "Hardware Issue", "Network Problem", "Email Issue", "Other"],
      "description": "ONLY the issue category. Extract from 'Category: [value]' or 'Type: [value]' patterns. If not explicitly stated, infer from description: 'password'/'reset'/'login' → 'Password Reset', 'install'/'software' → 'Software Installation', 'hardware'/'laptop'/'computer' → 'Hardware Issue', 'network'/'wifi' → 'Network Problem', 'email'/'outlook' → 'Email Issue'. Valid values: 'Password Reset', 'Software Installation', 'Hardware Issue', 'Network Problem', 'Email Issue', 'Other'. Default: 'Other'."
    },
    "origin": {
      "type": "string",
      "enum": ["Phone", "Email", "Web", "Chat"],
      "description": "ONLY the case origin/channel. Extract from 'Origin: [value]' or 'Channel: [value]' patterns. Valid values: 'Phone', 'Email', 'Web', 'Chat'. Default: 'Chat'."
    },
    "contactEmail": {
      "type": "string",
      "description": "ONLY the user's email address. Extract from 'Email: [value]' or 'Contact: [value]' or 'User email: [value]' patterns. Example: if input contains 'Email: john.doe@company.com', extract 'john.doe@company.com' only. Used to associate the case with existing Contact record."
    }
  }
}
```

---

## File 3: deploy_create_case_for_support.apex

```apex
// Deploy AI Prompt for IT Support Helpdesk Agent

List<ccai_qa__AI_Prompt__c> existingPrompts = [
    SELECT Id, Name
    FROM ccai_qa__AI_Prompt__c
    WHERE Name = 'create_Case_for_Support'
    LIMIT 1
];

if (!existingPrompts.isEmpty()) {
    System.debug('⚠️ WARNING: AI Prompt "create_Case_for_Support" already exists.');
    System.debug('Existing Prompt ID: ' + existingPrompts[0].Id);
} else {
    ccai_qa__AI_Prompt__c prompt = new ccai_qa__AI_Prompt__c();
    prompt.Name = 'create_Case_for_Support';

    prompt.ccai_qa__Prompt_Command__c = '{\n' +
        '  "type": "object",\n' +
        '  "required": ["subject", "description"],\n' +
        '  "properties": {\n' +
        '    "subject": {\n' +
        '      "type": "string",\n' +
        '      "maxLength": 255,\n' +
        '      "description": "ONLY the case subject/title. Extract from \'Subject: [value]\' or \'Issue: [value]\' patterns. Example: if input is \'Subject: Cannot access email\', extract \'Cannot access email\' only. This field is REQUIRED."\n' +
        '    },\n' +
        '    "description": {\n' +
        '      "type": "string",\n' +
        '      "description": "ONLY the detailed description. Extract from \'Description: [value]\' patterns. Include all relevant information. This field is REQUIRED."\n' +
        '    },\n' +
        '    "priority": {\n' +
        '      "type": "string",\n' +
        '      "enum": ["High", "Medium", "Low"],\n' +
        '      "description": "ONLY the priority level. If keywords like \'urgent\', \'critical\' appear, set to \'High\'. Default: \'Medium\'."\n' +
        '    },\n' +
        '    "category": {\n' +
        '      "type": "string",\n' +
        '      "enum": ["Password Reset", "Software Installation", "Hardware Issue", "Network Problem", "Email Issue", "Other"],\n' +
        '      "description": "ONLY the issue category. Infer from description: \'password\' → \'Password Reset\', \'install\' → \'Software Installation\', etc."\n' +
        '    },\n' +
        '    "origin": {\n' +
        '      "type": "string",\n' +
        '      "enum": ["Phone", "Email", "Web", "Chat"],\n' +
        '      "description": "ONLY the case origin. Valid values: \'Phone\', \'Email\', \'Web\', \'Chat\'. Default: \'Chat\'."\n' +
        '    },\n' +
        '    "contactEmail": {\n' +
        '      "type": "string",\n' +
        '      "description": "ONLY the user\'s email address. Used to associate case with Contact record."\n' +
        '    }\n' +
        '  }\n' +
        '}';

    prompt.ccai_qa__Agentic_Function_Class__c = 'CreateSupportCaseAgenticHandler';

    insert prompt;

    System.debug('========================================');
    System.debug('✅ AI Prompt deployed successfully!');
    System.debug('========================================');
    System.debug('Prompt ID: ' + prompt.Id);
    System.debug('Prompt Name: ' + prompt.Name);
    System.debug('Handler Class: ' + prompt.ccai_qa__Agentic_Function_Class__c);
    System.debug('========================================');
}
```

---

## File 4: test_support_case_handler.apex

```apex
// Test Script for CreateSupportCaseAgenticHandler

System.debug('========================================');
System.debug('🧪 TESTING SUPPORT CASE HANDLER');
System.debug('========================================');

CreateSupportCaseAgenticHandler handler = new CreateSupportCaseAgenticHandler();

// Test 1: Password reset (auto-categorized as High priority)
System.debug('\n📝 Test 1: Password Reset - Urgent');
Map<String, Object> params1 = new Map<String, Object>{
    'subject' => 'Cannot login - password reset needed',
    'description' => 'User forgot password and cannot access system. Urgent - business critical.',
    'contactEmail' => 'test.user@company.com'
};
String result1 = handler.executeMethod('create_Case_for_Support', params1);
Map<String, Object> response1 = (Map<String, Object>) JSON.deserializeUntyped(result1);
System.debug('Success: ' + response1.get('success'));
System.debug('Case Number: ' + response1.get('caseNumber'));
System.debug('Priority: ' + response1.get('priority'));
System.debug('Category: ' + response1.get('category'));

// Test 2: Software installation (auto-categorized as Medium)
System.debug('\n📝 Test 2: Software Installation');
Map<String, Object> params2 = new Map<String, Object>{
    'subject' => 'Need Microsoft Office installed',
    'description' => 'Can you please help me install Microsoft Office on my new laptop?'
};
String result2 = handler.executeMethod('create_Case_for_Support', params2);
Map<String, Object> response2 = (Map<String, Object>) JSON.deserializeUntyped(result2);
System.debug('Success: ' + response2.get('success'));
System.debug('Category: ' + response2.get('category'));

// Test 3: Network issue (auto-detected as High)
System.debug('\n📝 Test 3: Network Down - Critical');
Map<String, Object> params3 = new Map<String, Object>{
    'subject' => 'Network connection down',
    'description' => 'Emergency! All employees cannot access the network. Critical business impact.'
};
String result3 = handler.executeMethod('create_Case_for_Support', params3);
Map<String, Object> response3 = (Map<String, Object>) JSON.deserializeUntyped(result3);
System.debug('Success: ' + response3.get('success'));
System.debug('Priority: ' + response3.get('priority'));
System.debug('Category: ' + response3.get('category'));

// Test 4: Missing required field - Should error
System.debug('\n📝 Test 4: Missing Subject - Should Error');
Map<String, Object> params4 = new Map<String, Object>{
    'description' => 'Some description'
};
String result4 = handler.executeMethod('create_Case_for_Support', params4);
Map<String, Object> response4 = (Map<String, Object>) JSON.deserializeUntyped(result4);
System.debug('Success: ' + response4.get('success'));
System.debug('Message: ' + response4.get('message'));

System.debug('\n========================================');
System.debug('✅ ALL TESTS COMPLETE');
System.debug('========================================');
```

---

## Usage Examples

Users can say:

### Example 1: Simple request
```
"I need help resetting my password"
```
**AI extracts:**
```json
{
  "subject": "Password reset needed",
  "description": "User needs help resetting password"
}
```
**Result:** Creates case with auto-detected category "Password Reset", priority "High"

### Example 2: Detailed request
```
"I can't install Microsoft Office on my new laptop. I downloaded it but getting an error during installation. Error code 0x80070057."
```
**AI extracts:**
```json
{
  "subject": "Cannot install Microsoft Office",
  "description": "Downloaded but getting error 0x80070057 during installation on new laptop"
}
```
**Result:** Creates case with category "Software Installation", priority "Medium"

### Example 3: Urgent network issue
```
"Emergency! Our entire office network is down. Nobody can access anything. This is critical!"
```
**AI extracts:**
```json
{
  "subject": "Office network down",
  "description": "Emergency! Entire office network is down. Nobody can access anything. This is critical!"
}
```
**Result:** Creates case with category "Network Problem", priority "High" (auto-detected from keywords)

### Example 4: Structured input
```
"Create support case: Subject: Email not syncing; Description: Outlook not syncing emails since this morning; Priority: Medium; Email: john.doe@company.com"
```
**AI extracts:**
```json
{
  "subject": "Email not syncing",
  "description": "Outlook not syncing emails since this morning",
  "priority": "Medium",
  "contactEmail": "john.doe@company.com"
}
```
**Result:** Creates case with specified priority, finds and links Contact by email

---

## Response Format

### Success Response
```json
{
  "success": true,
  "status": "success",
  "message": "Support case created successfully",
  "caseId": "500xx000003DGXXX",
  "caseNumber": "00001234",
  "subject": "Cannot access email",
  "priority": "High",
  "category": "Email Issue",
  "redirectUrl": "https://instance.salesforce.com/500xx000003DGXXX",
  "action": "redirect"
}
```

---

## Features

✅ **Smart Priority Detection** - Auto-sets to High for urgent keywords
✅ **Smart Category Detection** - Auto-categorizes based on description keywords
✅ **Contact Linking** - Finds and links Contact by email if provided
✅ **Account Association** - Links to Account if Contact found
✅ **Flexible Input** - Works with natural language or structured input
✅ **Validation** - Checks required fields and permissions
✅ **Error Handling** - Comprehensive error responses
✅ **Security** - Permission checks and with sharing

---

**This example demonstrates the complete output an LLM would generate when following the instructions.**
