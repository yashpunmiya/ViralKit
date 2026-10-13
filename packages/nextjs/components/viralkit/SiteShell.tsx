"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { WalletConnectButton } from "./WalletConnectButton";

const links = [
  ["/creator", "Campaigns"],
  ["/dashboard", "Referrals"],
  ["/developer", "Developers"],
  ["/docs", "Docs"],
  ["/settings", "Settings"],
] as const;

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="site-frame">
      <header className="site-header">
        <Link className="brand-lockup" href="/" aria-label="ViralKit home">
          <span className="brand-mark">v</span>
          <span>viralkit</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link key={href} className={pathname === href ? "nav-active" : ""} href={href}>
              {label}
            </Link>
          ))}
          <Link className={pathname.startsWith("/examples") ? "nav-active" : ""} href="/examples">
            Examples
          </Link>
        </nav>
        <div className="header-actions">
          <span className="network-pill">
            <i aria-hidden="true" />
            Monad Testnet
          </span>
          <ThemeToggle />
          <WalletConnectButton />
        </div>
      </header>
      <div className="testnet-banner">
        <span>Testnet environment</span>
        <span>MON and AUSD shown here are test assets with no real-world value.</span>
      </div>
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <Link className="brand-lockup footer-brand" href="/">
          <span className="brand-mark">v</span>
          <span>viralkit</span>
        </Link>
        <p>Referral infrastructure for apps on Monad.</p>
        <div>
          <Link href="/docs">Documentation</Link>
          <Link href="/examples">Examples</Link>
          <Link href="/developer">Developer workspace</Link>
        </div>
      </footer>
    </div>
  );
}
