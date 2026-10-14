"use client";
import { useRef, useState, type FormEvent } from "react";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error?.message ?? "Unable to sign in. Please try again."); passwordInput.current?.focus(); return; }
      window.location.replace(result.data.redirect);
    } catch { setError("Unable to sign in. Please try again."); }
    finally { setPending(false); }
  }
  return <form method="post" action="/api/auth/login" onSubmit={submit}>
    <noscript><p className="login-error">Enable JavaScript to sign in.</p></noscript>
    <label htmlFor="username">Username</label>
    <input id="username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="user or admin" maxLength={128} disabled={pending} />
    <label htmlFor="password">Password</label>
    <div className="password-field">
      <input id="password" name="password" ref={passwordInput} type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter the shared password" maxLength={1024} aria-describedby={error ? "login-error" : undefined} disabled={pending} />
      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
    </div>
    {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
    <button className="primary wide" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in →"}</button>
  </form>;
}
