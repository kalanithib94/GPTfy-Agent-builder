List<ccai_qa__AI_Prompt__c> prompts = [
    SELECT Id, Name, ccai_qa__Apex_Class__c
    FROM ccai_qa__AI_Prompt__c
    WHERE Name LIKE '%Case%'
    AND (Name LIKE '%create%' OR Name LIKE '%update%' OR Name LIKE '%find%')
    ORDER BY Name
];

for(ccai_qa__AI_Prompt__c p : prompts) {
    System.debug('Prompt Name: ' + p.Name);
    System.debug('Apex Class: ' + p.ccai_qa__Apex_Class__c);
    System.debug('---');
}
