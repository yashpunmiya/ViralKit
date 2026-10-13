"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { WalletConnectButton } from "~~/components/viralkit/WalletConnectButton";

const steps = [
  {
    title: "Create your account",
    body: "Sign in securely with Dynamic. Your account connects to a wallet you own or creates one for you.",
  },
  { title: "Connect a wallet", body: "Use your wallet on Monad Testnet to configure campaigns and sign transactions." },
  {
    title: "Create a campaign",
    body: "Choose a price, AUSD payment token, and referral share in your campaign workspace.",
  },
  {
    title: "Integrate and track",
    body: "Share a campaign link or use the SDK. Confirmed earnings appear in your referral dashboard.",
  },
];

export default function OnboardingPage() {
  const { isConnected, address, chainId } = useAccount();
  const [role, setRole] = useState("");
  useEffect(() => {
    setRole(localStorage.getItem(`viralkit-role:${address ?? "guest"}`) ?? "");
  }, [address]);
  function chooseRole(value: string) {
    setRole(value);
    localStorage.setItem(`viralkit-role:${address ?? "guest"}`, value);
  }
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Getting started</span>
        <h1>Your growth setup, step by step.</h1>
        <p>
          Connect your wallet, create a campaign, and share a checkout integration. Transactions and balances on this
          site use Monad Testnet assets.
        </p>
      </div>
      <section className="onboarding-panel">
        <div className="onboarding-progress">
          <span className="eyebrow">Workspace setup</span>
          <h2>{isConnected ? "Wallet connected" : "Start with your account"}</h2>
          <p>
            {isConnected
              ? `Connected wallet ${address?.slice(0, 6)}…${address?.slice(-4)}${chainId === 10143 ? " · Monad Testnet" : " · switch network when signing"}`
              : "Dynamic secures sign in and wallet connection."}
          </p>
          {!isConnected && <WalletConnectButton />}
          <div className="field section">
            <label htmlFor="workspace-role">How will you use ViralKit?</label>
            <select id="workspace-role" value={role} onChange={event => chooseRole(event.target.value)}>
              <option value="">Choose a workspace</option>
              <option value="business">Business</option>
              <option value="affiliate">Affiliate</option>
              <option value="both">Both</option>
            </select>
            <p className="field-hint">
              This preference is saved in this browser. You can use both roles with the same wallet.
            </p>
          </div>
        </div>
        <div className="onboarding-list">
          {steps.map((step, i) => (
            <article className="setup-step" key={step.title}>
              <span
                className={`setup-index ${(i === 0 && isConnected) || (i === 1 && isConnected && chainId === 10143) ? "setup-complete" : ""}`}
              >
                {(i === 0 && isConnected) || (i === 1 && isConnected && chainId === 10143) ? "✓" : `0${i + 1}`}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              {i === 2 && (
                <Link href="/creator" className="text-link">
                  Create campaign ↗
                </Link>
              )}
              {i === 3 && (
                <Link href="/developer" className="text-link">
                  Integration details ↗
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
      <div className="onboarding-shortcuts">
        <Link href="/creator" className={`button ${role === "affiliate" ? "button-secondary" : "button-primary"}`}>
          Open campaign workspace
        </Link>
        <Link href="/dashboard" className={`button ${role === "affiliate" ? "button-primary" : "button-secondary"}`}>
          View referral dashboard
        </Link>
      </div>
    </>
  );
}
