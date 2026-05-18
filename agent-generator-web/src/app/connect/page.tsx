import Link from "next/link";
import { headers } from "next/headers";
import { describeConnectError } from "@/lib/sf-connect-errors";
import {
  buildSuggestedCallbackUrl,
  getSalesforceConnectConfig,
} from "@/lib/sf-connect-config";
import { ConnectActions } from "./ConnectActions";
import { ConnectPasswordForm } from "./ConnectPasswordForm";
import { CopyCallback } from "./CopyCallback";

type Props = { searchParams: { error?: string } };

export default function ConnectPage({ searchParams }: Props) {
  const err = searchParams.error;
  const friendlyError = describeConnectError(err);

  const h = headers();
  const suggestedCallback = buildSuggestedCallbackUrl(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto")
  );

  const cfg = getSalesforceConnectConfig();
  const missingOAuth: string[] = [];
  if (!cfg.hasClientId) missingOAuth.push("SALESFORCE_CLIENT_ID");
  if (!cfg.hasClientSecret) missingOAuth.push("SALESFORCE_CLIENT_SECRET");
  if (!cfg.hasCallbackUrl) missingOAuth.push("SALESFORCE_CALLBACK_URL");

  const missingPassword: string[] = [];
  if (!cfg.hasClientId) missingPassword.push("SALESFORCE_CLIENT_ID");
  if (!cfg.hasClientSecret) missingPassword.push("SALESFORCE_CLIENT_SECRET");

  const ready = cfg.readyForToken;
  const readyPassword = cfg.readyForPassword;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-cyan-400/80">Salesforce</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Connect org</h1>
        <p className="mt-2 text-neutral-400">
          OAuth callback path (relative):{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-cyan-200/90">/api/salesforce/callback</code>
        </p>
      </div>

      {/* Two checks: password form uses only ID+secret; browser OAuth needs callback too */}
      <div className="card border border-[var(--border)] space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Server env (Vercel or .env.local)</p>
        <p className="text-xs text-neutral-500">
          After changing variables on Vercel, run a new deployment — existing deployments do not pick up new values until you redeploy.
        </p>

        <div
          className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
            readyPassword ? "border-emerald-500/25 bg-emerald-950/15" : "border-amber-500/25 bg-amber-950/10"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-white">Sign in on this page (username / password)</p>
            <p className="mt-1 text-sm text-neutral-400">
              {readyPassword
                ? "Consumer Key and Secret are set — the form below is enabled."
                : `Missing: ${missingPassword.join(", ")} — add in Vercel, save, redeploy.`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              readyPassword ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {readyPassword ? "OK" : `${2 - missingPassword.length}/2`}
          </span>
        </div>

        <div
          className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
            ready ? "border-emerald-500/25 bg-emerald-950/15" : "border-neutral-600/40 bg-black/20"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-white">Production / Sandbox (browser OAuth)</p>
            <p className="mt-1 text-sm text-neutral-400">
              {ready
                ? "All three vars set — browser buttons work."
                : `Also needs: ${missingOAuth.join(", ")}.`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              ready ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-600/30 text-neutral-400"
            }`}
          >
            {ready ? "OK" : `${3 - missingOAuth.length}/3`}
          </span>
        </div>
      </div>

      {friendlyError ? (
        <div className="card-muted border-red-500/30 text-sm text-red-100/95 break-words">{friendlyError}</div>
      ) : null}

      <div className="card space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-white">Sign in with Salesforce (browser)</h2>
          <p className="mt-1 text-xs text-neutral-500">Opens Salesforce login — best for SSO and MFA.</p>
          <div className="mt-4">
            <ConnectActions ready={ready} />
          </div>
          {!ready ? (
            <p className="mt-2 text-xs text-neutral-500">
              Needs Client ID, Client Secret, and Callback URL on the server.
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <h2 className="text-sm font-semibold text-white">Or sign in on this page</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Same shape as a typical <strong className="text-neutral-400">Settings → Salesforce</strong> form (env,
            login URL, user, password, token). Uses OAuth password grant; only Consumer Key &amp; Secret — no callback
            URL for this path.
          </p>
          <div className="mt-4">
            <ConnectPasswordForm disabled={!readyPassword} />
          </div>
          {!readyPassword ? (
            <p className="mt-2 text-xs text-amber-200/90">Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.</p>
          ) : null}
        </div>
      </div>

      <div className="card-muted space-y-4">
        <h2 className="text-sm font-semibold text-neutral-200">Connected App callback URL</h2>
        <p className="text-sm text-neutral-500">
          Paste this exact URL into your Salesforce Connected App (OAuth).{" "}
          <code className="text-neutral-400">SALESFORCE_CALLBACK_URL</code> must match character-for-character.
        </p>
        <CopyCallback url={suggestedCallback} />
        {cfg.hasCallbackUrl ? (
          <p className="text-xs text-neutral-500">
            Configured: <span className="text-neutral-400 break-all">{process.env.SALESFORCE_CALLBACK_URL}</span>
          </p>
        ) : null}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-400 marker:text-cyan-500/80">
        <li>Create or edit a Connected App; enable OAuth; add scopes: api, refresh_token, offline_access, openid.</li>
        <li>Set the callback URL to the value above (or your production URL + /api/salesforce/callback).</li>
        <li>Copy Consumer Key / Secret into Vercel env vars; redeploy; refresh this page.</li>
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
