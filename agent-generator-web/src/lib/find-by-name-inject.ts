/**
 * Ensures each relevant standard object has a find_{Object}_by_Name skill (prompt + handler branch)
 * so end users can resolve records by name instead of pasting Salesforce Ids.
 * Pattern reference: use-cases/Salesforce_CRM_Agent/Account_Intelligence/find_Account_by_Name_PromptCommand.json
 */

export type PromptCommand = { fileName: string; content: string };

const STANDARD_OBJECTS = [
  "Account",
  "Contact",
  "Case",
  "Lead",
  "Opportunity",
] as const;

function blob(useCase: string, research: string | undefined): string {
  return `${useCase}\n${research ?? ""}`.toLowerCase();
}

/**
 * Heuristic: this use case needs find_{Object}_by_Name skills (name → Id resolution).
 * False for typical "list all open cases", "show my tickets" (filter/list only); true when
 * the user must resolve a record from a name/label or do CRUD on a named entity.
 */
export function needsFindByNameCoverage(
  useCase: string,
  research: string | undefined,
  unstemmedFileStems: string[]
): boolean {
  const b = blob(useCase, research);
  const stems = unstemmedFileStems.join(" ").toLowerCase();

  // Bulk list / dashboard reads (open cases, record links for each row) — no name-resolution skill.
  const listOrReportOnly =
    /\b(list|all|every|show\s+(me\s+)?|give\s+(me\s+)?|display|enumerate)\b/i.test(b) &&
    /\b(open\s+)?cases?\b|\btickets?\b|\brecords?\b/i.test(b) &&
    !/\b(named|called|by\s+name|search\s+for|look\s*up|lookup|find\s+(the\s+|a\s+)?(case|account|contact))\b/i.test(
      b
    ) &&
    !/\b(update|edit|close|change|modify|delete|merge|assign|escalat)\b/i.test(b);

  if (listOrReportOnly) {
    return false;
  }

  const nameResolution =
    /\b(by\s+name|named|called|search\s+for|look\s*up|lookup)\b/i.test(b) ||
    /\bfind\s+(the\s+|a\s+)?(case|account|contact|lead|opportunity|deal|ticket)\b/i.test(b) ||
    /\b(which|what)\s+(case|account|contact|ticket)\b/i.test(b) ||
    /\bfor\s+(customer|account|company)\s+/i.test(b);

  const crudish =
    /\b(update|create|delete|add|change|modify|edit|merge|link|assign|close|escalat|comment|patient)\b/.test(
      b
    ) ||
    /(update_|create_|add_|delete_|patch_|comment)/i.test(stems) ||
    nameResolution;

  const entityish =
    /\b(contact|account|case|lead|opportunity|patient|ticket|customer|deal)\b/.test(b) ||
    /(contact|account|case|lead|opportunity|patient)/i.test(stems);

  return crudish && entityish;
}

/**
 * Short policy text for the OpenAI system prompt so the model adds find_* skills only when appropriate.
 */
export function buildFindByNamePolicyBlock(
  useCase: string,
  research: string | undefined
): string {
  const needed = needsFindByNameCoverage(useCase, research, []);
  const objects = inferStandardObjectsForFindByName(useCase, research, []);
  const objectsHint =
    objects.length > 0 ? objects.join(", ") : "each standard object the use case touches";

  if (needed) {
    return `FIND-BY-NAME POLICY (this use case): **Include** **find_{Object}_by_Name** skills for **${objectsHint}** where users may refer to records by name before updates. Case: search **Subject** / **CaseNumber** (never Case.Name). Account/Contact/Lead/Opportunity: **Name** as usual. Omit find skills for objects the scenario never uses.`;
  }
  return `FIND-BY-NAME POLICY (this use case): **Not required** — scenario looks like list/filter/read-only, bulk links, or criteria-based queries without picking one record from a name. **Do not** add find_*_by_Name skills unless the text clearly needs name resolution; keep the handler minimal (e.g. SOQL by Status/OwnerId only).`;
}

/**
 * After inject + stem rewrites: if the use case needs name coverage, every inferred object must have a find skill.
 */
export function validateFindByNameCoveragePostInject(args: {
  useCase: string;
  intentResearchInstructions: string | undefined;
  unstemmedStems: string[];
}): string | null {
  const { useCase, intentResearchInstructions, unstemmedStems } = args;
  if (!needsFindByNameCoverage(useCase, intentResearchInstructions, unstemmedStems)) {
    return null;
  }
  const objects = inferStandardObjectsForFindByName(
    useCase,
    intentResearchInstructions,
    unstemmedStems
  );
  if (objects.length === 0) {
    return null;
  }
  const missing = objects.filter((o) => !alreadyHasFindByNameSkill(unstemmedStems, o));
  if (missing.length === 0) {
    return null;
  }
  return `Find-by-name skills expected for: ${missing.join(", ")} (use case requires name resolution). Model output was missing these; retry generation.`;
}

