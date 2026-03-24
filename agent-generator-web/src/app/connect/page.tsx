import Link from "next/link";

type Props = { searchParams: { error?: string } };

export default function ConnectPage({ searchParams }: Props) {
  const err = searchParams.error;

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Connect Salesforce</h1>
        <p className="text-[var(--muted)]">
          Uses OAuth 2.0 authorization code flow. You need a Connected App with the
          callback URL pointing to this deployment&apos;s{" "}
          <code className="text-cyan-400 text-xs">/api/salesforce/callback</code>.
        </p>
      </div>

      {err ? (
        <div
          className="rounded-md border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {decodeURIComponent(err)}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4">
        <a
          href="/api/salesforce/login"
          className="inline-flex justify-center rounded-md bg-[var(--accent)] px-5 py-3 font-medium text-white hover:bg-[var(--accent-dim)] transition"
        >
          Sign in — Production
        </a>
        <a
          href="/api/salesforce/login?sandbox=1"
          className="inline-flex justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-medium text-white hover:border-[var(--muted)] transition"
        >
          Sign in — Sandbox
        </a>
      </div>

      <p className="text-sm text-[var(--muted)]">
        After approval you&apos;ll be redirected to{" "}
        <Link href="/status" className="text-[var(--accent)] hover:underline">
          Connection check
        </Link>
        .
      </p>
    </div>
  );
}
