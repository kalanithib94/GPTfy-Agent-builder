/**
 * Agentic skills for IT Helpdesk: create Case (linked to Contact) and create Contact.
 * Prompt Name / requestParam must match: create_case_for_contact, create_Contact_by_Name
 */
public with sharing class ITHelpdeskAgenticHandler implements AIAgenticInterface {

    private String err(String msg) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status' => 'errored',
            'message' => msg
        });
    }

    private String ok(Map<String, Object> body) {
        body.put('success', true);
        body.put('status', 'ok');
        return JSON.serialize(body);
    }

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            if (parameters == null) {
                parameters = new Map<String, Object>();
            }
            switch on requestParam {
                when 'create_case_for_contact' {
                    return createCaseForContact(parameters);
                }
                when 'create_Contact_by_Name' {
                    return createContactByName(parameters);
                }
                when else {
                    return err(
                        'Unsupported skill: ' + requestParam
                        + '. Use create_case_for_contact or create_Contact_by_Name.'
                    );
                }
            }
        } catch (Exception ex) {
            return err(ex.getMessage());
        }
    }

    private String createCaseForContact(Map<String, Object> p) {
        if (!Schema.sObjectType.Case.isCreateable()) {
            return err('Insufficient access to create Case.');
        }
        String contactId = stringVal(p.get('contactId'));
        if (String.isBlank(contactId)) {
            return err('contactId is required (15 or 18 character Contact Id).');
        }
        Case c = new Case();
        c.ContactId = contactId;
        c.Subject = truncate(stringVal(p.get('subject')), 255);
        if (String.isBlank(c.Subject)) {
            c.Subject = 'IT Helpdesk — issue from chat';
        }
        c.Description = stringVal(p.get('description'));
        c.Status = 'New';
        c.Origin = 'Chat';
        String pri = stringVal(p.get('priority'));
        if (String.isNotBlank(pri) && Schema.sObjectType.Case.fields.Priority.isCreateable()) {
            c.Priority = pri;
        } else {
            c.Priority = 'Medium';
        }
        insert c;
        return ok(new Map<String, Object>{
            'message' => 'Case created.',
            'caseId' => c.Id,
            'caseNumber' => c.CaseNumber
        });
    }

    private String createContactByName(Map<String, Object> p) {
        if (!Schema.sObjectType.Contact.isCreateable()) {
            return err('Insufficient access to create Contact.');
        }
        String lastName = stringVal(p.get('lastName'));
        if (String.isBlank(lastName)) {
            return err('lastName is required.');
        }
        Contact con = new Contact();
        con.LastName = truncate(lastName, 80);
        String fn = stringVal(p.get('firstName'));
        if (String.isNotBlank(fn)) {
            con.FirstName = truncate(fn, 40);
        }
        String em = stringVal(p.get('email'));
        if (String.isNotBlank(em)) {
            con.Email = em;
        }
        String ph = stringVal(p.get('phone'));
        if (String.isNotBlank(ph)) {
            con.Phone = ph;
        }
        String notes = stringVal(p.get('description'));
        if (String.isNotBlank(notes)) {
            con.Description = notes;
        }
        insert con;
        return ok(new Map<String, Object>{
            'message' => 'Contact created.',
            'contactId' => con.Id
        });
    }

    private static String stringVal(Object o) {
        return o == null ? null : String.valueOf(o).trim();
    }

    private static String truncate(String s, Integer maxLen) {
        if (s == null) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }
}
