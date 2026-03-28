import { promptStemFromFileName } from "./sf-deploy-pipeline";

/**
 * Models sometimes emit `{ "type": "object", "properties": {}, "required": [] }` which gives GPTfy
 * no parameters to pass — tools appear "empty". We infer minimal JSON Schema from the skill stem.
 */

function inferPropertiesFromStem(stemLower: string): {
  properties: Record<string, unknown>;
  required: string[];
} {
  const listish = /list|search|query|fetch|open_cases|cases_open|get_cases/i.test(stemLower);
  const caseish = /case|ticket|incident/i.test(stemLower);
  const contactish = /contact|patient|person/i.test(stemLower);
  const accountish = /account|company/i.test(stemLower);
  const leadish = /lead/i.test(stemLower);
  const oppish = /opportunity|opp|deal/i.test(stemLower);

  if (listish && caseish) {
    return {
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          description:
            "ONLY max Case rows to return (optional; default chosen in handler).",
        },
        statusFilter: {
          type: "string",
          description:
            "ONLY Case Status to filter (e.g. New, Working) — optional.",
        },
        accountName: {
          type: "string",
          description:
            "ONLY Account or customer name to narrow cases — optional.",
        },
      },
      required: [],
    };
  }

  if (listish && contactish) {
    return {
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          description: "ONLY max Contact rows to return (optional).",
        },
        searchTerm: {
          type: "string",
          description:
            "ONLY name or email fragment to filter contacts — optional.",
        },
      },
      required: [],
    };
  }

  if (listish && (accountish || leadish || oppish)) {
    return {
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          description: "ONLY max rows to return (optional).",
        },
        nameSearch: {
          type: "string",
          description: "ONLY name or title fragment to filter — optional.",
        },
      },
      required: [],
    };
  }

  if (listish || /report|summarize|dashboard/i.test(stemLower)) {
    return {
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 500,
          description: "ONLY max records to return (optional).",
        },
        filterText: {
          type: "string",
          description:
            "ONLY optional text from the user to narrow results (status, name, date hints).",
        },
      },
      required: [],
    };
  }

  return {
    properties: {
      userContext: {
        type: "string",
        description:
          "ONLY free-text detail from the user (filters, names, limits). Use when the skill needs optional narrowing; may be omitted if the handler ignores it.",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 500,
        description: "ONLY max records to return (optional).",
      },
    },
    required: [],
  };
}

function isPropertiesEmpty(parsed: {
  properties?: Record<string, unknown>;
}): boolean {
  const p = parsed.properties;
  if (!p || typeof p !== "object") return true;
  return Object.keys(p).length === 0;
}

/**
 * If `properties` is empty, replace with inferred schema. Preserves non-empty schemas.
 */
export function repairEmptyPromptCommandSchema(
  fileName: string,
  content: string
): string {
  let stem = promptStemFromFileName(fileName);
  if (!stem) {
    stem = fileName.replace(/_PromptCommand\.json$/i, "").replace(/\.json$/i, "");
  }
  const stemLower = stem.toLowerCase();

  try {
    const parsed = JSON.parse(content) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: unknown;
    };
    if (!parsed || typeof parsed !== "object") return content;
    if (!isPropertiesEmpty(parsed)) {
      if (!parsed.type) parsed.type = "object";
      return JSON.stringify(parsed, null, 2);
    }

    const inferred = inferPropertiesFromStem(stemLower);
    return JSON.stringify(
      {
        type: "object",
        properties: inferred.properties,
        required: inferred.required,
      },
      null,
      2
    );
  } catch {
    return content;
  }
}
