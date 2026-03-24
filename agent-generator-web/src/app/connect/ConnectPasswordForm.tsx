"use client";

/**
 * Field order and hints aligned with patient-management-frontend Settings (Salesforce Configuration):
 * environment → login URL (read-only) → username → password (+ show/hide) → security token.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = { disabled: boolean };

export function ConnectPasswordForm({ disabled }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityToken, setSecurityToken] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loginUrlDisplay = useMemo(
    () =>
      sandbox ? "https://test.salesforce.com" : "https://login.salesforce.com",
    [sandbox]
  );

  function clearForm() {
    if (!confirm("Clear all fields?")) return;
    setUsername("");
    setPassword("");
    setSecurityToken("");
    setSandbox(false);
    setErr(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/salesforce/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          securityToken: securityToken.trim() || undefined,
          sandbox,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        detail?: string;
      };
      if (!res.ok) {
        const msg =
          j.message ||
          (typeof j.detail === "string" ? j.detail.slice(0, 200) : null) ||
          j.error ||
          "Login failed";
        setErr(msg);
        return;
      }
      router.push("/status");
      router.refresh();
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="rounded-lg border border-cyan-500/15 bg-cyan-950/20 px-3 py-2 text-xs text-neutral-400 leading-relaxed">
        Same idea as your Patient app <strong className="text-neutral-300">Settings → Salesforce</strong>: username,
        password, and optional security token. Here we use the Connected App&apos;s OAuth password grant (no
        credential storage on the server).
      </p>

      <div className="space-y-2">
        <span className="text-xs font-medium text-neutral-300">Environment</span>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
            disabled={disabled || loading}
            className="mt-1 rounded border-neutral-600"
          />
          <span>
            <span className="text-neutral-300">Use sandbox</span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Check for Sandbox or scratch org (matches Salesforce test login host).
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-400">Login URL</label>
        <input
          type="text"
          readOnly
          value={loginUrlDisplay}
          className="inp cursor-not-allowed opacity-90"
          aria-label="Login URL (auto from environment)"
        />
        <p className="text-xs text-neutral-500">Set automatically from the environment checkbox (like your Settings page).</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-400">Username</label>
        <input
          type="email"
          name="username"
          autoComplete="username"
          required
          disabled={disabled || loading}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="inp"
          placeholder="your-username@company.com"
        />
        <p className="text-xs text-neutral-500">Your Salesforce login email.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-400">Password</label>
        <div className="flex gap-2">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            disabled={disabled || loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="inp"
            placeholder="Your Salesforce password"
          />
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => setShowPassword((v) => !v)}
            className="btn shrink-0 text-xs"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">Your Salesforce account password.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-400">
          Security token <span className="text-neutral-600">(optional)</span>
        </label>
        <input
          type="text"
          name="securityToken"
          autoComplete="off"
          disabled={disabled || loading}
          value={securityToken}
          onChange={(e) => setSecurityToken(e.target.value)}
          className="inp"
          placeholder="Append to password if your org requires it"
        />
        <p className="text-xs text-neutral-500">
          Setup → Personal Information → Reset My Security Token (or reset email). Often required when IP isn&apos;t
          trusted.
        </p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={disabled || loading || !username.trim()}
          className="btn btn-primary"
        >
          {loading ? "Signing in…" : "Sign in to org"}
        </button>
        <button type="button" disabled={disabled || loading} onClick={clearForm} className="btn text-xs">
          Clear fields
        </button>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed">
        Backend uses OAuth <code className="text-neutral-400">grant_type=password</code> with your Connected App
        Consumer Key/Secret — same password composition as{" "}
        <code className="text-neutral-400">jsforce Connection.login(username, password + token)</code> in your
        backend. Credentials are not stored; only the session token is kept in an httpOnly cookie.
      </p>
    </form>
  );
}
