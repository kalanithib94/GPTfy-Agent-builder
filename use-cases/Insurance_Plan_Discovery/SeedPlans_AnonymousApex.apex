// Seed Insurance_Plan__c records via JSON deserialization
// This bypasses the namespace SObject.put() field resolution issue

String ns = 'ccai_qa__';
List<String> log = new List<String>();

Integer existingPlans = Database.countQuery('SELECT COUNT() FROM ' + ns + 'Insurance_Plan__c');
if (existingPlans > 0) {
    System.debug('INFO: ' + existingPlans + ' plan(s) already exist. Delete them first if you want to re-seed.');
} else {

    // Build a JSON array of plan records with ALL fields (using full namespace API names)
    String plansJson = '['
        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Silver Shield - Individual Basic",'
        +  '"ccai_qa__Plan_Type__c":"Individual",'
        +  '"ccai_qa__Monthly_Premium__c":149.99,'
        +  '"ccai_qa__Max_Coverage__c":250000,'
        +  '"ccai_qa__Annual_Deductible__c":500,'
        +  '"ccai_qa__Short_Description__c":"Essential individual cover. No pre-existing. PPO network. Ages 18-55."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Gold Care - Individual + Pre-Existing after 3yr",'
        +  '"ccai_qa__Plan_Type__c":"Individual",'
        +  '"ccai_qa__Monthly_Premium__c":249.99,'
        +  '"ccai_qa__Max_Coverage__c":500000,'
        +  '"ccai_qa__Annual_Deductible__c":250,'
        +  '"ccai_qa__Short_Description__c":"Individual cover incl pre-existing after 3yr waiting. Maternity. Ages 18-60."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Platinum Plus - Individual Zero Deductible + Pre-Existing yr2",'
        +  '"ccai_qa__Plan_Type__c":"Individual",'
        +  '"ccai_qa__Monthly_Premium__c":399.99,'
        +  '"ccai_qa__Max_Coverage__c":1000000,'
        +  '"ccai_qa__Annual_Deductible__c":0,'
        +  '"ccai_qa__Short_Description__c":"Premium individual. Zero deductible. Pre-existing yr2. International cover. Ages 18-65."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Family Shield - Floater up to 5 members",'
        +  '"ccai_qa__Plan_Type__c":"Family",'
        +  '"ccai_qa__Monthly_Premium__c":299.99,'
        +  '"ccai_qa__Max_Coverage__c":500000,'
        +  '"ccai_qa__Annual_Deductible__c":500,'
        +  '"ccai_qa__Short_Description__c":"Family floater up to 5 members. No pre-existing. HMO network. Ages 18-65."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Family Gold Floater - 6 members + Pre-Existing yr3",'
        +  '"ccai_qa__Plan_Type__c":"Family",'
        +  '"ccai_qa__Monthly_Premium__c":449.99,'
        +  '"ccai_qa__Max_Coverage__c":1000000,'
        +  '"ccai_qa__Annual_Deductible__c":250,'
        +  '"ccai_qa__Short_Description__c":"Family floater 6 members. Pre-existing after 3yr. PPO. Ages 18-70."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Family Plus Extended - 8 members incl parents",'
        +  '"ccai_qa__Plan_Type__c":"Family",'
        +  '"ccai_qa__Monthly_Premium__c":599.99,'
        +  '"ccai_qa__Max_Coverage__c":2000000,'
        +  '"ccai_qa__Annual_Deductible__c":0,'
        +  '"ccai_qa__Short_Description__c":"Extended family 8 members incl parents. Pre-existing yr2. 2M coverage. Ages 18-80."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Senior Care - Ages 60-85 Pre-Existing yr2 TPA",'
        +  '"ccai_qa__Plan_Type__c":"Senior",'
        +  '"ccai_qa__Monthly_Premium__c":349.99,'
        +  '"ccai_qa__Max_Coverage__c":500000,'
        +  '"ccai_qa__Annual_Deductible__c":300,'
        +  '"ccai_qa__Short_Description__c":"Senior plan ages 60-85. Pre-existing yr2. TPA network. Home nurse benefit."},'

        + '{"attributes":{"type":"ccai_qa__Insurance_Plan__c"},'
        +  '"Name":"Senior Platinum - Ages 60-90 Pre-Existing yr1 Zero Deductible",'
        +  '"ccai_qa__Plan_Type__c":"Senior",'
        +  '"ccai_qa__Monthly_Premium__c":549.99,'
        +  '"ccai_qa__Max_Coverage__c":1000000,'
        +  '"ccai_qa__Annual_Deductible__c":0,'
        +  '"ccai_qa__Short_Description__c":"Premium senior ages 60-90. Pre-existing yr1. Zero deductible. PPO. International emergency."}'
        + ']';

    List<Object> rawList = (List<Object>) JSON.deserializeUntyped(plansJson);
    List<SObject> plans = new List<SObject>();

    for (Object rawObj : rawList) {
        Map<String, Object> planMap = (Map<String, Object>) rawObj;
        planMap.remove('attributes');
        SObject plan = (SObject) Type.forName('ccai_qa__Insurance_Plan__c').newInstance();
        for (String fieldName : planMap.keySet()) {
            try {
                Object val = planMap.get(fieldName);
                if (val instanceof Integer) {
                    plan.put(fieldName, Decimal.valueOf((Integer) val));
                } else {
                    plan.put(fieldName, val);
                }
            } catch (Exception ex) {
                System.debug('SKIP field ' + fieldName + ': ' + ex.getMessage());
            }
        }
        plans.add(plan);
    }

    try {
        insert plans;
        System.debug('OK Inserted ' + plans.size() + ' Insurance_Plan__c records:');
        for (SObject p : plans) {
            System.debug('  -> Id:' + p.Id + ' | ' + p.get('Name'));
        }
    } catch (Exception e) {
        System.debug('FAIL inserting plans: ' + e.getMessage());
    }
}
