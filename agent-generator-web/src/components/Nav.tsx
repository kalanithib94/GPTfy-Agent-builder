import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold text-lg text-white tracking-tight">
          GPTfy Agent Generator
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/connect" className="text-[var(--muted)] hover:text-white transition">
            Connect org
          </Link>
          <Link href="/status" className="text-[var(--muted)] hover:text-white transition">
            Connection check
          </Link>
          <Link href="/generate" className="text-[var(--muted)] hover:text-white transition">
            Generator
          </Link>
        </nav>
      </div>
    </header>
  );
}
