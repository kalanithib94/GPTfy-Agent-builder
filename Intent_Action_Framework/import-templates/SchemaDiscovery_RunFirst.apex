/**
 * SCHEMA DISCOVERY — Run this FIRST before any bulk import
 *
 * Purpose: Detects the correct namespace in your org and prints all
 *          field API names for the three Intent framework objects.
 *
 * HOW TO RUN:
 *   Developer Console → Debug → Open Execute Anonymous Window
 *   Paste this script → Execute
 *   Open the Logs panel → filter by DEBUG
 *
 * WHAT TO CHECK IN THE OUTPUT:
 *   1. "Detected namespace" — confirms whether your org uses ccai__ or ccai_qa__
 *   2. Field list for each object — copy exact field API names into your import scripts
 *   3. Picklist values — confirms valid values for Action_Type__c, Language__c, Type__c
 */

// ── Step 1: Namespace Detection ────────────────────────────────────────────────

String ns = '';
Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();

if (gd.containsKey('ccai_qa__AI_Agent_Intent__c')) {
    ns = 'ccai_qa__';
} else if (gd.containsKey('ccai__AI_Agent_Intent__c')) {
    ns = 'ccai__';
} else {
    System.debug('❌ ERROR: GPTfy Intent objects not found in this org. Is the package installed?');
    System.debug('Available objects containing "AI_Agent": ');
    for (String k : gd.keySet()) {
        if (k.containsIgnoreCase('AI_Agent')) System.debug('  → ' + k);
    }
    return;
}

System.debug('✅ Detected namespace prefix: [' + ns + ']');
System.debug('Object API Names to use:');
System.debug('  Intent  : ' + ns + 'AI_Agent_Intent__c');
System.debug('  Action  : ' + ns + 'AI_Intent_Action__c');
System.debug('  Detail  : ' + ns + 'AI_Intent_Action_Detail__c');
System.debug('  Agent   : ' + ns + 'AI_Agent__c');

// ── Step 2: Field Discovery ────────────────────────────────────────────────────

List<String> objectsToDescribe = new List<String>{
    ns + 'AI_Agent_Intent__c',
    ns + 'AI_Intent_Action__c',
    ns + 'AI_Intent_Action_Detail__c'
};

for (String objName : objectsToDescribe) {
    Schema.SObjectType sot = gd.get(objName);
    if (sot == null) {
        System.debug('❌ Object not found: ' + objName);
        continue;
    }

    Schema.DescribeSObjectResult dsr = sot.getDescribe();
    System.debug('\n══════════════════════════════════════');
    System.debug('OBJECT: ' + objName);
    System.debug('══════════════════════════════════════');

    Map<String, Schema.SObjectField> fields = dsr.fields.getMap();
    for (String fieldName : fields.keySet()) {
        Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
        String fieldType = String.valueOf(dfr.getType());
        String label = dfr.getLabel();

        // Only log custom fields + Name field (skip system fields like Id, CreatedDate etc.)
        if (fieldName == 'name' || fieldName.endsWith('__c')) {
            System.debug('  Field: ' + dfr.getName()
                + ' | Label: ' + label
                + ' | Type: ' + fieldType
                + (dfr.isNillable() ? '' : ' | REQUIRED'));
        }
    }
}

// ── Step 3: Picklist Value Discovery ──────────────────────────────────────────

List<String> picklistFields = new List<String>{
    ns + 'AI_Intent_Action__c.' + ns + 'Action_Type__c',
    ns + 'AI_Intent_Action__c.' + ns + 'Language__c',
    ns + 'AI_Intent_Action__c.' + ns + 'Return_Type__c',
    ns + 'AI_Intent_Action_Detail__c.' + ns + 'Type__c'
};

System.debug('\n══════════════════════════════════════');
System.debug('PICKLIST VALUES');
System.debug('══════════════════════════════════════');

for (String fullFieldPath : picklistFields) {
    List<String> parts = fullFieldPath.split('\\.');
    if (parts.size() != 2) continue;

    String objName = parts[0];
    String fieldName = parts[1];

    Schema.SObjectType sot = gd.get(objName);
    if (sot == null) { System.debug('Object not found: ' + objName); continue; }

    Map<String, Schema.SObjectField> fields = sot.getDescribe().fields.getMap();
    Schema.SObjectField f = fields.get(fieldName.toLowerCase());
    if (f == null) { System.debug('Field not found: ' + fieldName + ' on ' + objName); continue; }

    System.debug('\nField: ' + objName + '.' + fieldName);
    for (Schema.PicklistEntry pe : f.getDescribe().getPicklistValues()) {
        System.debug('  Value: [' + pe.getValue() + ']  Label: ' + pe.getLabel()
            + (pe.isDefaultValue() ? ' (DEFAULT)' : ''));
    }
}

// ── Step 4: AI Agent Records Available ────────────────────────────────────────

System.debug('\n══════════════════════════════════════');
System.debug('AVAILABLE AI AGENT RECORDS (use these Names in import scripts)');
System.debug('══════════════════════════════════════');

String agentQuery = 'SELECT Id, Name FROM ' + ns + 'AI_Agent__c ORDER BY Name';
try {
    List<SObject> agentList = Database.query(agentQuery);
    if (agentList.isEmpty()) {
        System.debug('  ⚠ No AI Agent records found. Create agents in GPTfy first.');
    }
    for (SObject a : agentList) {
        System.debug('  Agent: [' + a.get('Name') + '] → Id: ' + a.Id);
    }
} catch (Exception e) {
    System.debug('❌ Could not query AI_Agent__c: ' + e.getMessage());
}

System.debug('\n✅ Schema discovery complete. Review the fields above and update your import scripts if needed.');
