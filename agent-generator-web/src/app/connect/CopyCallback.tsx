"use client";

import { useState } from "react";

type Props = { url: string };

export function CopyCallback({ url }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="text-xs text-cyan-200/90 break-all rounded bg-black/40 px-2 py-1.5 text-left sm:text-sm">
        {url}
      </code>
      <button type="button" onClick={() => copy()} className="btn shrink-0 text-xs">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
