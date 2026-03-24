import Link from "next/link";

const links: { href: string; label: string; subtle?: boolean }[] = [
  { href: "/connect", label: "Connect" },
  { href: "/status", label: "Check" },
  { href: "/generate", label: "Generate" },
  { href: "/admin", label: "OpenAI", subtle: true },
];

export function Nav() {
  return (
    <header className="relative z-20 border-b border-white/[0.08] bg-[#0a0c12]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-base font-semibold tracking-tight text-white"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/25 to-violet-500/25 ring-1 ring-cyan-400/30"
            aria-hidden
          >
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
          </span>
          <span>
            Agent generator
            <span className="ml-2 text-xs font-normal text-neutral-500 group-hover:text-neutral-400">
              GPTfy
            </span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {links.map(({ href, label, subtle = false }) => (
            <Link
              key={href}
              href={href}
              className={
                subtle
                  ? "rounded-lg px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-white/5 hover:text-cyan-200/90"
                  : "rounded-lg px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-cyan-200"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