/** Map use case + stems to standard object API names that may need find_by_name. */
export function inferStandardObjectsForFindByName(
  useCase: string,
  research: string | undefined,
  unstemmedFileStems: string[]
): string[] {
  const out = new Set<string>();
  const b = blob(useCase, research);
  const stems = unstemmedFileStems.join(" ").toLowerCase();

  const mark = (obj: (typeof STANDARD_OBJECTS)[number], cond: boolean) => {
    if (cond) out.add(obj);
  };

  mark(
    "Account",
    /\baccount\b|company|customer\s+account/i.test(b) || stems.includes("account")
  );
  mark(
    "Contact",
    /\bcontact\b|patient|person\b/i.test(b) ||
      stems.includes("contact") ||
      stems.includes("patient")
  );
  mark("Case", /\bcase\b|ticket|incident/i.test(b) || stems.includes("case"));
  mark("Lead", /\blead\b/i.test(b) || stems.includes("lead"));
  mark(
    "Opportunity",
    /\bopportunity\b|\bopp\b|deal\b|pipeline/i.test(b) ||
      stems.includes("opportunity") ||
      stems.includes("opp")
  );

  return STANDARD_OBJECTS.filter((o) => out.has(o));
}

function stemForFindObject(object: string): string {
  return `find_${object}_by_Name`;
}

export function alreadyHasFindByNameSkill(
  unstemmedStems: string[],
  objectApi: string
): boolean {
  const needle = stemForFindObject(objectApi).toLowerCase();
  return unstemmedStems.some((s) => s.toLowerCase().includes(needle));
}

function promptJsonFor(objectApi: string): string {
  const paramByObject: Record<string, { param: string; desc: string }> = {
    Account: {
      param: "accountName",
      desc: "ONLY the account or company name to search (partial match supported).",
    },
    Contact: {
      param: "contactName",
      desc: "ONLY the contact or person name to search (partial match supported).",
    },
    Case: {
      param: "caseSearchTerm",
      desc: "ONLY text to find the case (matches Subject, CaseNumber, or Description partially).",
    },
    Lead: {
      param: "leadName",
      desc: "ONLY the lead name or company to search (partial match supported).",
    },
    Opportunity: {
      param: "opportunityName",
      desc: "ONLY the opportunity name to search (partial match supported).",
    },
  };
  const p = paramByObject[objectApi];
  if (!p) return "{}";
  const schema = {
    type: "object",
    required: [p.param],
    properties: {
      [p.param]: {
        type: "string",
        maxLength: 255,
        description: p.desc,
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "Max rows to return (default 25).",
      },
    },
  };
  return JSON.stringify(schema, null, 2);
}

function apexSnippetFor(objectApi: string, methodName: string): string {
  const p = paramByObjectForApex(objectApi);
  if (!p) return "";
  return `
    private String ${methodName}(Map<String, Object> parameters) {
        String term = (String) parameters.get('${p.param}');
        if (String.isBlank(term)) return err('Missing required parameter: ${p.param}');
        if (!Schema.sObjectType.${objectApi}.isAccessible()) return err('${objectApi} is not accessible.');
        Integer lim = 25;
        if (parameters.get('limit') != null) {
            try {
                lim = Integer.valueOf(String.valueOf(parameters.get('limit')));
            } catch (Exception limEx) {
                lim = 25;
            }
        }
        if (lim < 1) lim = 1;
        if (lim > 100) lim = 100;
        String likeTerm = '%' + term.trim() + '%';
        ${p.soqlBlock}
    }
`.trim();
}

