import JSZip from "jszip";

export type MetadataDeployResult =
  | { ok: true }
  | { ok: false; message: string; details?: string };

function applyMetadataDeployPolling(conn: {
  metadata: { pollInterval: number; pollTimeout: number };
}): void {
  // jsforce MetadataApi defaults: pollInterval 1s, pollTimeout 10s — far too low for
  // real-org Metadata deploys; otherwise complete() throws "Polling time out".
  conn.metadata.pollInterval = 5000;
  conn.metadata.pollTimeout = 900000; // 15 minutes
}

/**
 * Deploy a single Apex class via Metadata API (async deploy + wait).
 */
export async function deployApexClassMetadata(
  instanceUrl: string,
  accessToken: string,
  className: string,
  body: string,
  metaXml: string
): Promise<MetadataDeployResult> {
  const zip = new JSZip();
  zip.file(
    "package.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types><members>${escapeXml(className)}</members><name>ApexClass</name></types>
    <version>59.0</version>
</Package>`
  );
  zip.file(`classes/${className}.cls`, body);
  zip.file(`classes/${className}.cls-meta.xml`, metaXml);

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  try {
    const jsforce = (await import("jsforce")).default;
    const conn = new jsforce.Connection({
      instanceUrl,
      accessToken,
      version: "59.0",
    });
    applyMetadataDeployPolling(conn);

    const deployResult = await conn.metadata
      .deploy(buf, {
        rollbackOnError: true,
        singlePackage: true,
        testLevel: "NoTestRun",
      })
      .complete(true);

    if (!deployResult.success) {
      const det = deployResult.details as {
        componentFailures?: unknown | unknown[];
        runTestResult?: unknown;
      };
      const failures = det?.componentFailures;
      const arr = Array.isArray(failures)
        ? failures
        : failures
          ? [failures]
          : [];
      const msgs = arr
        .map((f: { problem?: string; fileName?: string }) =>
          [f.fileName, f.problem].filter(Boolean).join(": ")
        )
        .filter(Boolean);
      return {
        ok: false,
        message: msgs.length ? msgs.join(" | ") : "Metadata deploy failed",
        details: JSON.stringify(det ?? deployResult).slice(0, 4000),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Deploy a single Flow metadata file via Metadata API.
 */
export async function deployFlowMetadata(
  instanceUrl: string,
  accessToken: string,
  flowApiName: string,
  flowMetaXml: string
): Promise<MetadataDeployResult> {
  const zip = new JSZip();
  zip.file(
    "package.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types><members>${escapeXml(flowApiName)}</members><name>Flow</name></types>
    <version>59.0</version>
</Package>`
  );
  zip.file(`flows/${flowApiName}.flow-meta.xml`, flowMetaXml);

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  try {
    const jsforce = (await import("jsforce")).default;
    const conn = new jsforce.Connection({
      instanceUrl,
      accessToken,
      version: "59.0",
    });
    applyMetadataDeployPolling(conn);

    const deployResult = await conn.metadata
      .deploy(buf, {
        rollbackOnError: true,
        singlePackage: true,
        testLevel: "NoTestRun",
      })
      .complete(true);

    if (!deployResult.success) {
      const det = deployResult.details as {
        componentFailures?: unknown | unknown[];
      };
      const failures = det?.componentFailures;
      const arr = Array.isArray(failures)
        ? failures
        : failures
          ? [failures]
          : [];
      const msgs = arr
        .map((f: { problem?: string; fileName?: string }) =>
          [f.fileName, f.problem].filter(Boolean).join(": ")
        )
        .filter(Boolean);
      return {
        ok: false,
        message: msgs.length ? msgs.join(" | ") : "Flow metadata deploy failed",
        details: JSON.stringify(det ?? deployResult).slice(0, 4000),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
