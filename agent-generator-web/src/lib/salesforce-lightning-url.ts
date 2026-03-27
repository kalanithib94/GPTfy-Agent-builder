/**
 * Build a Lightning record URL from an OAuth instanceUrl (REST API host).
 * GPTfy agent testing runs in Salesforce, not in this app — use this to open the AI_Agent__c row.
 */
export function lightningRecordViewUrl(
  instanceUrl: string,
  objectApiName: string,
  recordId: string
): string {
  const u = new URL(instanceUrl);
  let host = u.hostname;
  if (host.endsWith(".my.salesforce.com")) {
    host = host.replace(/\.my\.salesforce\.com$/i, ".lightning.force.com");
  } else if (host.endsWith(".salesforce.com")) {
    host = host.replace(/\.salesforce\.com$/i, ".lightning.force.com");
  }
  const base = `${u.protocol}//${host}`;
  return `${base}/lightning/r/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}/view`;
}
