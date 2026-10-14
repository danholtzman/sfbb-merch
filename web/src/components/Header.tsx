"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Role } from "../domain/types";
import { Brand } from "./Brand";

export function Header({ role, csrfToken, active }: { role: Role; csrfToken: string; active: "shop" | "find" | "admin" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const checkRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) void fetch("/api/auth/session", { cache: "no-store" }).then(response => {
        if (response.status === 401) window.location.replace("/login");
      });
    };
    window.addEventListener("pageshow", checkRestoredPage);
    return () => window.removeEventListener("pageshow", checkRestoredPage);
  }, []);
  async function signOut() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
      if (!response.ok && response.status !== 401) throw new Error("Sign out failed");
      // Shared with the member cart/edit implementation in Stage 8.
      for (const key of ["sfbb:cart", "sfbb:editing-order"]) {
        try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. The server session is already revoked. */ }
        try { localStorage.removeItem(key); } catch { /* Full navigation also discards in-memory member state. */ }
      }
      window.dispatchEvent(new Event("sfbb:signout"));
      window.location.replace("/login");
    } catch { setError("Unable to sign out. Please try again."); setPending(false); }
  }
  return <>
    <header className="site-header" data-active={active}>
      <Brand />
      <nav aria-label="Member navigation">
        <Link className={`nav-link shop-link${active === "shop" ? " active" : ""}`} href="/shop" aria-current={active === "shop" ? "page" : undefined}>Season shop</Link>
        <Link className={`nav-link${active === "find" ? " active" : ""}`} href="/find-order" aria-current={active === "find" ? "page" : undefined}>Find my order</Link>
      </nav>
      <div className="header-actions">
        {role === "admin" && <Link className="admin-link desktop-only" href="/admin" aria-current={active === "admin" ? "page" : undefined}>Admin</Link>}
        <button type="button" className="text-button" onClick={signOut} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>
      </div>
    </header>
    {error && <p className="header-error" role="alert">{error}</p>}
  </>;
}
