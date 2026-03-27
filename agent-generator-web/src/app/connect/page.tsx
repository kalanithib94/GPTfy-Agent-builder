import Link from "next/link";
import { headers } from "next/headers";
import { describeConnectError } from "@/lib/sf-connect-errors";
import {
  buildSuggestedCallbackUrl,
  getSalesforceConnectConfig,
} from "@/lib/sf-connect-config";
import { resolveSalesforceClientConfig } from "@/lib/sf-client-config";
import { ConnectActions } from "./ConnectActions";
import { ConnectClientConfigForm } from "./ConnectClientConfigForm";
import { CopyCallback } from "./CopyCallback";

type Props = { searchParams: { error?: string } };

function maskClientId(id: string | undefined): string {
  if (!id?.trim()) return "(not set)";
  const s = id.trim();
  if (s.length <= 18) return `${s.slice(0, 8)}…`;
  return `${s.slice(0, 12)}…${s.slice(-8)}`;
}

export default async function ConnectPage({ searchParams }: Props) {
  const err = searchParams.error;
  const friendlyError = describeConnectError(err);

  const h = headers();
  const suggestedCallback = buildSuggestedCallbackUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto")
  );

  const clientCfg = await resolveSalesforceClientConfig();
  const cfg = getSalesforceConnectConfig({
    clientId: clientCfg.clientId,
    clientSecret: clientCfg.clientSecret,
    callbackUrl: clientCfg.callbackUrl,
    source: clientCfg.source,
  });
  const missingOAuth: string[] = [];
  if (!cfg.hasClientId) missingOAuth.push("SALESFORCE_CLIENT_ID");
  if (!cfg.hasClientSecret) missingOAuth.push("SALESFORCE_CLIENT_SECRET");
  if (!cfg.hasCallbackUrl) missingOAuth.push("SALESFORCE_CALLBACK_URL");

  const ready = cfg.readyForToken;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="hero-card">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-300/85">Salesforce</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Connect your org in 2 steps</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Save this org&apos;s client settings, then connect with secure browser OAuth.
        </p>
      </div>

      <div className="glass-section border-cyan-500/25 bg-cyan-950/15 space-y-2">
        <p className="text-sm font-semibold text-cyan-100">Recommended flow (works for most orgs)</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-cyan-100/90 marker:text-cyan-300">
          <li>Paste this org&apos;s client settings and click <strong>Save for this browser</strong>.</li>
          <li>Click <strong>Production</strong> or <strong>Sandbox</strong> below.</li>
          <li>Complete Salesforce login and approve access.</li>
          <li>You should land on <code className="text-cyan-200">/status</code> as connected.</li>
        </ol>
      </div>

      <div className="card border border-[var(--border)] space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Server checks (Vercel or .env.local)</p>
        <p className="text-xs text-neutral-500">
          After changing variables on Vercel, run a new deployment — existing deployments do not pick up new values until you redeploy.
        </p>

        <div
          className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
            ready ? "border-emerald-500/25 bg-emerald-950/15" : "border-amber-500/25 bg-amber-950/10"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-white">Browser OAuth (recommended)</p>
            <p className="mt-1 text-sm text-neutral-400">
              {ready
                ? `Ready. Production/Sandbox buttons should work (${cfg.source === "session" ? "session config" : "server env"}).`
                : `Missing: ${missingOAuth.join(", ")} — add in Vercel, save, redeploy.`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {ready ? "OK" : `${3 - missingOAuth.length}/3`}
          </span>
        </div>

      </div>

      {friendlyError ? (
        <div className="glass-section border-red-500/30 text-sm text-red-100/95 break-words">{friendlyError}</div>
      ) : null}

      <div className="glass-section space-y-6">
        <div>
          <ConnectClientConfigForm
            suggestedCallback={suggestedCallback}
            usingSessionConfig={cfg.source === "session"}
          />
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Step 2: connect with Salesforce browser login</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                cfg.source === "session" ?
                  "bg-cyan-500/20 text-cyan-200"
                : "bg-amber-500/20 text-amber-200"
              }`}
            >
              Auth source: {cfg.source === "session" ? "Session override" : "Server env default"}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">This is the only supported path for most External Client Apps.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Current callback in use:{" "}
            <span className="text-neutral-300 break-all">{clientCfg.callbackUrl ?? "Not configured"}</span>
          </p>
          <div className="mt-3 rounded-lg border border-neutral-600/40 bg-black/30 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              OAuth debug (values sent on connect)
            </p>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-emerald-200/95 break-all">
              <span className="text-neutral-500">client_id</span> {maskClientId(clientCfg.clientId)}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-cyan-200/95 break-all">
              <span className="text-neutral-500">redirect_uri</span> {clientCfg.callbackUrl ?? "(not set)"}
            </p>
            <p className="mt-2 text-[10px] text-neutral-500">
              Compare <code className="text-neutral-400">redirect_uri</code> byte-for-byte with Callback URL in the
              same External Client App as this Consumer Key. If they differ, Salesforce returns{" "}
              <code className="text-neutral-400">redirect_uri_mismatch</code>.
            </p>
          </div>
          <div className="mt-4">
            <ConnectActions ready={ready} />
          </div>
          {!ready ? (
            <p className="mt-2 text-xs text-neutral-500">
              Needs Client ID, Client Secret, and Callback URL on the server.
            </p>
          ) : null}
        </div>
      </div>

      <div className="glass-section space-y-4">
        <h2 className="text-sm font-semibold text-neutral-200">Connected App callback URL</h2>
        <p className="text-sm text-neutral-500">
          Paste this exact URL into your Salesforce Connected App (OAuth).{" "}
          <code className="text-neutral-400">SALESFORCE_CALLBACK_URL</code> must match character-for-character.
        </p>
        <p className="text-xs text-neutral-500">
          OAuth callback path (relative):{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-cyan-200/90">/api/salesforce/callback</code>
        </p>
        <CopyCallback url={suggestedCallback} />
        {clientCfg.callbackUrl ? (
          <p className="text-xs text-neutral-500">
            Active callback ({cfg.source === "session" ? "session" : "env"}):{" "}
            <span className="text-neutral-400 break-all">{clientCfg.callbackUrl}</span>
          </p>
        ) : null}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-400 marker:text-cyan-500/80">
        <li>Create or edit a Connected App; enable OAuth; add scopes: api, refresh_token, offline_access, openid.</li>
        <li>Set the callback URL to the value above (or your production URL + /api/salesforce/callback).</li>
        <li>Either set Consumer Key/Secret in Vercel env vars, or save org-specific client config above.</li>
      </ol>

      <p className="text-sm text-neutral-500">
        Next:{" "}
        <Link href="/status" className="text-cyan-300/90 hover:underline">
          Check
        </Link>{" "}
        ·{" "}
        <Link href="/generate" className="text-cyan-300/90 hover:underline">
          Generate
        </Link>
      </p>
    </div>
  );
}
