/**
 * @description
 *   InsurancePlanDiscoveryHandler implements AIAgenticInterface and serves as
 *   a multi-operation handler for pre-sales insurance plan discovery.
 *
 *   Supported operations:
 *     1. find_Insurance_Plan       — Search active plans with optional filters
 *     2. compare_Insurance_Plans   — Side-by-side comparison of 2–4 named plans
 *     3. recommend_Insurance_Plan  — AI-profile-based plan recommendation
 *
 *   Expected custom object: Insurance_Plan__c
 *   Required fields on Insurance_Plan__c:
 *     Name, Plan_Type__c, Monthly_Premium__c, Annual_Deductible__c,
 *     Max_Coverage__c, Pre_Existing_Covered__c,
 *     Pre_Existing_Waiting_Period_Years__c, Network_Type__c,
 *     Short_Description__c, Key_Benefits__c, Min_Age__c, Max_Age__c,
 *     Min_Family_Size__c, Max_Family_Size__c, Is_Active__c
 *
 * @author              : AI Agentic Architecture
 * @group               : Plumcloud Labs
 * @last modified on    : 16-03-2026
 */
public with sharing class InsurancePlanDiscoveryHandler implements AIAgenticInterface {

    // ─── SECTION 1: Permission Check ─────────────────────────────────────────

    private Boolean hasObjectPerm(String sObjectName, String permType) {
        Schema.DescribeSObjectResult d = Schema.getGlobalDescribe().get(sObjectName).getDescribe();
        if (permType == 'read')   return d.isAccessible();
        if (permType == 'create') return d.isCreateable();
        if (permType == 'update') return d.isUpdateable();
        if (permType == 'delete') return d.isDeletable();
        return false;
    }

    // ─── SECTION 2: Error Response Helpers ───────────────────────────────────

    private String errorResponse(Exception ex) {
        return JSON.serialize(new Map<String, Object>{
            'success'    => false,
            'status'     => 'errored',
            'message'    => ex.getMessage(),
            'stackTrace' => ex.getStackTraceString()
        });
    }

    private String errorResponse(String message) {
        return JSON.serialize(new Map<String, Object>{
            'success' => false,
            'status'  => 'errored',
            'message' => message
        });
    }

    // ─── SECTION 3: Request Dispatcher ───────────────────────────────────────

    public String executeMethod(String requestParam, Map<String, Object> parameters) {
        try {
            switch on requestParam {
                when 'find_Insurance_Plan' {
                    return findInsurancePlan(parameters);
                }
                when 'compare_Insurance_Plans' {
                    return compareInsurancePlans(parameters);
                }
                when 'recommend_Insurance_Plan' {
                    return recommendInsurancePlan(parameters);
                }
                when else {
                    return errorResponse(
                        'Method is not defined. This handler supports: '
                        + 'find_Insurance_Plan, compare_Insurance_Plans, recommend_Insurance_Plan'
                    );
                }
            }
        } catch (Exception ex) {
            return errorResponse(ex);
        }
    }

    // ─── SECTION 4: Operation 1 — Find Insurance Plans ───────────────────────

    private String findInsurancePlan(Map<String, Object> parameters) {
        if (!hasObjectPerm('Insurance_Plan__c', 'read')) {
            return errorResponse('Insufficient read permission on Insurance_Plan__c.');
        }

        String planType = null;
        if (parameters.containsKey('planType') && parameters.get('planType') != null) {
            planType = String.valueOf(parameters.get('planType')).trim();
            if (String.isBlank(planType)) planType = null;
        }

        Decimal maxPremium = null;
        if (parameters.containsKey('maxMonthlyPremium') && parameters.get('maxMonthlyPremium') != null) {
            try { maxPremium = Decimal.valueOf(String.valueOf(parameters.get('maxMonthlyPremium'))); }
            catch (Exception e) { /* non-numeric — ignore */ }
        }

        Boolean preExistingRequired = false;
        if (parameters.containsKey('preExistingRequired') && parameters.get('preExistingRequired') != null) {
            try { preExistingRequired = Boolean.valueOf(String.valueOf(parameters.get('preExistingRequired'))); }
            catch (Exception e) { /* ignore */ }
        }

        Integer lim = 8;
        if (parameters.containsKey('limit') && parameters.get('limit') != null) {
            try { lim = Math.min(Integer.valueOf(String.valueOf(parameters.get('limit'))), 20); }
            catch (Exception e) { /* default 8 */ }
        }

        String soql =
            'SELECT Id, Name, Plan_Type__c, Monthly_Premium__c, Annual_Deductible__c, '
            + 'Max_Coverage__c, Pre_Existing_Covered__c, Pre_Existing_Waiting_Period_Years__c, '
            + 'Network_Type__c, Short_Description__c, Key_Benefits__c, '
            + 'Min_Age__c, Max_Age__c, Min_Family_Size__c, Max_Family_Size__c '
            + 'FROM Insurance_Plan__c WHERE Is_Active__c = true ';

        if (String.isNotBlank(planType)) {
            soql += 'AND Plan_Type__c = \'' + String.escapeSingleQuotes(planType) + '\' ';
        }
        if (maxPremium != null) {
            soql += 'AND Monthly_Premium__c <= ' + maxPremium + ' ';
        }
        if (preExistingRequired) {
            soql += 'AND Pre_Existing_Covered__c = true ';
        }
        soql += 'ORDER BY Monthly_Premium__c ASC LIMIT ' + lim;

        List<Insurance_Plan__c> plans = Database.query(soql);

        if (plans.isEmpty()) {
            return JSON.serialize(new Map<String, Object>{
                'success' => true,
                'status'  => 'success',
                'message' => 'No active insurance plans found matching your criteria. '
                           + 'Try broadening your search — remove the budget filter or change the plan type.',
                'plans'   => new List<Object>(),
                'count'   => 0
            });
        }

        return JSON.serialize(new Map<String, Object>{
            'success' => true,
            'status'  => 'success',
            'message' => 'Found ' + plans.size() + ' insurance plan(s) matching your criteria.',
            'plans'   => buildPlanList(plans),
            'count'   => plans.size()
        });
    }

    // ─── SECTION 5: Operation 2 — Compare Insurance Plans ────────────────────

    private String compareInsurancePlans(Map<String, Object> parameters) {
        if (!hasObjectPerm('Insurance_Plan__c', 'read')) {
            return errorResponse('Insufficient read permission on Insurance_Plan__c.');
        }

        if (!parameters.containsKey('planNames') ||
            String.isBlank(String.valueOf(parameters.get('planNames')))) {
            return errorResponse(
                'planNames is required. Provide a comma-separated list of plan names '
                + 'to compare, e.g. "Silver Shield, Gold Care, Family Plus".'
            );
        }

        List<String> planNames = new List<String>();
        for (String raw : String.valueOf(parameters.get('planNames')).split(',')) {
            String name = raw.trim();
            if (String.isNotBlank(name)) planNames.add(name);
        }

        if (planNames.size() < 2) {
            return errorResponse('Please provide at least 2 plan names to compare.');
        }
        if (planNames.size() > 4) {
            return errorResponse('You can compare up to 4 plans at a time. Please narrow your selection.');
        }

        List<String> likeConditions = new List<String>();
        for (String name : planNames) {
            likeConditions.add('Name LIKE \'%' + String.escapeSingleQuotes(name) + '%\'');
        }

        String soql =
            'SELECT Id, Name, Plan_Type__c, Monthly_Premium__c, Annual_Deductible__c, '
            + 'Max_Coverage__c, Pre_Existing_Covered__c, Pre_Existing_Waiting_Period_Years__c, '
            + 'Network_Type__c, Short_Description__c, Key_Benefits__c, '
            + 'Min_Age__c, Max_Age__c, Min_Family_Size__c, Max_Family_Size__c '
            + 'FROM Insurance_Plan__c WHERE Is_Active__c = true AND ('
            + String.join(likeConditions, ' OR ')
            + ') ORDER BY Monthly_Premium__c ASC';

        List<Insurance_Plan__c> plans = Database.query(soql);

        if (plans.isEmpty()) {
            return errorResponse(
                'None of the specified plan names were found. '
                + 'Please check the names and try again. '
                + 'You can use find_Insurance_Plan to discover available plan names first.'
            );
        }

        return JSON.serialize(new Map<String, Object>{
            'success'    => true,
            'status'     => 'success',
            'message'    => 'Here is a side-by-side comparison of ' + plans.size() + ' plan(s).',
            'comparison' => buildPlanList(plans),
            'count'      => plans.size()
        });
    }

    // ─── SECTION 6: Operation 3 — Recommend Insurance Plan ───────────────────

    private String recommendInsurancePlan(Map<String, Object> parameters) {
        if (!hasObjectPerm('Insurance_Plan__c', 'read')) {
            return errorResponse('Insufficient read permission on Insurance_Plan__c.');
        }

        Integer familySize = 1;
        if (parameters.containsKey('familySize') && parameters.get('familySize') != null) {
            try { familySize = Integer.valueOf(String.valueOf(parameters.get('familySize'))); }
            catch (Exception e) { /* default 1 */ }
        }

        Integer applicantAge = null;
        if (parameters.containsKey('applicantAge') && parameters.get('applicantAge') != null) {
            try { applicantAge = Integer.valueOf(String.valueOf(parameters.get('applicantAge'))); }
            catch (Exception e) { /* not provided */ }
        }

        Boolean hasPreExisting = false;
        if (parameters.containsKey('hasPreExistingConditions') && parameters.get('hasPreExistingConditions') != null) {
            try { hasPreExisting = Boolean.valueOf(String.valueOf(parameters.get('hasPreExistingConditions'))); }
            catch (Exception e) { /* default false */ }
        }

        Decimal monthlyBudget = null;
        if (parameters.containsKey('monthlyBudget') && parameters.get('monthlyBudget') != null) {
            try { monthlyBudget = Decimal.valueOf(String.valueOf(parameters.get('monthlyBudget'))); }
            catch (Exception e) { /* no cap */ }
        }

        Decimal requiredCoverage = null;
        if (parameters.containsKey('requiredCoverage') && parameters.get('requiredCoverage') != null) {
            try { requiredCoverage = Decimal.valueOf(String.valueOf(parameters.get('requiredCoverage'))); }
            catch (Exception e) { /* no minimum */ }
        }

        // Derive plan type from customer profile
        String recommendedType;
        if (familySize > 1) {
            recommendedType = 'Family';
        } else if (applicantAge != null && applicantAge >= 60) {
            recommendedType = 'Senior';
        } else {
            recommendedType = 'Individual';
        }

        List<Insurance_Plan__c> plans = runRecommendationQuery(
            recommendedType, hasPreExisting, monthlyBudget, requiredCoverage, applicantAge
        );

        // Retry without budget cap if no results
        if (plans.isEmpty() && monthlyBudget != null) {
            plans = runRecommendationQuery(recommendedType, hasPreExisting, null, requiredCoverage, applicantAge);
        }

        // Retry without age filter if still empty (plan may not have age fields populated)
        if (plans.isEmpty()) {
            plans = runRecommendationQuery(recommendedType, hasPreExisting, null, null, null);
        }

        Map<String, Object> profileSummary = new Map<String, Object>{
            'familySize'              => familySize,
            'applicantAge'            => applicantAge,
            'hasPreExistingConditions'=> hasPreExisting,
            'monthlyBudget'           => monthlyBudget,
            'requiredCoverage'        => requiredCoverage,
            'recommendedPlanType'     => recommendedType
        };

        if (plans.isEmpty()) {
            return JSON.serialize(new Map<String, Object>{
                'success'        => true,
                'status'         => 'success',
                'message'        => 'No plans found for this profile. Consider adjusting budget or coverage requirements.',
                'recommendations'=> new List<Object>(),
                'count'          => 0,
                'profileSummary' => profileSummary
            });
        }

        return JSON.serialize(new Map<String, Object>{
            'success'        => true,
            'status'         => 'success',
            'message'        => 'Based on your profile, here are ' + plans.size() + ' recommended plan(s).',
            'recommendations'=> buildPlanList(plans),
            'count'          => plans.size(),
            'profileSummary' => profileSummary
        });
    }

    // ─── SECTION 7: Helper — Recommendation Query ────────────────────────────

    private List<Insurance_Plan__c> runRecommendationQuery(
        String planType,
        Boolean hasPreExisting,
        Decimal maxBudget,
        Decimal minCoverage,
        Integer age
    ) {
        String soql =
            'SELECT Id, Name, Plan_Type__c, Monthly_Premium__c, Annual_Deductible__c, '
            + 'Max_Coverage__c, Pre_Existing_Covered__c, Pre_Existing_Waiting_Period_Years__c, '
            + 'Network_Type__c, Short_Description__c, Key_Benefits__c, '
            + 'Min_Age__c, Max_Age__c, Min_Family_Size__c, Max_Family_Size__c '
            + 'FROM Insurance_Plan__c WHERE Is_Active__c = true '
            + 'AND Plan_Type__c = \'' + String.escapeSingleQuotes(planType) + '\' ';

        if (hasPreExisting) {
            soql += 'AND Pre_Existing_Covered__c = true ';
        }
        if (maxBudget != null) {
            soql += 'AND Monthly_Premium__c <= ' + maxBudget + ' ';
        }
        if (minCoverage != null) {
            soql += 'AND Max_Coverage__c >= ' + minCoverage + ' ';
        }
        if (age != null) {
            soql += 'AND Min_Age__c <= ' + age + ' AND Max_Age__c >= ' + age + ' ';
        }
        soql += 'ORDER BY Monthly_Premium__c ASC LIMIT 3';

        return Database.query(soql);
    }

    // ─── SECTION 8: Helper — Build Plan Response List ────────────────────────

    private List<Map<String, Object>> buildPlanList(List<Insurance_Plan__c> plans) {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (Insurance_Plan__c plan : plans) {
            result.add(new Map<String, Object>{
                'id'                       => plan.Id,
                'name'                     => plan.Name,
                'planType'                 => plan.Plan_Type__c,
                'monthlyPremium'           => plan.Monthly_Premium__c,
                'annualDeductible'         => plan.Annual_Deductible__c,
                'maxCoverage'              => plan.Max_Coverage__c,
                'preExistingCovered'       => plan.Pre_Existing_Covered__c,
                'preExistingWaitingYears'  => plan.Pre_Existing_Waiting_Period_Years__c,
                'networkType'              => plan.Network_Type__c,
                'shortDescription'         => plan.Short_Description__c,
                'keyBenefits'              => plan.Key_Benefits__c,
                'eligibleAgeRange'         => plan.Min_Age__c + '–' + plan.Max_Age__c,
                'eligibleFamilySize'       => plan.Min_Family_Size__c + '–' + plan.Max_Family_Size__c
            });
        }
        return result;
    }
}
