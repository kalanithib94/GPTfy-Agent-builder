import Link from "next/link";

const steps = [
  {
    href: "/connect",
    title: "Connect",
    desc: "OAuth to your org",
    tint: "from-cyan-500/20 to-cyan-400/5",
    ring: "ring-cyan-400/25",
  },
  {
    href: "/status",
    title: "Check",
    desc: "GPTfy metadata",
    tint: "from-violet-500/20 to-violet-400/5",
    ring: "ring-violet-400/25",
  },
  {
    href: "/generate",
    title: "Generate",
    desc: "Use case → deploy or ZIP",
    tint: "from-emerald-500/20 to-emerald-400/5",
    ring: "ring-emerald-400/25",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10 lg:space-y-12">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-cyan-400/90">
          GPTfy · Agent builder
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Build agentic handlers &amp; prompts
        </h1>
        <p className="mt-3 text-base text-neutral-400">
          Connect Salesforce, validate your org, then generate and publish from a use case.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className={`card group block bg-gradient-to-br ${s.tint} ring-1 ${s.ring} transition hover:brightness-110`}
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-cyan-50">{s.title}</h2>
              <p className="mt-1 text-sm text-neutral-400">{s.desc}</p>
              <span className="mt-4 inline-flex text-xs font-medium text-cyan-300/90">
                Open →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
