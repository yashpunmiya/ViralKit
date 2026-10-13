"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useAccount, useDisconnect, usePublicClient } from "wagmi";
import { REFERRAL_HUB_ABI } from "~~/lib/viralkit/abi";
import { EXPLORER_URL, MONAD_TESTNET_ID, REFERRAL_HUB_ADDRESS } from "~~/lib/viralkit/client";

function DynamicSignOut() {
  const { handleLogOut } = useDynamicContext();
  return (
    <button className="button button-secondary" type="button" onClick={() => void handleLogOut()}>
      Disconnect / sign out
    </button>
  );
}

export default function SettingsPage() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const { disconnect } = useDisconnect();
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!address) return;
    const profile = localStorage.getItem(`viralkit-profile:${address.toLowerCase()}`);
    if (profile)
      try {
        const parsed = JSON.parse(profile) as { businessName?: string; website?: string };
        setBusinessName(parsed.businessName ?? "");
        setWebsite(parsed.website ?? "");
      } catch {
        localStorage.removeItem(`viralkit-profile:${address.toLowerCase()}`);
      }
    if (!publicClient || !REFERRAL_HUB_ADDRESS) return;
    void publicClient
      .readContract({
        address: REFERRAL_HUB_ADDRESS,
        abi: REFERRAL_HUB_ABI,
        functionName: "referralCodeByReferrer",
        args: [address],
      })
      .then(code => setReferralCode(String(code)))
      .catch(e => setError(e instanceof Error ? e.message : "Could not read referral identity."));
  }, [address, publicClient]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address) return;
    localStorage.setItem(`viralkit-profile:${address.toLowerCase()}`, JSON.stringify({ businessName, website }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Account</span>
        <h1>Settings</h1>
        <p>Manage this browser’s profile details and review your connected wallet.</p>
      </div>
      {!isConnected ? (
        <div className="activity-empty">
          <strong>Connect your account</strong>
          <p>Sign in with Dynamic to view wallet and referral settings.</p>
        </div>
      ) : (
        <>
          <section className="panel section">
            <h2>Wallet</h2>
            <ul className="card-list">
              <li>
                <span>Address</span>
                <strong className="mono">{address}</strong>
              </li>
              <li>
                <span>Network</span>
                <strong>
                  {chainId === MONAD_TESTNET_ID
                    ? "Monad Testnet · 10143"
                    : `Chain ${chainId} · switch to Monad Testnet to transact`}
                </strong>
              </li>
              <li>
                <span>Referral identity</span>
                <strong>{referralCode || "No code registered"}</strong>
              </li>
            </ul>
            {address && (
              <a className="text-link" href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer">
                View wallet on explorer ↗
              </a>
            )}
            <div className="section">
              {process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ? (
                <DynamicSignOut />
              ) : (
                <button className="button button-secondary" type="button" onClick={() => disconnect()}>
                  Disconnect wallet
                </button>
              )}
            </div>
          </section>
          <form className="panel form-stack section" onSubmit={save}>
            <h2>Business profile</h2>
            <p className="panel-intro">
              These optional profile details are saved only in this browser and are not published onchain.
            </p>
            <div className="field">
              <label htmlFor="business-name">Business name</label>
              <input
                id="business-name"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="field">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <button className="button button-primary" type="submit">
              {saved ? "Saved on this device" : "Save profile"}
            </button>
          </form>
          <div className="onboarding-shortcuts">
            <Link href="/dashboard" className="button button-secondary">
              Manage referral code
            </Link>
            <Link href="/creator" className="button button-secondary">
              Business campaigns
            </Link>
          </div>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
        </>
      )}
    </>
  );
}
