import type { DeployStep } from "@/lib/sf-deploy-pipeline";

export type DeployStreamHandlers = {
  onStatus?: (message: string) => void;
  onStep?: (step: DeployStep) => void;
  onErrorLine?: (message: string) => void;
  onFatal?: (message: string) => void;
};

/**
 * Read NDJSON lines from a fetch Response until `complete` event or stream end.
 */
export async function consumeDeployNdjsonStream(
  response: Response,
  handlers: DeployStreamHandlers
): Promise<Record<string, unknown> | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onFatal?.("No response body");
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let complete: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    for (;;) {
      const nl = buffer.indexOf("\n");
      if (nl < 0) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;

      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(line) as Record<string, unknown>;
      } catch {
        handlers.onFatal?.("Invalid stream line");
        continue;
      }

      const t = ev.type;
      if (t === "status" && typeof ev.message === "string") {
        handlers.onStatus?.(ev.message);
      } else if (t === "step" && ev.step && typeof ev.step === "object") {
        handlers.onStep?.(ev.step as DeployStep);
      } else if (t === "error" && typeof ev.message === "string") {
        handlers.onErrorLine?.(ev.message);
      } else if (t === "fatal" && typeof ev.message === "string") {
        handlers.onFatal?.(ev.message);
      } else if (t === "complete") {
        complete = ev;
      }
    }
  }

  return complete;
}
