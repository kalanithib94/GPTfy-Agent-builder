/**
 * NDJSON stream for deploy progress (one JSON object per line).
 */

export function ndjsonDeployResponse(run: (write: (obj: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };
      try {
        await run(write);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        write({ type: "fatal", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
