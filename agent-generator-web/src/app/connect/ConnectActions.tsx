"use client";

import { useState } from "react";

type Props = {
  ready: boolean;
};

export function ConnectActions({ ready }: Props) {
  const [loading, setLoading] = useState<null | "prod" | "sandbox">(null);

  function go(href: string, kind: "prod" | "sandbox") {
    if (!ready) return;
    setLoading(kind);
    window.location.assign(href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!ready || loading !== null}
          onClick={() => go("/api/salesforce/login", "prod")}
          className="btn btn-primary min-w-[148px] text-sm"
        >
          {loading === "prod" ? "Redirecting…" : "Production"}
        </button>
        <button
          type="button"
          disabled={!ready || loading !== null}
          onClick={() => go("/api/salesforce/login?sandbox=1", "sandbox")}
          className="btn min-w-[148px] text-sm"
        >
          {loading === "sandbox" ? "Redirecting…" : "Sandbox"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Production uses <code className="text-neutral-400">login.salesforce.com</code>. Sandbox uses{" "}
        <code className="text-neutral-400">test.salesforce.com</code>.
      </p>
      {loading ? (
        <p className="text-sm text-neutral-500">Opening Salesforce — keep this tab open until you return.</p>
      ) : null}
    </div>
  );
}
