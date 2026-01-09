# Salesforce AI Agentic Function Architecture - Complete Guide for LLMs

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [How It Works](#how-it-works)
4. [Prompt Command Specifications](#prompt-command-specifications)
5. [Agentic Function Class Requirements](#agentic-function-class-requirements)
6. [CRUD Operation Patterns](#crud-operation-patterns)
7. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
8. [Examples for All Operations](#examples-for-all-operations)
9. [Best Practices](#best-practices)

---

## 🏗️ Architecture Overview

The Salesforce AI Agentic Function Architecture enables AI agents to perform Salesforce operations through a structured JSON schema + Apex handler pattern.

### **Architecture Flow**

```
User Request
    ↓
AI Agent (LLM)
    ↓
Parse & Extract Parameters (using Prompt Command JSON Schema)
    ↓
Salesforce Platform
    ↓
AI Prompt Record (ccai_qa__AI_Prompt__c)
    ├── ccai_qa__Prompt_Command__c (JSON Schema)
    └── ccai_qa__Agentic_Function_Class__c (Apex Class Name)
    ↓
Agentic Handler Class (implements AIAgenticInterface)
    ├── executeMethod(requestParam, parameters)
    ├── Security Checks (CRUD permissions)
    ├── Validation
    └── DML Operations
    ↓
JSON Response
    ↓
AI Agent
    ↓
User (formatted response or redirect to record)
```

---

## 🔧 Core Components

### **1. AI Prompt Record** (`ccai_qa__AI_Prompt__c`)

Custom Salesforce object that defines agentic functions.

**Key Fields:**
- **`Name`**: Unique identifier for the function (e.g., `create_Account_by_Name`)
- **`ccai_qa__Prompt_Command__c`**: JSON Schema defining input parameters
- **`ccai_qa__Agentic_Function_Class__c`**: Name of Apex class that implements the function

### **2. Prompt Command** (`ccai_qa__Prompt_Command__c`)

JSON Schema that defines:
- Parameter names and types
- Required vs. optional fields
- Field descriptions for AI extraction
- Validation rules (maxLength, enum, etc.)

### **3. Agentic Function Class**

Apex class implementing `AIAgenticInterface` with method:

```apex
public String executeMethod(String requestParam, Map<String, Object> parameters)
```

**Standard Handler Classes:**
- **`AIAgenticFunctionHandler`**: General CRUD operations + searches
- **`AIAgenticCRUDExtensionHandler`**: Update/Delete operations
- **Custom handlers**: Object-specific logic (e.g., `CreateAccountAgenticHandler`)

### **4. AIAgenticInterface**

```apex
public interface AIAgenticInterface {
    String executeMethod(String requestParam, Map<String, Object> parameters);
}
```

---

## ⚙️ How It Works

### **Step-by-Step Execution**

1. **User makes a request**:
   ```
   "Create an account called Acme Corp in Technology industry with phone 555-1234"
   ```

2. **AI Agent identifies the function**:
   - Searches AI Prompt records
   - Matches user intent to function name: `create_Account_by_Name`

3. **AI extracts parameters using JSON Schema**:
   ```json
   {
     "Name": "Acme Corp",
     "Industry": "Technology",
     "Phone": "555-1234"
   }
   ```

4. **Platform invokes Agentic Handler**:
   ```apex
   CreateAccountAgenticHandler handler = new CreateAccountAgenticHandler();
   String result = handler.executeMethod('create_Account_by_Name', parameters);
   ```

5. **Handler executes logic**:
   - Checks user permissions
   - Validates parameters
   - Performs DML operation
   - Returns JSON response

6. **AI formats response for user**:
   ```
   "✅ Successfully created Account: Acme Corp (ID: 001xx000003DGXXX)"
   ```

---

## 📝 Prompt Command Specifications

### **JSON Schema Structure**

```json
{
  "type": "object",
  "required": ["field1", "field2"],
  "properties": {
    "FieldName": {
      "type": "string|number|boolean|array",
      "description": "Clear extraction instructions for AI",
      "maxLength": 255,
      "enum": ["value1", "value2"],
      "minimum": 0,
      "maximum": 100
    }
  }
}
```

### **Field Types**

| Type | Usage | Example |
|------|-------|---------|
| `string` | Text fields | Name, Email, Description |
| `number` | Numeric fields | Amount, Quantity, Age |
| `integer` | Whole numbers | Subscription months, Count |
| `boolean` | True/False | IsActive, HasOptedIn |
| `array` | Lists | RecordIds for bulk operations |
| `object` | Nested data | Address, Custom structures |

### **Description Best Practices**

The `description` field is **critical** for AI parameter extraction. Follow these patterns:

#### ✅ **GOOD Descriptions**

```json
{
  "Name": {
    "type": "string",
    "description": "ONLY the company name portion. Extract from 'Name: [value]' patterns. Example: if input is 'Name: Acme Corp; Type: Customer', extract 'Acme Corp' only. This field is REQUIRED."
  },
  "AccountId": {
    "type": "string",
    "description": "ONLY the Salesforce Account ID portion. Extract from 'AccountId: [value]' or 'Account Id: [value]' patterns. This must be a valid 15 or 18 character Salesforce Account ID starting with '001'. Example: if input contains 'AccountId: 001xx000003DGXXX', extract '001xx000003DGXXX' only. This field is REQUIRED."
  },
  "Priority": {
    "type": "string",
    "enum": ["High", "Medium", "Low"],
    "description": "Optional. Case priority level. Valid values: 'High', 'Medium', 'Low'. Defaults to 'Medium'."
  }
}
```

#### ❌ **BAD Descriptions**

```json
{
  "Name": {
    "type": "string",
    "description": "Account name"  // Too vague
  },
  "AccountId": {
    "type": "string",
    "description": "The ID"  // Not specific enough
  }
}
```

### **Key Description Elements**

1. **"ONLY the [field] portion"** - Tells AI not to include other data
2. **"Extract from '[Pattern]: [value]' patterns"** - Shows how data is structured in user input
3. **Examples** - Concrete extraction examples
4. **Validation rules** - Field length, format, valid values
5. **Required vs Optional** - Clear indication of necessity

---

## 🛠️ Agentic Function Class Requirements

### **Interface Implementation**

Every handler **must** implement `AIAgenticInterface`:

```apex
public with sharing class YourAgenticHandler implements AIAgenticInterface {

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // Implementation
    }
}
```

### **Required Components**

#### **1. Permission Checking**

```apex
private Boolean hasObjectPerm(String sObjectName, String permType) {
    Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe()
        .get(sObjectName)
        .getDescribe();

    if (permType == 'read')   return describeResult.isAccessible();
    if (permType == 'create') return describeResult.isCreateable();
    if (permType == 'update') return describeResult.isUpdateable();
    if (permType == 'delete') return describeResult.isDeletable();
    return false;
}
```

#### **2. Error Response Methods**

```apex
private String errorResponse(Exception ex) {
    return JSON.serialize(new Map<String, Object>{
        'success' => false,
        'status' => 'errored',
        'message' => ex.getMessage(),
        'redirectUrl' => null
    });
}

private String errorResponse(String message) {
    return JSON.serialize(new Map<String, Object>{
        'success' => false,
        'status' => 'errored',
        'message' => message,
        'redirectUrl' => null
    });
}
```

#### **3. Request Dispatcher** (`executeMethod`)

```apex
public String executeMethod(String requestParam, Map<String, Object> parameters) {
    try {
        switch on requestParam {
            when 'create_Object_by_Field' {
                return createObject(parameters);
            }
            when 'update_Object_by_Field' {
                return updateObject(parameters);
            }
            when 'find_Object_by_Field' {
                return findObject(parameters);
            }
            when else {
                return errorResponse('Method not defined: ' + requestParam);
            }
        }
    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

#### **4. Operation Methods**

Each operation method should:
1. Check permissions
2. Validate parameters
3. Perform business logic
4. Execute DML
5. Return JSON response

```apex
public String createObject(Map<String, Object> parameters) {
    // 1. Check permissions
    if (!hasObjectPerm('ObjectName', 'create')) {
        return errorResponse('Insufficient create permission on ObjectName object.');
    }

    // 2. Validate required parameters
    if (!parameters.containsKey('RequiredField') ||
        String.isBlank(String.valueOf(parameters.get('RequiredField')))) {
        return errorResponse('RequiredField is required.');
    }

    // 3. Perform business logic
    try {
        SObject record = Schema.getGlobalDescribe().get('ObjectName').newSObject();

        // Set fields
        record.put('Field1', String.valueOf(parameters.get('Field1')));

        // 4. Execute DML
        insert record;

        // 5. Return success response
        String redirectUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + record.Id;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'status' => 'success',
            'message' => 'Successfully created ObjectName: ' + record.get('Name'),
            'recordId' => record.Id,
            'redirectUrl' => redirectUrl,
            'action' => 'redirect'
        });

    } catch (DmlException dmlEx) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => 'DML Error: ' + dmlEx.getDmlMessage(0),
            'redirectUrl' => null
        });
    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

### **Response Format Standards**

#### **Success Response**

```json
{
  "success": true,
  "status": "success",
  "message": "Successfully created Account: Acme Corp",
  "recordId": "001xx000003DGXXX",
  "recordName": "Acme Corp",
  "redirectUrl": "https://instance.salesforce.com/001xx000003DGXXX",
  "action": "redirect"
}
```

#### **Error Response**

```json
{
  "success": false,
  "status": "errored",
  "message": "Insufficient create permission on Account object.",
  "redirectUrl": null
}
```

---

## 🔄 CRUD Operation Patterns

### **CREATE Operations**

**Prompt Command Pattern:**
```json
{
  "type": "object",
  "required": ["Name"],
  "properties": {
    "Name": {
      "type": "string",
      "maxLength": 255,
      "description": "ONLY the name portion. Extract from 'Name: [value]' patterns. This field is REQUIRED."
    },
    "OptionalField": {
      "type": "string",
      "description": "ONLY the field portion. Extract from 'Field: [value]' patterns."
    }
  }
}
```

**Handler Method Pattern:**
```apex
public String createObject(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'create')) {
        return errorResponse('Insufficient create permission on ObjectName.');
    }

    if (!parameters.containsKey('Name') || String.isBlank(String.valueOf(parameters.get('Name')))) {
        return errorResponse('Name is required.');
    }

    try {
        SObject record = Schema.getGlobalDescribe().get('ObjectName').newSObject();

        // Required field
        record.put('Name', String.valueOf(parameters.get('Name')));

        // Optional fields
        if (parameters.containsKey('OptionalField') &&
            String.isNotBlank(String.valueOf(parameters.get('OptionalField')))) {
            record.put('OptionalField', String.valueOf(parameters.get('OptionalField')));
        }

        insert record;

        String redirectUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + record.Id;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Successfully created ObjectName',
            'recordId' => record.Id,
            'redirectUrl' => redirectUrl,
            'action' => 'redirect'
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

---

### **READ/FIND Operations**

**Prompt Command Pattern:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The name to search for. Supports partial matching."
    },
    "industry": {
      "type": "string",
      "description": "Optional industry filter."
    }
  },
  "required": ["name"]
}
```

**Handler Method Pattern:**
```apex
public String findObject(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'read')) {
        return errorResponse('Insufficient read permission on ObjectName.');
    }

    try {
        String query = 'SELECT Id, Name, Field1, Field2 FROM ObjectName WHERE ';
        List<String> conditions = new List<String>();

        for (String key : parameters.keySet()) {
            String value = '%' + String.valueOf(parameters.get(key)) + '%';
            conditions.add(key + ' LIKE \'' + value + '\'');
        }

        query += String.join(conditions, ' AND ');

        List<SObject> records = Database.query(query);

        if (records.isEmpty()) {
            return errorResponse('No records found matching criteria.');
        }

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Found ' + records.size() + ' record(s)',
            'count' => records.size(),
            'records' => records,
            'recordId' => records[0].Id
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

---

### **UPDATE Operations**

**Prompt Command Pattern (Update by ID):**
```json
{
  "type": "object",
  "required": ["recordId"],
  "properties": {
    "recordId": {
      "type": "string",
      "description": "The Salesforce ID of the record to update. Must be a valid 15 or 18 character ID."
    },
    "Name": {
      "type": "string",
      "description": "New name value."
    },
    "Field1": {
      "type": "string",
      "description": "New field value."
    }
  }
}
```

**Prompt Command Pattern (Update by Name):**
```json
{
  "type": "object",
  "required": ["Name"],
  "properties": {
    "Name": {
      "type": "string",
      "description": "The name of the record to update. Used to find the record."
    },
    "Field1": {
      "type": "string",
      "description": "New field value."
    }
  }
}
```

**Handler Method Pattern (Update by ID):**
```apex
public String updateObjectById(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'update')) {
        return errorResponse('Insufficient update permission on ObjectName.');
    }

    if (!parameters.containsKey('recordId')) {
        return errorResponse('recordId parameter is required.');
    }

    try {
        String recordId = String.valueOf(parameters.get('recordId'));
        SObject record = Schema.getGlobalDescribe().get('ObjectName').newSObject();
        record.put('Id', recordId);

        Integer fieldCount = 0;
        for (String key : parameters.keySet()) {
            if (key != 'recordId') {
                record.put(key, parameters.get(key));
                fieldCount++;
            }
        }

        update record;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Successfully updated ObjectName',
            'recordId' => recordId,
            'updatedFields' => fieldCount
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

**Handler Method Pattern (Update by Name):**
```apex
public String updateObjectByName(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'read') || !hasObjectPerm('ObjectName', 'update')) {
        return errorResponse('Insufficient read/update permission on ObjectName.');
    }

    if (!parameters.containsKey('Name')) {
        return errorResponse('Name parameter is required.');
    }

    try {
        String name = String.valueOf(parameters.get('Name'));

        // Find the record
        List<SObject> existingRecords = Database.query(
            'SELECT Id, Name FROM ObjectName WHERE Name = :name LIMIT 1'
        );

        if (existingRecords.isEmpty()) {
            return errorResponse('No record found with name: ' + name);
        }

        SObject record = existingRecords[0];

        // Update fields
        for (String key : parameters.keySet()) {
            if (key != 'Name') {
                record.put(key, parameters.get(key));
            }
        }

        update record;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Successfully updated ObjectName: ' + name,
            'recordId' => record.Id
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

---

### **DELETE Operations**

**Prompt Command Pattern (Delete by ID):**
```json
{
  "type": "object",
  "required": ["recordId"],
  "properties": {
    "recordId": {
      "type": "string",
      "description": "The Salesforce ID of the record to delete."
    }
  }
}
```

**Prompt Command Pattern (Delete by Name):**
```json
{
  "type": "object",
  "required": ["Name"],
  "properties": {
    "Name": {
      "type": "string",
      "description": "The name of the record to delete."
    }
  }
}
```

**Handler Method Pattern (Delete by ID):**
```apex
public String deleteObjectById(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'delete')) {
        return errorResponse('Insufficient delete permission on ObjectName.');
    }

    if (!parameters.containsKey('recordId')) {
        return errorResponse('recordId parameter is required.');
    }

    try {
        String recordId = String.valueOf(parameters.get('recordId'));

        SObject record = Schema.getGlobalDescribe().get('ObjectName').newSObject();
        record.put('Id', recordId);

        delete record;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Successfully deleted ObjectName',
            'recordId' => recordId
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

---

### **BULK Operations**

**Prompt Command Pattern (Bulk Update):**
```json
{
  "type": "object",
  "required": ["records"],
  "properties": {
    "records": {
      "type": "array",
      "description": "Array of records to update",
      "items": {
        "type": "object",
        "properties": {
          "recordId": {
            "type": "string",
            "description": "Salesforce ID of the record to update"
          },
          "Name": {
            "type": "string",
            "description": "New name value"
          }
        },
        "required": ["recordId"]
      }
    }
  }
}
```

**Handler Method Pattern:**
```apex
public String bulkUpdateObject(Map<String, Object> parameters) {
    if (!hasObjectPerm('ObjectName', 'update')) {
        return errorResponse('Insufficient update permission on ObjectName.');
    }

    if (!parameters.containsKey('records')) {
        return errorResponse('records parameter is required.');
    }

    try {
        List<Object> recordsList = (List<Object>) parameters.get('records');
        List<SObject> recordsToUpdate = new List<SObject>();

        for (Object obj : recordsList) {
            Map<String, Object> recordMap = (Map<String, Object>) obj;

            if (!recordMap.containsKey('recordId')) {
                return errorResponse('Each record must have a recordId.');
            }

            SObject record = Schema.getGlobalDescribe().get('ObjectName').newSObject();
            record.put('Id', String.valueOf(recordMap.get('recordId')));

            for (String key : recordMap.keySet()) {
                if (key != 'recordId') {
                    record.put(key, recordMap.get(key));
                }
            }

            recordsToUpdate.add(record);
        }

        update recordsToUpdate;

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'message' => 'Successfully updated ' + recordsToUpdate.size() + ' records',
            'count' => recordsToUpdate.size()
        });

    } catch (Exception ex) {
        return errorResponse(ex);
    }
}
```

---

## 📖 Step-by-Step Implementation Guide

### **Creating a New Agentic Function**

#### **Step 1: Define the Function**

Determine:
- **Object**: Which Salesforce object (Account, Contact, Custom__c, etc.)
- **Operation**: CREATE, READ, UPDATE, DELETE
- **Identifier**: Find by Name, ID, or other field
- **Fields**: Which fields are required/optional

#### **Step 2: Create the Prompt Command JSON Schema**

```json
{
  "type": "object",
  "required": ["RequiredField1", "RequiredField2"],
  "properties": {
    "RequiredField1": {
      "type": "string",
      "maxLength": 255,
      "description": "ONLY the field portion. Extract from 'Field: [value]' patterns. Example: if input is 'Field: Value', extract 'Value' only. This field is REQUIRED."
    },
    "OptionalField": {
      "type": "string",
      "description": "ONLY the field portion. Extract from 'Field: [value]' patterns."
    }
  }
}
```

**JSON Schema Checklist:**
- ✅ All required fields in `required` array
- ✅ Each property has `type` defined
- ✅ Descriptions are clear with extraction patterns
- ✅ Examples provided in descriptions
- ✅ Validation rules added (maxLength, enum, minimum, maximum)

#### **Step 3: Choose or Create Agentic Handler Class**

**Option A: Use Existing Handler**

If your operation fits these patterns, use:
- **`AIAgenticFunctionHandler`**: For standard CRUD + search operations
- **`AIAgenticCRUDExtensionHandler`**: For update/delete operations

**Option B: Create Custom Handler**

For complex logic or non-standard operations:

```apex
public with sharing class CustomObjectAgenticHandler implements AIAgenticInterface {

    private Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.DescribeSObjectResult describeResult = Schema.getGlobalDescribe()
            .get(sObjectName).getDescribe();
        if (permType == 'read')   return describeResult.isAccessible();
        if (permType == 'create') return describeResult.isCreateable();
        if (permType == 'update') return describeResult.isUpdateable();
        if (permType == 'delete') return describeResult.isDeletable();
        return false;
    }

    private String errorResponse(Exception ex) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'message' => ex.getMessage()
        });
    }

    private String errorResponse(String message) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'message' => message
        });
    }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            switch on requestParam {
                when 'operation_name' {
                    return operationMethod(parameters);
                }
                when else {
                    return errorResponse('Method not defined: ' + requestParam);
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    public String operationMethod(Map<String, Object> parameters) {
        // Implementation
    }
}
```

#### **Step 4: Create AI Prompt Record**

Create new `ccai_qa__AI_Prompt__c` record:

| Field | Value |
|-------|-------|
| **Name** | `operation_ObjectName_by_Identifier` |
| **ccai_qa__Prompt_Command__c** | JSON Schema from Step 2 |
| **ccai_qa__Agentic_Function_Class__c** | Handler class name from Step 3 |

**Naming Convention:**
- CREATE: `create_Account_by_Name`
- READ: `find_Account_by_Name`, `get_Account_details_by_Id`
- UPDATE: `update_Account_by_Id`, `update_Account_by_Name`
- DELETE: `delete_Account_by_Id`, `delete_Account_by_Name`
- BULK: `bulk_update_Accounts`, `bulk_delete_Contacts`

#### **Step 5: Implement Handler Method**

Follow the CRUD pattern templates above, ensuring:
1. ✅ Permission checks
2. ✅ Parameter validation
3. ✅ Business logic
4. ✅ DML operations
5. ✅ JSON response formatting

#### **Step 6: Test the Function**

```apex
// Anonymous Apex test
CustomObjectAgenticHandler handler = new CustomObjectAgenticHandler();
Map<String, Object> params = new Map<String, Object>{
    'Name' => 'Test Record',
    'Field1' => 'Value1'
};
String result = handler.executeMethod('operation_name', params);
System.debug(result);
```

---

## 📚 Examples for All Operations

### **Example 1: Create Account**

**AI Prompt Record:**
- **Name**: `create_Account_by_Name`
- **Prompt Command**:
```json
{
  "type": "object",
  "required": ["Name"],
  "properties": {
    "Name": {
      "type": "string",
      "maxLength": 255,
      "description": "ONLY the company name portion. Extract from 'Name: [value]' patterns. Example: if input is 'Name: Acme Corp; Type: Customer', extract 'Acme Corp' only. This field is REQUIRED."
    },
    "Industry": {
      "type": "string",
      "description": "ONLY the industry portion. Extract from 'Industry: [value]' patterns. Example: if input contains 'Industry: Technology', extract 'Technology' only. Valid values include: Agriculture, Banking, Technology, etc."
    },
    "Phone": {
      "type": "string",
      "description": "ONLY the phone number portion. Extract from 'Phone: [value]' patterns. Example: if input contains 'Phone: 555-123-4567', extract '555-123-4567' only."
    },
    "Website": {
      "type": "string",
      "description": "ONLY the website URL portion. Extract from 'Website: [value]' patterns. Example: if input contains 'Website: www.acme.com', extract 'www.acme.com' only."
    }
  }
}
```
- **Agentic Function Class**: `CreateAccountAgenticHandler`

---

### **Example 2: Find Contact by Last Name**

**AI Prompt Record:**
- **Name**: `find_Contact_by_lastname`
- **Prompt Command**:
```json
{
  "type": "object",
  "properties": {
    "lastname": {
      "type": "string",
      "description": "The last name to search for. Supports partial matching. Example: 'Smith', 'Doe'."
    }
  },
  "required": ["lastname"]
}
```
- **Agentic Function Class**: `AIAgenticFunctionHandler`

---

### **Example 3: Update Account by Name**

**AI Prompt Record:**
- **Name**: `update_Account_by_Name`
- **Prompt Command**:
```json
{
  "type": "object",
  "required": ["Name"],
  "properties": {
    "Name": {
      "type": "string",
      "description": "The name of the Account to update. Used to find the record."
    },
    "Industry": {
      "type": "string",
      "description": "New industry value."
    },
    "Phone": {
      "type": "string",
      "description": "New phone number."
    },
    "Website": {
      "type": "string",
      "description": "New website URL."
    }
  }
}
```
- **Agentic Function Class**: `AIAgenticCRUDExtensionHandler`

---

### **Example 4: Delete Account by ID**

**AI Prompt Record:**
- **Name**: `delete_Account_by_Id`
- **Prompt Command**:
```json
{
  "type": "object",
  "required": ["recordId"],
  "properties": {
    "recordId": {
      "type": "string",
      "description": "The Salesforce ID of the Account record to delete. Must be a valid 15 or 18 character ID starting with '001'."
    }
  }
}
```
- **Agentic Function Class**: `AIAgenticCRUDExtensionHandler`

---

### **Example 5: Create Case on Account**

**AI Prompt Record:**
- **Name**: `create_case_On_Account`
- **Prompt Command**:
```json
{
  "type": "object",
  "required": ["AccountName", "Subject"],
  "properties": {
    "AccountName": {
      "type": "string",
      "description": "Name of the Account (exact or partial match)"
    },
    "Subject": {
      "type": "string",
      "description": "Subject of the Case"
    },
    "Description": {
      "type": "string",
      "description": "Detailed description (optional)"
    },
    "Priority": {
      "type": "string",
      "enum": ["High", "Medium", "Low"],
      "description": "Priority level (optional)"
    },
    "Origin": {
      "type": "string",
      "enum": ["Phone", "Email", "Web", "Chat"],
      "description": "Origin channel (optional)"
    }
  }
}
```
- **Agentic Function Class**: `CaseCreationHandler`

---

### **Example 6: Bulk Update Accounts**

**AI Prompt Record:**
- **Name**: `bulk_update_Accounts`
- **Prompt Command**:
```json
{
  "type": "object",
  "required": ["records"],
  "properties": {
    "records": {
      "type": "array",
      "description": "Array of Account records to update",
      "items": {
        "type": "object",
        "properties": {
          "recordId": {
            "type": "string",
            "description": "Salesforce ID of the Account to update"
          },
          "Name": {
            "type": "string",
            "description": "Account Name"
          },
          "Industry": {
            "type": "string",
            "description": "Industry classification"
          },
          "Phone": {
            "type": "string",
            "description": "Phone number"
          }
        },
        "required": ["recordId"]
      }
    }
  }
}
```
- **Agentic Function Class**: `AIAgenticCRUDExtensionHandler`

---

## ✅ Best Practices

### **1. Naming Conventions**

| Component | Pattern | Example |
|-----------|---------|---------|
| AI Prompt Name | `operation_Object_by_Identifier` | `create_Account_by_Name` |
| Handler Class | `OperationObjectAgenticHandler` | `CreateAccountAgenticHandler` |
| Handler Method | `operationObject` | `createAccount` |
| Request Param | Same as AI Prompt Name | `create_Account_by_Name` |

### **2. Security First**

Always implement:
- ✅ Permission checks (`hasObjectPerm`)
- ✅ `with sharing` keyword on classes
- ✅ FLS checks if using dynamic DML
- ✅ Parameter validation
- ✅ Try-catch blocks

### **3. Parameter Validation**

```apex
// Check parameter exists
if (!parameters.containsKey('RequiredField')) {
    return errorResponse('RequiredField is required.');
}

// Check not blank
if (String.isBlank(String.valueOf(parameters.get('RequiredField')))) {
    return errorResponse('RequiredField cannot be blank.');
}

// Check length
String value = String.valueOf(parameters.get('Field'));
if (value.length() > 255) {
    return errorResponse('Field cannot exceed 255 characters.');
}

// Check valid ID
String recordId = String.valueOf(parameters.get('recordId'));
if (recordId.length() != 15 && recordId.length() != 18) {
    return errorResponse('recordId must be a valid Salesforce ID.');
}
```

### **4. JSON Schema Best Practices**

✅ **DO:**
- Use clear, extraction-focused descriptions
- Include concrete examples
- Specify required vs optional fields
- Add validation constraints (maxLength, enum, etc.)
- Use "ONLY the [field] portion" pattern
- Show extraction patterns: `'Field: [value]'`

❌ **DON'T:**
- Use vague descriptions
- Assume AI knows Salesforce field formats
- Forget to mark required fields
- Skip examples
- Leave out validation rules

### **5. Error Handling**

```apex
try {
    // Operation logic
} catch (DmlException dmlEx) {
    return JSON.serialize(new Map<String, Object>{
        'success' => false,
        'status' => 'errored',
        'message' => 'DML Error: ' + dmlEx.getDmlMessage(0),
        'redirectUrl' => null
    });
} catch (QueryException qEx) {
    return errorResponse('Query Error: ' + qEx.getMessage());
} catch (Exception ex) {
    return errorResponse(ex);
}
```

### **6. Response Consistency**

Always include:
- ✅ `success` (boolean)
- ✅ `message` (string)
- ✅ `recordId` (for single records)
- ✅ `redirectUrl` (for UI navigation)
- ✅ `action: 'redirect'` (hint for UI)

### **7. Testing**

```apex
@isTest
private class CustomObjectAgenticHandlerTest {

    @isTest
    static void testCreateOperation() {
        CustomObjectAgenticHandler handler = new CustomObjectAgenticHandler();

        Map<String, Object> params = new Map<String, Object>{
            'Name' => 'Test Record',
            'Field1' => 'Value1'
        };

        Test.startTest();
        String result = handler.executeMethod('create_Object_by_Name', params);
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(true, response.get('success'));
        System.assertNotEquals(null, response.get('recordId'));
    }

    @isTest
    static void testValidationError() {
        CustomObjectAgenticHandler handler = new CustomObjectAgenticHandler();

        Map<String, Object> params = new Map<String, Object>();

        Test.startTest();
        String result = handler.executeMethod('create_Object_by_Name', params);
        Test.stopTest();

        Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(result);
        System.assertEquals(false, response.get('success'));
        System.assert(((String)response.get('message')).contains('required'));
    }
}
```

---

## 🎯 Quick Reference

### **For Any New Function:**

1. ✅ Define object and operation
2. ✅ Create JSON Schema with clear descriptions
3. ✅ Choose/create handler class
4. ✅ Implement method with:
   - Permission checks
   - Validation
   - DML
   - JSON response
5. ✅ Create AI Prompt record
6. ✅ Test thoroughly

### **Handler Class Template:**

```apex
public with sharing class CustomHandler implements AIAgenticInterface {
    private Boolean hasObjectPerm(String sObjectName, String permType) { /* ... */ }
    private String errorResponse(Exception ex) { /* ... */ }
    private String errorResponse(String message) { /* ... */ }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            switch on requestParam {
                when 'operation_name' { return operationMethod(parameters); }
                when else { return errorResponse('Method not defined'); }
            }
        } catch (Exception ex) { return errorResponse(ex); }
    }

    public String operationMethod(Map<String, Object> parameters) {
        // Permission check
        // Validation
        // Logic
        // DML
        // Response
    }
}
```

---

## 📞 Support

For questions or issues:
- Review existing AI Prompt records for examples
- Check handler classes: `AIAgenticFunctionHandler`, `AIAgenticCRUDExtensionHandler`
- Verify JSON Schema syntax
- Test with Anonymous Apex before deployment

---

**Last Updated**: December 18, 2025
**Version**: 1.0
**Author**: AI Agentic Architecture Documentation Team
