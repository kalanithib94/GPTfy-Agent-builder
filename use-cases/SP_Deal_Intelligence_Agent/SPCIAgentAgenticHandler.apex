global with sharing class SPCIAgentAgenticHandler implements ccai.AIAgenticInterface {
  /** GPTfy Prompt Request ids — Opportunity record context. V2-8180 */
  private static final String DEAL_OVERVIEW_PROMPT_REQUEST_ID      = '96a10206d7990a5fabc728ddfd83be0fbd5a9';
  private static final String DEAL_OBJECTIONS_PROMPT_REQUEST_ID    = '1c8aa6f530e1179c28c8115128ad7b36dc47c';
  private static final String DEAL_STAKEHOLDERS_PROMPT_REQUEST_ID  = 'b18c420eb1c660fb1ef3a2082430625234a19';
  private static final String DEAL_MEETING_PREP_PROMPT_REQUEST_ID  = '069d7309f6ddf5492c9bf7527be7f25aab1ea';
  private static final String DEAL_UPDATES_PROMPT_REQUEST_ID       = 'b7ecb37e913d9b7e10593ac40ee53cc443982';

  global String executeMethod(String requestParam, Map<String, Object> parameters) {
    try {
      if (parameters == null) parameters = new Map<String, Object>();
      String p = String.isBlank(requestParam) ? '' : requestParam.trim();
      switch on p {
        when 'SP_CI_Agent_find_opportunity_by_Name', 'SP_CI_Agent_find_opportunity' {
          return handleFindOpportunityByName(ensureFindParams(parameters));
        }
        when 'SP_CI_Agent_fetch_deal_overview'              { return handleFetchDealOverview(parameters); }
        when 'SP_CI_Agent_fetch_deal_objections'            { return handleFetchDealObjections(parameters); }
        when 'SP_CI_Agent_fetch_deal_stakeholders'          { return handleFetchDealStakeholders(parameters); }
        when 'SP_CI_Agent_fetch_deal_meeting_prep'          { return handleFetchDealMeetingPrep(parameters); }
        when 'SP_CI_Agent_fetch_deal_updates'               { return handleFetchDealUpdates(parameters); }
        when 'SP_CI_Agent_update_deal_add_activity'         { return handleUpdateDealAddActivity(parameters); }
        when 'SP_CI_Agent_update_deal_opportunity_fields', 'SP_CI_Agent_update_deal' {
          return handleUpdateDealOpportunityFields(ensureUpdateOppParams(parameters));
        }
        when 'SP_CI_Agent_fetch_opportunity_recent_changes' { return handleFetchOpportunityRecentChanges(parameters); }
        when else { return err('Unsupported skill: ' + requestParam); }
      }
    } catch (Exception ex) {
      System.debug(LoggingLevel.ERROR, 'SP_CI_AGENT | EXCEPTION | ' + ex.getMessage());
      return err(ex.getMessage());
    }
  }

  // ─── Parameter Normalisation ──────────────────────────────────────────────────

  private static Map<String, Object> ensureFindParams(Map<String, Object> parameters) {
    if (parameters.containsKey('opportunity_name') && parameters.get('opportunity_name') != null) return parameters;
    Object v = firstNonNull(parameters, new List<String>{ 'name', 'Name', 'search', 'q', 'opportunityName' });
    Map<String, Object> m = new Map<String, Object>(parameters);
    if (v != null) m.put('opportunity_name', v);
    return m;
  }

  private static Map<String, Object> ensureUpdateOppParams(Map<String, Object> parameters) {
    Map<String, Object> m = new Map<String, Object>(parameters);
    if (!m.containsKey('new_close_date') || m.get('new_close_date') == null) {
      Object d = firstNonNull(m, new List<String>{ 'newCloseDate', 'closeDate', 'CloseDate', 'close_date' });
      if (d != null) m.put('new_close_date', d);
    }
    if (!m.containsKey('new_stage_name') || String.isBlank(toText(m.get('new_stage_name')))) {
      Object s = firstNonNull(m, new List<String>{ 'newStageName', 'stage', 'StageName', 'new_stage' });
      if (s != null) m.put('new_stage_name', s);
    }
    return m;
  }

  private static Object firstNonNull(Map<String, Object> m, List<String> keys) {
    for (String k : keys) {
      if (m.containsKey(k) && m.get(k) != null) return m.get(k);
    }
    return null;
  }

  // ─── Find Opportunity ─────────────────────────────────────────────────────────

  private String handleFindOpportunityByName(Map<String, Object> parameters) {
    String oppName = toText(parameters.get('opportunity_name'));
    if (String.isBlank(oppName)) return err('Missing required parameter: opportunity_name');
    if (!Schema.sObjectType.Opportunity.isAccessible()) return err('Opportunity is not accessible.');

    List<Opportunity> opps;

    // V2-8418 — If input looks like a Salesforce Opportunity Id, do an exact Id lookup
    if (oppName.trim().startsWith('006') && oppName.trim().length() >= 15) {
      try {
        Id oppId = Id.valueOf(oppName.trim());
        opps = [
          SELECT Id, Name, StageName, CloseDate, AccountId, OwnerId
          FROM Opportunity
          WHERE Id = :oppId
          LIMIT 1
        ];
      } catch (Exception e) {
        opps = new List<Opportunity>();
      }
    } else {
      String nameLike = '%' + oppName + '%';
      opps = [
        SELECT Id, Name, StageName, CloseDate, AccountId, OwnerId
        FROM Opportunity
        WHERE Name LIKE :nameLike
        ORDER BY Name
        LIMIT 5
      ];
    }

    if (opps.isEmpty()) return err('No opportunity found for provided name.');
    List<Map<String, Object>> results = new List<Map<String, Object>>();
    for (Opportunity o : opps) {
      results.add(new Map<String, Object>{
        'Id'        => o.Id,
        'Name'      => o.Name,
        'StageName' => o.StageName,
        'CloseDate' => String.valueOf(o.CloseDate),
        'AccountId' => o.AccountId,
        'OwnerId'   => o.OwnerId,
        'recordUrl' => Url.getOrgDomainUrl().toExternalForm() + '/lightning/r/Opportunity/' + o.Id + '/view'
      });
    }
    return ok(new Map<String, Object>{ 'status' => 'found', 'records' => results });
  }

  // ─── GPTfy-backed Prompts ─────────────────────────────────────────────────────

  /**
   * V2-8180 — 'message' is kept intentionally: GPTfy already returns LLM-formatted
   * prose — the agent surfaces it verbatim rather than reformatting.
   */
  @TestVisible private static Boolean bypassPromptForUnitTest = false;

  private String runOpportunityPrompt(Map<String, Object> parameters, String promptRequestId) {
    String oppId = toText(parameters.get('opportunity_id'));
    if (String.isBlank(oppId)) {
      for (String alt : new List<String>{ 'OpportunityId', 'recordId' }) {
        if (parameters.containsKey(alt) && parameters.get(alt) != null) {
          oppId = toText(parameters.get(alt));
          break;
        }
      }
    }
    if (String.isBlank(oppId))                          return err('Missing required parameter: opportunity_id');
    if (!Schema.sObjectType.Opportunity.isAccessible()) return err('Opportunity is not accessible.');
    List<Opportunity> opps = [SELECT Id FROM Opportunity WHERE Id = :oppId LIMIT 1];
    if (opps.isEmpty())                                 return err('No opportunity found for provided Id.');
    Id resolvedOppId = opps[0].Id;

    if (Test.isRunningTest() && bypassPromptForUnitTest) {
      return ok(new Map<String, Object>{ 'status' => 'success', 'message' => 'UNIT_TEST_PLACEHOLDER', 'opportunityId' => resolvedOppId });
    }

    ccai.AIPromptProcessingInvokable.RequestWrapper wrap = new ccai.AIPromptProcessingInvokable.RequestWrapper();
    wrap.promptRequestId     = promptRequestId;
    wrap.recordId            = resolvedOppId;
    wrap.customPromptCommand = '';

    List<ccai.AIPromptProcessingInvokable.ResponseWrapper> responses =
      ccai.AIPromptProcessingInvokable.processRequest(
        new List<ccai.AIPromptProcessingInvokable.RequestWrapper>{ wrap }
      );
    if (responses == null || responses.isEmpty()) return err('No response received from AI prompt processing.');

    return ok(new Map<String, Object>{
      'status'        => 'success',
      'message'       => responses.get(0).responseBody,
      'opportunityId' => resolvedOppId
    });
  }

  private String handleFetchDealOverview(Map<String, Object> p)     { return runOpportunityPrompt(p, DEAL_OVERVIEW_PROMPT_REQUEST_ID); }
  private String handleFetchDealObjections(Map<String, Object> p)   { return runOpportunityPrompt(p, DEAL_OBJECTIONS_PROMPT_REQUEST_ID); }
  private String handleFetchDealStakeholders(Map<String, Object> p) { return runOpportunityPrompt(p, DEAL_STAKEHOLDERS_PROMPT_REQUEST_ID); }
  private String handleFetchDealMeetingPrep(Map<String, Object> p)  { return runOpportunityPrompt(p, DEAL_MEETING_PREP_PROMPT_REQUEST_ID); }
  private String handleFetchDealUpdates(Map<String, Object> p)      { return runOpportunityPrompt(p, DEAL_UPDATES_PROMPT_REQUEST_ID); }

  // ─── Add Activity (Task) ──────────────────────────────────────────────────────

  /**
   * Returns a raw HTML string. The LWC renders the response verbatim, so
   * structural HTML survives any sanitizer and looks clean on screen.
   * No JSON wrapping for this skill — the response IS the rendered card.
   */
  private String handleUpdateDealAddActivity(Map<String, Object> parameters) {
    String oppId           = toText(parameters.get('opportunity_id'));
    String subject         = toText(parameters.get('activity_subject'));
    String descriptionText = toText(parameters.get('activity_description'));

    if (String.isBlank(oppId))   return errHtml('Could not log activity', 'Missing the opportunity Id.');
    if (String.isBlank(subject)) return errHtml('Could not log activity', 'Missing the activity subject.');
    if (isPlaceholderActivitySubject(subject)) {
      return errHtml('Could not log activity', 'Please provide a meaningful subject for the activity (not a generic placeholder).');
    }
    if (!Schema.sObjectType.Opportunity.isAccessible()) return errHtml('Could not log activity', 'Opportunity is not accessible.');
    if (!Schema.sObjectType.Task.isCreateable())        return errHtml('Could not log activity', 'Task is not creatable.');

    List<Opportunity> opps = [SELECT Id FROM Opportunity WHERE Id = :oppId LIMIT 1];
    if (opps.isEmpty()) return errHtml('Could not log activity', 'No opportunity found for the provided Id.');

    Task t = new Task(
      WhatId       = opps[0].Id,
      Subject      = subject,
      Description  = descriptionText,
      Status       = 'Completed',
      Priority     = 'Normal',
      ActivityDate = Date.today()
    );
    insert t;

    // Re-query to confirm values that may be defaulted by org rules
    Task inserted = [SELECT Id, Subject, Status, Priority, ActivityDate FROM Task WHERE Id = :t.Id LIMIT 1];
    String taskUrl = Url.getOrgDomainUrl().toExternalForm() + '/lightning/r/Task/' + inserted.Id + '/view';

    return
        '<div>'
        + '✅ <b>Activity Logged: ' + escapeHtml(inserted.Subject) + '</b>'
        + '<ul>'
        +   '<li><b>Status:</b> '   + escapeHtml(inserted.Status)   + '</li>'
        +   '<li><b>Priority:</b> ' + escapeHtml(inserted.Priority) + '</li>'
        +   '<li><b>Date:</b> '     + escapeHtml(String.valueOf(inserted.ActivityDate)) + '</li>'
        + '</ul>'
        + '👉 <a href="' + taskUrl + '" target="_blank"><b>View Task</b></a>'
        + '</div>';
  }

  // ─── Update Opportunity Fields ────────────────────────────────────────────────

  /**
   * V2-8418 — Updates Opportunity CloseDate and/or StageName.
   *
   * IMPORTANT: The system prompt resolves ALL relative date expressions
   * ("next monday" etc.) to concrete yyyy-MM-dd BEFORE
   * calling this method. parseToDate() is a safety net for concrete formats
   * only — it does NOT handle free-text relative expressions.
   *
   * Returns a raw HTML diff card (success or error). The LWC renders the
   * response verbatim — no JSON wrapping for this skill.
   */
  private String handleUpdateDealOpportunityFields(Map<String, Object> parameters) {
    String oppId        = toText(parameters.get('opportunity_id'));
    String newStageName = toText(parameters.get('new_stage_name'));
    Object rawCloseDate = parameters.get('new_close_date');
    Date   newCloseDate = parseToDate(rawCloseDate);
    Boolean dateInputPresent = (rawCloseDate != null && !String.isBlank(toText(rawCloseDate)));

    if (String.isBlank(oppId)) return errHtml('Could not update opportunity', 'Missing the opportunity Id.');
    if (dateInputPresent && newCloseDate == null) {
      return errHtml(
        'Could not update opportunity',
        'Could not parse the close date "' + toText(rawCloseDate) + '". Please provide a date in yyyy-MM-dd format.'
      );
    }
    if (!dateInputPresent && String.isBlank(newStageName)) return errHtml('Could not update opportunity', 'Please provide a new close date and/or new stage name.');
    if (!Schema.sObjectType.Opportunity.isAccessible())    return errHtml('Could not update opportunity', 'Opportunity is not accessible.');
    if (!Schema.sObjectType.Opportunity.isUpdateable())    return errHtml('Could not update opportunity', 'Opportunity is not updateable.');

    List<Opportunity> opps = [SELECT Id, Name, CloseDate, StageName FROM Opportunity WHERE Id = :oppId LIMIT 1];
    if (opps.isEmpty()) return errHtml('Could not update opportunity', 'No opportunity found for the provided Id.');

    Opportunity o = opps[0];
    // Capture pre-update values for the diff display
    String oldStageName = o.StageName;
    Date   oldCloseDate = o.CloseDate;

    Boolean stageChanged = false;
    Boolean dateChanged  = false;
    if (newCloseDate != null && o.CloseDate != newCloseDate)          { o.CloseDate = newCloseDate; dateChanged  = true; }
    if (!String.isBlank(newStageName) && o.StageName != newStageName) { o.StageName = newStageName; stageChanged = true; }
    if (!stageChanged && !dateChanged) return errHtml('No changes detected', 'The provided values already match the current opportunity record.');

    update o;

    // Re-query to confirm the values that were actually saved
    Opportunity updated = [SELECT Id, Name, StageName, CloseDate FROM Opportunity WHERE Id = :oppId LIMIT 1];
    String oppUrl = Url.getOrgDomainUrl().toExternalForm() + '/lightning/r/Opportunity/' + updated.Id + '/view';

    String oldStageDisplay = String.isBlank(oldStageName) ? '(none)' : escapeHtml(oldStageName);
    String oldDateDisplay  = (oldCloseDate == null)       ? '(none)' : escapeHtml(String.valueOf(oldCloseDate));

    String diffItems = '';
    if (stageChanged) {
      diffItems += '<li><b>Stage:</b> '
                +  oldStageDisplay + ' → <b>' + escapeHtml(updated.StageName) + '</b>'
                +  '</li>';
    }
    if (dateChanged) {
      diffItems += '<li><b>Close Date:</b> '
                +  oldDateDisplay + ' → <b>' + escapeHtml(String.valueOf(updated.CloseDate)) + '</b>'
                +  '</li>';
    }

    return
        '<div>'
        + '✅ <b>Opportunity Updated: ' + escapeHtml(updated.Name) + '</b>'
        + '<ul>' + diffItems + '</ul>'
        + '👉 <a href="' + oppUrl + '" target="_blank"><b>View Opportunity</b></a>'
        + '</div>';
  }

  // ─── Fetch Recent Changes ─────────────────────────────────────────────────────

  private String handleFetchOpportunityRecentChanges(Map<String, Object> parameters) {
    String oppId = toText(parameters.get('opportunity_id'));
    if (String.isBlank(oppId)) return err('Missing required parameter: opportunity_id');
    if (!Schema.sObjectType.Opportunity.isAccessible()) return err('Opportunity is not accessible.');

    List<Opportunity> opps = [SELECT Id, Name, CloseDate, StageName, LastModifiedDate FROM Opportunity WHERE Id = :oppId LIMIT 1];
    if (opps.isEmpty()) return err('No opportunity found for provided Id.');

    Integer days = 30;
    Object dRaw = parameters.get('days');
    if (dRaw != null) {
      String ds = toText(dRaw);
      if (String.isNotBlank(ds)) {
        try { days = Integer.valueOf(ds); } catch (Exception e) { days = 30; }
      }
    }
    days = Math.max(1, Math.min(days, 365));

    if (!Schema.sObjectType.OpportunityFieldHistory.isAccessible()) {
      return ok(new Map<String, Object>{
        'status'        => 'unavailable',
        'message'       => 'Opportunity field history is not available. Enable Field History Tracking on key Opportunity fields in Setup.',
        'opportunityId' => opps[0].Id
      });
    }

    try {
      Datetime cutoff = System.now().addDays(-days);
      List<OpportunityFieldHistory> historyRows = [
        SELECT Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
        FROM OpportunityFieldHistory
        WHERE OpportunityId = :oppId AND CreatedDate >= :cutoff
        ORDER BY CreatedDate DESC
        LIMIT 500
      ];

      List<Map<String, Object>> rows    = new List<Map<String, Object>>();
      Map<String, Integer>      byField = new Map<String, Integer>();
      for (OpportunityFieldHistory h : historyRows) {
        String f = h.Field == null ? 'Unknown' : String.valueOf(h.Field);
        byField.put(f, (byField.containsKey(f) ? byField.get(f) : 0) + 1);
        rows.add(new Map<String, Object>{
          'field'     => h.Field,
          'oldValue'  => h.OldValue != null ? String.valueOf(h.OldValue) : null,
          'newValue'  => h.NewValue != null ? String.valueOf(h.NewValue) : null,
          'changedAt' => String.valueOf(h.CreatedDate),
          'changedBy' => h.CreatedBy != null ? h.CreatedBy.Name : null
        });
      }

      return ok(new Map<String, Object>{
        'status'           => 'success',
        'opportunityId'    => opps[0].Id,
        'opportunityName'  => opps[0].Name,
        'currentCloseDate' => String.valueOf(opps[0].CloseDate),
        'currentStageName' => opps[0].StageName,
        'lastModifiedDate' => String.valueOf(opps[0].LastModifiedDate),
        'lookbackDays'     => days,
        'changeCount'      => historyRows.size(),
        'byField'          => byField,
        'history'          => rows
      });
    } catch (Exception ex) {
      return ok(new Map<String, Object>{
        'status'        => 'unavailable',
        'message'       => 'Could not read field history: ' + ex.getMessage(),
        'opportunityId' => opps[0].Id
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private static Boolean isPlaceholderActivitySubject(String subject) {
    if (String.isBlank(subject)) return true;
    Set<String> bad = new Set<String>{
      'new activity','new task','new event','activity','task','event',
      'untitled','tbd','n/a','na','none','placeholder','add activity','log activity'
    };
    return bad.contains(subject.trim().toLowerCase());
  }

  private static String toText(Object o) {
    if (o == null) return null;
    return (o instanceof String) ? (String) o : String.valueOf(o);
  }

  private static String escapeHtml(String s) {
    if (s == null) return '';
    return s.escapeHtml4();
  }

  /**
   * HTML error block used by the two skills that return raw HTML strings
   * (handleUpdateDealAddActivity, handleUpdateDealOpportunityFields).
   * Other skills continue to use err() which returns JSON.
   */
  private static String errHtml(String title, String message) {
    return '<div>⚠️ <b>' + escapeHtml(title) + '</b><br/>' + escapeHtml(message) + '</div>';
  }

  /**
   * Parses concrete date values passed by the agent.
   * The system prompt is responsible for resolving relative expressions
   * ("next monday" etc.) to yyyy-MM-dd BEFORE this is called.
   * Supports: Date, Datetime, "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy".
   */
  private static Date parseToDate(Object o) {
    if (o == null) return null;
    if (o instanceof Date)     return (Date) o;
    if (o instanceof Datetime) return ((Datetime) o).date();
    String s = toText(o);
    if (String.isBlank(s)) return null;
    s = s.trim();
    // ISO yyyy-MM-dd
    try { if (s.length() == 10 && s.contains('-')) return Date.valueOf(s); } catch (Exception e) {}
    // Slash-separated
    try {
      if (s.contains('/')) {
        List<String> parts = s.split('/', 0);
        if (parts.size() == 3) {
          Integer a = Integer.valueOf(parts[0].trim());
          Integer b = Integer.valueOf(parts[1].trim());
          String  yStr = parts[2].trim();
          Integer y = yStr.length() <= 2 ? Integer.valueOf('20' + yStr) : Integer.valueOf(yStr);
          if (a > 12) return Date.newInstance(y, b, a);  // dd/MM/yyyy
          if (b > 12) return Date.newInstance(y, a, b);  // MM/dd/yyyy
          return Date.newInstance(y, a, b);               // ambiguous — default MM/dd/yyyy
        }
      }
    } catch (Exception e) {}
    // Final fallback
    try { return Date.valueOf(s); } catch (Exception e) {}
    return null;
  }

  private String err(String msg) {
    return JSON.serialize(new Map<String, Object>{ 'success' => false, 'error' => msg });
  }
  private String ok(Map<String, Object> result) {
    result.put('success', true);
    return JSON.serialize(result);
  }
}
