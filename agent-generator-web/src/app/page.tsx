import Link from "next/link";

const steps = [
  {
    title: "Connect Salesforce",
    body: "OAuth to production or sandbox. Tokens stay in an encrypted session cookie.",
    href: "/connect",
  },
  {
    title: "Connection check",
    body: "Verifies GPTfy-style objects exist and detects ccai__ / ccai_qa__ vs unprefixed API names.",
    href: "/status",
  },
  {
    title: "Generate & download",
    body: "One click: generate from your use case and publish Apex, prompts, agent, skills, and starter intents in the connected org (or download a ZIP).",
    href: "/generate",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <p className="text-sm font-medium text-[var(--accent)] tracking-wide uppercase">
          GPTfy · Agentic skills
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight max-w-2xl">
          End-to-end web app to draft agents for your org
        </h1>
        <p className="text-[var(--muted)] text-lg leading-relaxed max-w-2xl">
          Public-friendly: anyone with a Connected App and GPTfy metadata can connect,
          validate their org, and export a working starter bundle. Add{" "}
          <code className="text-cyan-400 text-sm">OPENAI_API_KEY</code> on the server for
          AI-written Apex; otherwise you get a safe template with a health-check skill.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/connect"
            className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-5 py-3 font-medium text-white hover:bg-[var(--accent-dim)] transition"
          >
            Start — Connect org
          </Link>
          <Link
            href="/generate"
            className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-medium text-white hover:border-[var(--muted)] transition"
          >
            Go to generator
          </Link>
        </div>
      </div>

      <ol className="grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.href}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col"
          >
            <span className="text-3xl font-bold text-[var(--border)] mb-2">{i + 1}</span>
            <h2 className="font-semibold text-white mb-2">{s.title}</h2>
            <p className="text-sm text-[var(--muted)] flex-1 mb-4">{s.body}</p>
            <Link
              href={s.href}
              className="text-sm text-[var(--accent)] hover:underline font-medium"
            >
              Open →
            </Link>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 text-sm text-[var(--muted)]">
        <h3 className="text-white font-medium mb-2">Deploy this app (Vercel)</h3>
        <p>
          Set root to <code className="text-cyan-400">agent-generator-web</code>, add env
          vars from <code className="text-cyan-400">.env.example</code>, and register the
          callback URL in your Salesforce Connected App. See{" "}
          <code className="text-cyan-400">README.md</code> in this folder.
        </p>
      </div>
    </div>
  );
}