function paramByObjectForApex(
  objectApi: string
): { param: string; soqlBlock: string } | null {
  switch (objectApi) {
    case "Account":
      return {
        param: "accountName",
        soqlBlock: `List<Account> rows = [
            SELECT Id, Name, BillingCity, Phone
            FROM Account
            WHERE Name LIKE :likeTerm
            ORDER BY Name
            LIMIT :lim
        ];
        if (rows.isEmpty()) return err('No Account found for that name. Try a different spelling.');
        return ok(new Map<String, Object>{
            'status' => 'found',
            'primaryAccountId' => rows[0].Id,
            'recordCount' => rows.size(),
            'records' => rows
        });`,
      };
    case "Contact":
      return {
        param: "contactName",
        soqlBlock: `List<Contact> rows = [
            SELECT Id, Name, Email, Phone, AccountId
            FROM Contact
            WHERE Name LIKE :likeTerm
            ORDER BY Name
            LIMIT :lim
        ];
        if (rows.isEmpty()) return err('No Contact found for that name. Try a different spelling.');
        return ok(new Map<String, Object>{
            'status' => 'found',
            'primaryContactId' => rows[0].Id,
            'recordCount' => rows.size(),
            'records' => rows
        });`,
      };
    case "Case":
      return {
        param: "caseSearchTerm",
        soqlBlock: `List<Case> rows = [
            SELECT Id, CaseNumber, Subject, Status, Priority, ContactId, AccountId
            FROM Case
            WHERE Subject LIKE :likeTerm OR CaseNumber LIKE :likeTerm
            ORDER BY CreatedDate DESC
            LIMIT :lim
        ];
        if (rows.isEmpty()) return err('No Case found for that search text.');
        return ok(new Map<String, Object>{
            'status' => 'found',
            'primaryCaseId' => rows[0].Id,
            'recordCount' => rows.size(),
            'records' => rows
        });`,
      };
    case "Lead":
      return {
        param: "leadName",
        soqlBlock: `List<Lead> rows = [
            SELECT Id, Name, Company, Email, Status
            FROM Lead
            WHERE Name LIKE :likeTerm OR Company LIKE :likeTerm
            ORDER BY Name
            LIMIT :lim
        ];
        if (rows.isEmpty()) return err('No Lead found for that name.');
        return ok(new Map<String, Object>{
            'status' => 'found',
            'primaryLeadId' => rows[0].Id,
            'recordCount' => rows.size(),
            'records' => rows
        });`,
      };
    case "Opportunity":
      return {
        param: "opportunityName",
        soqlBlock: `List<Opportunity> rows = [
            SELECT Id, Name, StageName, CloseDate, AccountId
            FROM Opportunity
            WHERE Name LIKE :likeTerm
            ORDER BY Name
            LIMIT :lim
        ];
        if (rows.isEmpty()) return err('No Opportunity found for that name.');
        return ok(new Map<String, Object>{
            'status' => 'found',
            'primaryOpportunityId' => rows[0].Id,
            'recordCount' => rows.size(),
            'records' => rows
        });`,
      };
    default:
      return null;
  }
}

function methodNameFor(objectApi: string): string {
  return `handleFind${objectApi}ByName`;
}

/**
 * Injects find_*_by_Name prompt commands and Apex private methods + when branches (before when else).
 * Stems are unprefixed (e.g. find_Contact_by_Name); ensureOrgUniquePromptCommands adds the agent prefix.
 */
export function injectFindByNameSkillsIfMissing(args: {
  promptCommands: PromptCommand[];
  handlerApex: string;
  unstemmedStems: string[];
  useCase: string;
  intentResearchInstructions: string | undefined;
}): { promptCommands: PromptCommand[]; handlerApex: string; injectedObjects: string[] } {
  const { unstemmedStems } = args;
  if (!needsFindByNameCoverage(args.useCase, args.intentResearchInstructions, unstemmedStems)) {
    return { promptCommands: args.promptCommands, handlerApex: args.handlerApex, injectedObjects: [] };
  }

  const objects = inferStandardObjectsForFindByName(
    args.useCase,
    args.intentResearchInstructions,
    unstemmedStems
  );
  const missing = objects.filter((o) => !alreadyHasFindByNameSkill(unstemmedStems, o));
  if (missing.length === 0) {
    return { promptCommands: args.promptCommands, handlerApex: args.handlerApex, injectedObjects: [] };
  }

  const newPrompts: PromptCommand[] = [];
  const snippets: string[] = [];
  const whenLines: string[] = [];

  for (const o of missing) {
    const stem = stemForFindObject(o);
    const fileName = `${stem}_PromptCommand.json`;
    newPrompts.push({ fileName, content: promptJsonFor(o) });
    const mName = methodNameFor(o);
    const snip = apexSnippetFor(o, mName);
    if (snip) snippets.push(snip);
    whenLines.push(`      when '${stem}' { return ${mName}(parameters); }`);
  }

  let handlerApex = args.handlerApex;
  if (whenLines.length > 0) {
    const whenBlock = `\n${whenLines.join("\n")}\n`;
    if (/\bwhen\s+else\s*\{/.test(handlerApex)) {
      handlerApex = handlerApex.replace(/(\s*when else\s*\{)/, `${whenBlock}$1`);
    }
  }
  if (snippets.length > 0) {
    const block = `\n${snippets.join("\n\n")}\n`;
    if (/\n\s*private\s+String\s+err\s*\(/i.test(handlerApex)) {
      handlerApex = handlerApex.replace(/(\n\s*private\s+String\s+err\s*\()/i, `${block}$1`);
    } else {
      const last = handlerApex.lastIndexOf("\n}");
      if (last > 0) {
        handlerApex = handlerApex.slice(0, last) + `\n${snippets.join("\n\n")}\n` + handlerApex.slice(last);
      }
    }
  }

  return {
    promptCommands: [...newPrompts, ...args.promptCommands],
    handlerApex,
    injectedObjects: missing,
  };
}
