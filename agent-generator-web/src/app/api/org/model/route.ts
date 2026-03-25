import { NextResponse } from "next/server";
import { describeSObject, resolveObjectName } from "@/lib/gptfy-metadata";
import { getSfSession } from "@/lib/session";
import type { DescribeField } from "@/lib/gptfy-metadata";

type FieldView = {
  apiName: string;
  label?: string;
  type?: string;
  required: boolean;
  createable?: boolean;
  updateable?: boolean;
  picklistValues?: string[];
};

function fieldSuffixMatchesName(fieldName: string, suffix: string): boolean {
  return fieldName === suffix || fieldName.endsWith(`__${suffix}`);
}

function pickFieldBySuffix(
  fields: DescribeField[],
  suffix: string
) {
  return fields.find((f) => fieldSuffixMatchesName(f.name, suffix));
}

function toFieldView(field: {
  name: string;
  label?: string;
  type?: string;
  nillable?: boolean;
  createable?: boolean;
  updateable?: boolean;
  picklistValues?: { value?: string; active?: boolean }[];
}): FieldView {
  const picks = Array.isArray(field.picklistValues)
    ? field.picklistValues
        .filter((v) => v && (v.active ?? true) && typeof v.value === "string")
        .map((v) => String(v.value))
    : undefined;
  return {
    apiName: field.name,
    label: field.label,
    type: field.type,
    required: field.nillable === false,
    createable: field.createable,
    updateable: field.updateable,
    picklistValues: picks?.length ? picks : undefined,
  };
}

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSfSession();
  if (!session.accessToken || !session.instanceUrl) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const apiVersion = "v59.0";
  const wanted = [
    "AI_Prompt__c",
    "AI_Agent__c",
    "AI_Agent_Intent__c",
    "AI_Intent_Action__c",
    "AI_Intent_Action_Detail__c",
  ] as const;

  try {
    const objects: Array<{
      localName: string;
      apiName: string;
      keyFields: FieldView[];
      allFieldsCount: number;
    }> = [];

    for (const local of wanted) {
      const resolved = await resolveObjectName(
        session.instanceUrl,
        session.accessToken,
        apiVersion,
        local
      );
      if (!resolved.found) {
        objects.push({
          localName: local,
          apiName: `(not found: ${resolved.tried.join(", ")})`,
          keyFields: [],
          allFieldsCount: 0,
        });
        continue;
      }
      const d = await describeSObject(
        session.instanceUrl,
        session.accessToken,
        apiVersion,
        resolved.apiName
      );
      if (!d.ok) {
        objects.push({
          localName: local,
          apiName: `${resolved.apiName} (describe failed: ${d.status})`,
          keyFields: [],
          allFieldsCount: 0,
        });
        continue;
      }

      const fields = d.body.fields;
      const suffixesByObject: Record<string, string[]> = {
        AI_Prompt__c: [
          "Prompt_Command__c",
          "Agentic_Function_Class__c",
          "AI_Connection__c",
          "AI_Data_Extraction_Mapping__c",
          "External_Id__c",
          "Type__c",
          "Status__c",
        ],
        AI_Agent__c: [
          "Developer_Name__c",
          "AI_Model__c",
          "System_Prompt__c",
          "Description__c",
          "Status__c",
        ],
        AI_Agent_Intent__c: [
          "AI_Agent__c",
          "Sequence__c",
          "Is_Active__c",
          "Description__c",
        ],
        AI_Intent_Action__c: [
          "AI_Agent_Intent__c",
          "Sequence__c",
          "Action_Type__c",
          "Is_Active__c",
          "Description__c",
          "Language__c",
          "Canned_Response_Text__c",
          "Object_API_Name__c",
          "Flow_API_Name__c",
          "Apex_Class_Name__c",
          "Apex_Return_Type__c",
        ],
        AI_Intent_Action_Detail__c: [
          "AI_Intent_Action__c",
          "Field_API_Name__c",
          "Type__c",
          "Hardcoded_Value_Or_AI_Instruction__c",
          "Is_Active__c",
        ],
      };
      const suffixes = suffixesByObject[local] ?? [];
      const keyFields = suffixes
        .map((suffix) => pickFieldBySuffix(fields, suffix))
        .filter(Boolean)
        .map((f) => toFieldView(f!));

      objects.push({
        localName: local,
        apiName: resolved.apiName,
        keyFields,
        allFieldsCount: fields.length,
      });
    }

    return NextResponse.json({
      connected: true,
      instanceUrl: session.instanceUrl,
      username: session.username,
      orgId: session.orgId,
      namespace: session.gptfyNamespace ?? null,
      objects,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "model_fetch_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
