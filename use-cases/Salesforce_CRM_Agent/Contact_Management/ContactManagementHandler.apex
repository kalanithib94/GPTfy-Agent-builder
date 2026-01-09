/**
 * ContactManagementHandler
 * Handler for creating and updating Contact records via AI Agent
 *
 * Operations:
 * 1. create_Contact - Create new contact with comprehensive field support
 * 2. update_Contact - Update existing contact fields
 */
global with sharing class ContactManagementHandler implements ccai.AIAgenticInterface {

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
     * Main entry point for all Contact operations
     */
    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        // DEBUG: Log incoming request
        System.debug('=== ContactManagementHandler START ===');
        System.debug('Operation: ' + requestParam);
        System.debug('Parameters: ' + JSON.serializePretty(parameters));

        try {
            String result;

            switch on requestParam {
                when 'create_Contact', 'create_Contact_on_Account' {
                    System.debug('DEBUG: Routing to createContact method');
                    result = createContact(parameters);
                }
                when 'update_Contact', 'update_Contact_on_Account' {
                    System.debug('DEBUG: Routing to updateContact method');
                    result = updateContact(parameters);
                }
                when else {
                    System.debug('ERROR: Unknown operation requested: ' + requestParam);
                    result = buildErrorResponse('Unknown operation: ' + requestParam);
                }
            }

            System.debug('=== ContactManagementHandler END ===');
            System.debug('Result: ' + result);
            return result;

        } catch (Exception e) {
            System.debug('ERROR in executeMethod: ' + e.getMessage());
            System.debug('Stack Trace: ' + e.getStackTraceString());
            return buildErrorResponse('Unexpected error: ' + e.getMessage());
        }
    }

    /**
     * CREATE CONTACT
     * Creates a new Contact record with provided fields
     */
    private String createContact(Map<String, Object> parameters) {
        System.debug('--- Creating Contact ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Contact', 'create')) {
                return buildErrorResponse('You do not have permission to create Contacts');
            }

            // Build Contact record
            Contact newContact = new Contact();

            // LastName (REQUIRED)
            if (parameters.containsKey('lastName')) {
                newContact.LastName = String.valueOf(parameters.get('lastName'));
            } else {
                return buildErrorResponse('lastName is required to create a Contact');
            }

            // FirstName
            if (parameters.containsKey('firstName')) {
                newContact.FirstName = String.valueOf(parameters.get('firstName'));
            }

            // Email
            if (parameters.containsKey('email')) {
                newContact.Email = String.valueOf(parameters.get('email'));
            }

            // Phone
            if (parameters.containsKey('phone')) {
                newContact.Phone = String.valueOf(parameters.get('phone'));
            }

            // MobilePhone
            if (parameters.containsKey('mobilePhone')) {
                newContact.MobilePhone = String.valueOf(parameters.get('mobilePhone'));
            }

            // HomePhone
            if (parameters.containsKey('homePhone')) {
                newContact.HomePhone = String.valueOf(parameters.get('homePhone'));
            }

            // Title
            if (parameters.containsKey('title')) {
                newContact.Title = String.valueOf(parameters.get('title'));
            }

            // Department
            if (parameters.containsKey('department')) {
                newContact.Department = String.valueOf(parameters.get('department'));
            }

            // Birthdate
            if (parameters.containsKey('birthdate')) {
                try {
                    String birthdateStr = String.valueOf(parameters.get('birthdate'));
                    newContact.Birthdate = Date.valueOf(birthdateStr);
                } catch (Exception e) {
                    System.debug('Invalid birthdate format: ' + e.getMessage());
                }
            }

            // LeadSource
            if (parameters.containsKey('leadSource')) {
                newContact.LeadSource = String.valueOf(parameters.get('leadSource'));
            }

            // Description
            if (parameters.containsKey('description')) {
                newContact.Description = String.valueOf(parameters.get('description'));
            }

            // Mailing Address
            if (parameters.containsKey('mailingStreet')) {
                newContact.MailingStreet = String.valueOf(parameters.get('mailingStreet'));
            }
            if (parameters.containsKey('mailingCity')) {
                newContact.MailingCity = String.valueOf(parameters.get('mailingCity'));
            }
            if (parameters.containsKey('mailingState')) {
                newContact.MailingState = String.valueOf(parameters.get('mailingState'));
            }
            if (parameters.containsKey('mailingPostalCode')) {
                newContact.MailingPostalCode = String.valueOf(parameters.get('mailingPostalCode'));
            }
            if (parameters.containsKey('mailingCountry')) {
                newContact.MailingCountry = String.valueOf(parameters.get('mailingCountry'));
            }

            // Other Address
            if (parameters.containsKey('otherStreet')) {
                newContact.OtherStreet = String.valueOf(parameters.get('otherStreet'));
            }
            if (parameters.containsKey('otherCity')) {
                newContact.OtherCity = String.valueOf(parameters.get('otherCity'));
            }
            if (parameters.containsKey('otherState')) {
                newContact.OtherState = String.valueOf(parameters.get('otherState'));
            }
            if (parameters.containsKey('otherPostalCode')) {
                newContact.OtherPostalCode = String.valueOf(parameters.get('otherPostalCode'));
            }
            if (parameters.containsKey('otherCountry')) {
                newContact.OtherCountry = String.valueOf(parameters.get('otherCountry'));
            }

            // Account lookup
            if (parameters.containsKey('accountId')) {
                newContact.AccountId = String.valueOf(parameters.get('accountId'));
            } else if (parameters.containsKey('accountName')) {
                String accountName = String.valueOf(parameters.get('accountName'));
                Id accountId = lookupAccountByName(accountName);
                if (accountId != null) {
                    newContact.AccountId = accountId;
                } else {
                    return buildErrorResponse('Account not found with name: ' + accountName + '. Please use find_Account_by_Name first to get the correct account.');
                }
            }

            // ReportsTo (lookup another contact)
            if (parameters.containsKey('reportsToId')) {
                newContact.ReportsToId = String.valueOf(parameters.get('reportsToId'));
            }

            // Owner assignment
            if (parameters.containsKey('ownerId')) {
                newContact.OwnerId = String.valueOf(parameters.get('ownerId'));
            }

            System.debug('Contact to insert: ' + JSON.serializePretty(newContact));

            // Insert the contact
            insert newContact;

            System.debug('Contact created successfully: ' + newContact.Id);

            // Query back the full record
            Contact createdContact = [
                SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
                       Title, Department, Account.Name, Owner.Name, CreatedDate,
                       MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry
                FROM Contact
                WHERE Id = :newContact.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Contact created successfully',
                new Map<String, Object>{
                    'contactId' => createdContact.Id,
                    'name' => createdContact.Name,
                    'firstName' => createdContact.FirstName,
                    'lastName' => createdContact.LastName,
                    'email' => createdContact.Email,
                    'phone' => createdContact.Phone,
                    'mobilePhone' => createdContact.MobilePhone,
                    'title' => createdContact.Title,
                    'department' => createdContact.Department,
                    'accountName' => createdContact.Account?.Name,
                    'ownerName' => createdContact.Owner?.Name,
                    'mailingAddress' => formatAddress(
                        createdContact.MailingStreet,
                        createdContact.MailingCity,
                        createdContact.MailingState,
                        createdContact.MailingPostalCode,
                        createdContact.MailingCountry
                    ),
                    'createdDate' => createdContact.CreatedDate
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error creating contact: ' + e.getMessage());
            return buildErrorResponse('Failed to create contact: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error creating contact: ' + e.getMessage());
            return buildErrorResponse('Failed to create contact: ' + e.getMessage());
        }
    }

    /**
     * UPDATE CONTACT
     * Updates an existing Contact record
     */
    private String updateContact(Map<String, Object> parameters) {
        System.debug('--- Updating Contact ---');

        try {
            // Validate permissions
            if (!hasObjectPerm('Contact', 'update')) {
                return buildErrorResponse('You do not have permission to update Contacts');
            }

            // Get Contact ID - support multiple lookup methods
            Id contactId = null;

            if (parameters.containsKey('contactId') && parameters.get('contactId') != null && String.isNotBlank(String.valueOf(parameters.get('contactId')))) {
                System.debug('DEBUG: Looking up contact by contactId');
                contactId = (Id) String.valueOf(parameters.get('contactId'));
                System.debug('DEBUG: contactId = ' + contactId);
            } else if (parameters.containsKey('email') && parameters.get('email') != null && String.isNotBlank(String.valueOf(parameters.get('email')))) {
                System.debug('DEBUG: Looking up contact by email');
                String email = String.valueOf(parameters.get('email'));
                System.debug('DEBUG: email = ' + email);
                List<Contact> contacts = [SELECT Id FROM Contact WHERE Email = :email LIMIT 1];
                if (!contacts.isEmpty()) {
                    contactId = contacts[0].Id;
                    System.debug('DEBUG: Found contact: ' + contactId);
                } else {
                    return buildErrorResponse('Contact not found with email: ' + email);
                }
            } else if ((parameters.containsKey('firstName') && parameters.get('firstName') != null && String.isNotBlank(String.valueOf(parameters.get('firstName')))) ||
                       (parameters.containsKey('lastName') && parameters.get('lastName') != null && String.isNotBlank(String.valueOf(parameters.get('lastName'))))) {
                System.debug('DEBUG: Looking up contact by partial name match');

                // Handle different name search combinations
                if (parameters.containsKey('firstName') && parameters.get('firstName') != null && String.isNotBlank(String.valueOf(parameters.get('firstName'))) &&
                    parameters.containsKey('lastName') && parameters.get('lastName') != null && String.isNotBlank(String.valueOf(parameters.get('lastName')))) {
                    // Both first and last name
                    String firstNamePattern = '%' + String.valueOf(parameters.get('firstName')) + '%';
                    String lastNamePattern = '%' + String.valueOf(parameters.get('lastName')) + '%';
                    System.debug('DEBUG: firstNamePattern = ' + firstNamePattern + ', lastNamePattern = ' + lastNamePattern);

                    // If accountId provided, filter by account (accountId provides context)
                    if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                        System.debug('DEBUG: Filtering by accountId for context');
                        String accountIdStr = String.valueOf(parameters.get('accountId'));
                        System.debug('DEBUG: accountId = ' + accountIdStr);
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE FirstName LIKE :firstNamePattern
                            AND LastName LIKE :lastNamePattern
                            AND AccountId = :accountIdStr
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact under account: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with firstName containing "' + parameters.get('firstName') + '" and lastName containing "' + parameters.get('lastName') + '" under the specified account');
                        }
                    } else {
                        System.debug('DEBUG: Searching by name without account filter');
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE FirstName LIKE :firstNamePattern
                            AND LastName LIKE :lastNamePattern
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with firstName containing "' + parameters.get('firstName') + '" and lastName containing "' + parameters.get('lastName') + '"');
                        }
                    }
                } else if (parameters.containsKey('firstName') && parameters.get('firstName') != null && String.isNotBlank(String.valueOf(parameters.get('firstName')))) {
                    // Only first name
                    String firstNamePattern = '%' + String.valueOf(parameters.get('firstName')) + '%';
                    System.debug('DEBUG: firstNamePattern = ' + firstNamePattern);

                    if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                        System.debug('DEBUG: Filtering by accountId for context');
                        String accountIdStr = String.valueOf(parameters.get('accountId'));
                        System.debug('DEBUG: accountId = ' + accountIdStr);
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE FirstName LIKE :firstNamePattern
                            AND AccountId = :accountIdStr
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact under account: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with firstName containing "' + parameters.get('firstName') + '" under the specified account');
                        }
                    } else {
                        System.debug('DEBUG: Searching by firstName without account filter');
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE FirstName LIKE :firstNamePattern
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with firstName containing "' + parameters.get('firstName') + '"');
                        }
                    }
                } else {
                    // Only last name
                    String lastNamePattern = '%' + String.valueOf(parameters.get('lastName')) + '%';
                    System.debug('DEBUG: lastNamePattern = ' + lastNamePattern);

                    if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                        System.debug('DEBUG: Filtering by accountId for context');
                        String accountIdStr = String.valueOf(parameters.get('accountId'));
                        System.debug('DEBUG: accountId = ' + accountIdStr);
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE LastName LIKE :lastNamePattern
                            AND AccountId = :accountIdStr
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact under account: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with lastName containing "' + parameters.get('lastName') + '" under the specified account');
                        }
                    } else {
                        System.debug('DEBUG: Searching by lastName without account filter');
                        List<Contact> contacts = [
                            SELECT Id FROM Contact
                            WHERE LastName LIKE :lastNamePattern
                            ORDER BY CreatedDate DESC LIMIT 1
                        ];
                        if (!contacts.isEmpty()) {
                            contactId = contacts[0].Id;
                            System.debug('DEBUG: Found contact: ' + contactId);
                        } else {
                            return buildErrorResponse('Contact not found with lastName containing "' + parameters.get('lastName') + '"');
                        }
                    }
                }
            } else {
                return buildErrorResponse('Either contactId, email, firstName, or lastName is required to find the contact');
            }

            // Validate that we found a contactId
            if (contactId == null) {
                return buildErrorResponse('Failed to determine contactId for update');
            }
            System.debug('DEBUG: Final contactId for update: ' + contactId);

            // Query existing contact
            List<Contact> existingContacts = [
                SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, HomePhone,
                       Title, Department, AccountId, ReportsToId, OwnerId
                FROM Contact
                WHERE Id = :contactId
                LIMIT 1
            ];

            if (existingContacts.isEmpty()) {
                return buildErrorResponse('Contact not found with ID: ' + contactId);
            }

            Contact contactToUpdate = existingContacts[0];
            Boolean hasChanges = false;

            // Update FirstName
            if (parameters.containsKey('firstName')) {
                contactToUpdate.FirstName = String.valueOf(parameters.get('firstName'));
                hasChanges = true;
            }

            // Update LastName
            if (parameters.containsKey('lastName')) {
                contactToUpdate.LastName = String.valueOf(parameters.get('lastName'));
                hasChanges = true;
            }

            // Update Email
            if (parameters.containsKey('email')) {
                contactToUpdate.Email = String.valueOf(parameters.get('email'));
                hasChanges = true;
            }

            // Update Phone
            if (parameters.containsKey('phone')) {
                contactToUpdate.Phone = String.valueOf(parameters.get('phone'));
                hasChanges = true;
            }

            // Update MobilePhone
            if (parameters.containsKey('mobilePhone')) {
                contactToUpdate.MobilePhone = String.valueOf(parameters.get('mobilePhone'));
                hasChanges = true;
            }

            // Update HomePhone
            if (parameters.containsKey('homePhone')) {
                contactToUpdate.HomePhone = String.valueOf(parameters.get('homePhone'));
                hasChanges = true;
            }

            // Update Title
            if (parameters.containsKey('title')) {
                contactToUpdate.Title = String.valueOf(parameters.get('title'));
                hasChanges = true;
            }

            // Update Department
            if (parameters.containsKey('department')) {
                contactToUpdate.Department = String.valueOf(parameters.get('department'));
                hasChanges = true;
            }

            // Update Birthdate
            if (parameters.containsKey('birthdate')) {
                try {
                    String birthdateStr = String.valueOf(parameters.get('birthdate'));
                    contactToUpdate.Birthdate = Date.valueOf(birthdateStr);
                    hasChanges = true;
                } catch (Exception e) {
                    System.debug('Invalid birthdate format: ' + e.getMessage());
                }
            }

            // Update LeadSource
            if (parameters.containsKey('leadSource')) {
                contactToUpdate.LeadSource = String.valueOf(parameters.get('leadSource'));
                hasChanges = true;
            }

            // Update Description
            if (parameters.containsKey('description')) {
                contactToUpdate.Description = String.valueOf(parameters.get('description'));
                hasChanges = true;
            }

            // Update Mailing Address
            if (parameters.containsKey('mailingStreet')) {
                contactToUpdate.MailingStreet = String.valueOf(parameters.get('mailingStreet'));
                hasChanges = true;
            }
            if (parameters.containsKey('mailingCity')) {
                contactToUpdate.MailingCity = String.valueOf(parameters.get('mailingCity'));
                hasChanges = true;
            }
            if (parameters.containsKey('mailingState')) {
                contactToUpdate.MailingState = String.valueOf(parameters.get('mailingState'));
                hasChanges = true;
            }
            if (parameters.containsKey('mailingPostalCode')) {
                contactToUpdate.MailingPostalCode = String.valueOf(parameters.get('mailingPostalCode'));
                hasChanges = true;
            }
            if (parameters.containsKey('mailingCountry')) {
                contactToUpdate.MailingCountry = String.valueOf(parameters.get('mailingCountry'));
                hasChanges = true;
            }

            // Update Other Address
            if (parameters.containsKey('otherStreet')) {
                contactToUpdate.OtherStreet = String.valueOf(parameters.get('otherStreet'));
                hasChanges = true;
            }
            if (parameters.containsKey('otherCity')) {
                contactToUpdate.OtherCity = String.valueOf(parameters.get('otherCity'));
                hasChanges = true;
            }
            if (parameters.containsKey('otherState')) {
                contactToUpdate.OtherState = String.valueOf(parameters.get('otherState'));
                hasChanges = true;
            }
            if (parameters.containsKey('otherPostalCode')) {
                contactToUpdate.OtherPostalCode = String.valueOf(parameters.get('otherPostalCode'));
                hasChanges = true;
            }
            if (parameters.containsKey('otherCountry')) {
                contactToUpdate.OtherCountry = String.valueOf(parameters.get('otherCountry'));
                hasChanges = true;
            }

            // Update Account
            if (parameters.containsKey('accountId') && parameters.get('accountId') != null && String.isNotBlank(String.valueOf(parameters.get('accountId')))) {
                contactToUpdate.AccountId = String.valueOf(parameters.get('accountId'));
                hasChanges = true;
            } else if (parameters.containsKey('accountName') && parameters.get('accountName') != null && String.isNotBlank(String.valueOf(parameters.get('accountName')))) {
                String accountName = String.valueOf(parameters.get('accountName'));
                Id accountId = lookupAccountByName(accountName);
                if (accountId != null) {
                    contactToUpdate.AccountId = accountId;
                    hasChanges = true;
                } else {
                    return buildErrorResponse('Account not found with name: ' + accountName + '. Please use find_Account_by_Name first to get the correct account.');
                }
            }

            // Update ReportsTo
            if (parameters.containsKey('reportsToId') && parameters.get('reportsToId') != null && String.isNotBlank(String.valueOf(parameters.get('reportsToId')))) {
                contactToUpdate.ReportsToId = String.valueOf(parameters.get('reportsToId'));
                hasChanges = true;
            }

            // Update Owner
            if (parameters.containsKey('ownerId') && parameters.get('ownerId') != null && String.isNotBlank(String.valueOf(parameters.get('ownerId')))) {
                contactToUpdate.OwnerId = String.valueOf(parameters.get('ownerId'));
                hasChanges = true;
            }

            if (!hasChanges) {
                return buildErrorResponse('No fields provided to update');
            }

            System.debug('Contact to update: ' + JSON.serializePretty(contactToUpdate));

            // Update the contact
            update contactToUpdate;

            System.debug('Contact updated successfully: ' + contactToUpdate.Id);

            // Query back the full record
            Contact updatedContact = [
                SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
                       Title, Department, Account.Name, Owner.Name, LastModifiedDate,
                       MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry
                FROM Contact
                WHERE Id = :contactToUpdate.Id
                LIMIT 1
            ];

            return buildSuccessResponse(
                'Contact updated successfully',
                new Map<String, Object>{
                    'contactId' => updatedContact.Id,
                    'name' => updatedContact.Name,
                    'firstName' => updatedContact.FirstName,
                    'lastName' => updatedContact.LastName,
                    'email' => updatedContact.Email,
                    'phone' => updatedContact.Phone,
                    'mobilePhone' => updatedContact.MobilePhone,
                    'title' => updatedContact.Title,
                    'department' => updatedContact.Department,
                    'accountName' => updatedContact.Account?.Name,
                    'ownerName' => updatedContact.Owner?.Name,
                    'mailingAddress' => formatAddress(
                        updatedContact.MailingStreet,
                        updatedContact.MailingCity,
                        updatedContact.MailingState,
                        updatedContact.MailingPostalCode,
                        updatedContact.MailingCountry
                    ),
                    'lastModifiedDate' => updatedContact.LastModifiedDate
                }
            );

        } catch (DmlException e) {
            System.debug('DML Error updating contact: ' + e.getMessage());
            return buildErrorResponse('Failed to update contact: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            System.debug('Error updating contact: ' + e.getMessage());
            return buildErrorResponse('Failed to update contact: ' + e.getMessage());
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Lookup Account by name (with partial matching)
     */
    private Id lookupAccountByName(String accountName) {
        try {
            String searchPattern = '%' + accountName + '%';
            List<Account> accounts = [
                SELECT Id
                FROM Account
                WHERE Name LIKE :searchPattern
                LIMIT 1
            ];

            if (!accounts.isEmpty()) {
                System.debug('Account found: ' + accounts[0].Id);
                return accounts[0].Id;
            }
        } catch (Exception e) {
            System.debug('Error looking up account: ' + e.getMessage());
        }
        return null;
    }

    /**
     * Format address components into a readable string
     */
    private String formatAddress(String street, String city, String state, String postalCode, String country) {
        List<String> parts = new List<String>();

        if (String.isNotBlank(street)) parts.add(street);
        if (String.isNotBlank(city)) parts.add(city);
        if (String.isNotBlank(state)) parts.add(state);
        if (String.isNotBlank(postalCode)) parts.add(postalCode);
        if (String.isNotBlank(country)) parts.add(country);

        return String.join(parts, ', ');
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
