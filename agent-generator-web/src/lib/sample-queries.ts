/**
 * Natural-language sample prompts for the "Sample prompts" tab (end-user / customer style).
 * Avoid internal terms like "Use skill", "Trigger intent", or raw API names.
 */

export function humanizeIdentifier(v: string): string {
  return v
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map intent developer name → plausible customer utterance. */
export function customerQuestionFromIntentName(intentName: string): string {
  const lower = intentName.toLowerCase();
  const human = humanizeIdentifier(intentName);

  if (/\bgreeting\b/.test(lower)) {
    return "Hi — I just opened the chat. What can you help me with?";
  }
  if (/out_of_scope|out of scope/.test(lower)) {
    return "I have a question that might not be something you handle — can you still point me in the right direction?";
  }
  if (/\bfarewell\b|\bgoodbye\b|\bbye\b/.test(lower)) {
    return "Thanks, that's all I needed.";
  }
  if (lower.includes("escalat")) {
    return "Can you escalate this to someone who can resolve it?";
  }
  if (lower.includes("update") && lower.includes("case")) {
    return "Can you update my case with the latest details?";
  }
  if (lower.includes("create") && lower.includes("case")) {
    return "Can you create a case for me?";
  }
  if (
    lower.includes("find") ||
    lower.includes("search") ||
    lower.includes("lookup")
  ) {
    return "Can you look up my case or account?";
  }
  if (lower.includes("status")) {
    return "What's the status of my request?";
  }
  if (lower.includes("retention") || lower.includes("follow") || lower.includes("proactive")) {
    return "Can someone follow up with me on this?";
  }
  if (lower.includes("exception") || lower.includes("not_found") || lower.includes("not found")) {
    return "I can't find my record — can you help?";
  }

  const first = human.charAt(0).toUpperCase();
  const rest = human.slice(1);
  return `Can you help me with ${first}${rest}?`;
}

/** Map skill stem → plausible customer utterance. */
export function customerQuestionFromSkillName(skillName: string): string {
  const lower = skillName.toLowerCase();

  if (
    lower.includes("health") &&
    (lower.includes("check") || lower.includes("agent"))
  ) {
    return "Can you run a quick check and confirm everything is working on my side?";
  }
  if (lower.includes("update") && lower.includes("case")) {
    return "Can you update my case?";
  }
  if (lower.includes("create") && lower.includes("task")) {
    return "Can you create a task for me?";
  }

  const stripped = skillName.replace(/^([A-Za-z][A-Za-z0-9]*_)+/, "");
  const human = humanizeIdentifier(stripped || skillName);
  return `I need help with ${human.charAt(0).toLowerCase()}${human.slice(1)}.`;
}

export function buildDefaultSampleQueries(
  agentName: string,
  skillNames: string[]
): string[] {
  const queries: string[] = [
    "Hi, what can you do for me?",
    `What can ${agentName} help me with?`,
  ];
  for (const skill of skillNames.slice(0, 6)) {
    queries.push(customerQuestionFromSkillName(skill));
  }
  queries.push(
    "What if I give you incomplete information?",
    "Can you help if my question isn't really in your area?"
  );
  return queries.slice(0, 10);
}

type IntentPlanLike = { name?: string };

export function buildCoverageSampleQueries(
  agentName: string,
  skillNames: string[],
  intents: IntentPlanLike[] | undefined
): string[] {
  const cleanSkills = Array.from(new Set(skillNames.filter(Boolean)));
  const cleanIntents = Array.from(
    new Set((intents ?? []).map((i) => (i.name ?? "").trim()).filter(Boolean))
  );
  const queries: string[] = [];

  queries.push(`Hi — I'm talking to ${agentName}. What should I ask first?`);

  for (const skill of cleanSkills.slice(0, 4)) {
    queries.push(customerQuestionFromSkillName(skill));
  }
  for (const intent of cleanIntents.slice(0, 6)) {
    queries.push(customerQuestionFromIntentName(intent));
  }

  const mixed: string[] = [
    "Something went wrong with my last request — can you take a look?",
    "Can you walk me through the next step?",
    "I'm not sure what I need — can you ask me what you need to know?",
    "Can you confirm that went through on your end?",
  ];
  for (const m of mixed) {
    queries.push(m);
  }

  const deduped = Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean)));
  if (deduped.length < 4) {
    return buildDefaultSampleQueries(agentName, cleanSkills);
  }
  return deduped.slice(0, 10);
}

export function buildTemplateSampleQueries(
  skillName: string,
  intentNames: string[]
): string[] {
  const queries: string[] = [
    "Hi — what can you help me with today?",
    customerQuestionFromSkillName(skillName),
    "Can you check if everything is connected and working?",
    "Is there anything wrong with my setup or permissions?",
  ];
  for (const intent of intentNames) {
    queries.push(customerQuestionFromIntentName(intent));
  }
  queries.push(
    "Something isn't working — can you help me figure it out?",
    "Can you give me a short summary of what you're able to do for me?",
    "I need a hand with my Salesforce case — where do we start?"
  );
  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(
    0,
    10
  );
}
