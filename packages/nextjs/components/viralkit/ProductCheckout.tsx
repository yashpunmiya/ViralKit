"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Address, formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { ERC20_ABI } from "~~/lib/viralkit/abi";
import { EXPLORER_URL, MONAD_TESTNET_ID, createViralKitClient, hasContractConfiguration } from "~~/lib/viralkit/client";
import { decodeCampaignMetadata } from "~~/lib/viralkit/metadata";

type ProductCheckoutProps = {
  campaignId: string;
  kind: "newsletter" | "event" | "campaign";
  refCode: string;
  title: string;
  description: string;
};

type CampaignData = {
  id: bigint;
  merchant: Address;
  token: Address;
  price: bigint;
  commissionBps: number;
  active: boolean;
  metadata: string;
  decimals: number;
  symbol: string;
};

export function ProductCheckout({
  campaignId: campaignIdValue,
  kind,
  refCode,
  title,
  description,
}: ProductCheckoutProps) {
  const campaignId = useMemo(() => {
    try {
      return BigInt(campaignIdValue || "0");
    } catch {
      return 0n;
    }
  }, [campaignIdValue]);
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const { data: walletClient } = useWalletClient({ chainId: MONAD_TESTNET_ID });
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [campaign, setCampaign] = useState<CampaignData>();
  const [campaignError, setCampaignError] = useState("");
  const [referrer, setReferrer] = useState<Address>();
  const [referralChecked, setReferralChecked] = useState(false);
  const [owned, setOwned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [approvalHash, setApprovalHash] = useState<`0x${string}`>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setCampaignError("");
      if (!hasContractConfiguration() || !publicClient || campaignId === 0n) {
        setCampaign(undefined);
        setCampaignError(
          "Campaign setup is incomplete. Configure the contract address and campaign ID to enable checkout.",
        );
        setIsLoading(false);
        return;
      }
      try {
        const client = createViralKitClient({ publicClient });
        const record = (await client.getCampaign(campaignId)) as unknown as readonly [
          bigint,
          Address,
          Address,
          bigint,
          number,
          boolean,
          string,
        ];
        const [id, merchant, token, price, commissionBps, active, metadata] = record;
        if (id === 0n) throw new Error("This campaign ID has not been created on Monad Testnet.");
        const tokenAddress = token as Address;
        const [decimals, symbol] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          }) as Promise<number>,
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          }) as Promise<string>,
        ]);
        if (!cancelled) {
          setCampaign({ id, merchant, token: tokenAddress, price, commissionBps, active, metadata, decimals, symbol });
        }
      } catch (loadError) {
        if (!cancelled)
          setCampaignError(loadError instanceof Error ? loadError.message : "Could not load campaign details.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, publicClient]);

  useEffect(() => {
    let cancelled = false;
    setReferrer(undefined);
    setReferralChecked(!refCode);
    if (!refCode || !publicClient || !hasContractConfiguration()) return;
    async function resolve() {
      try {
        const client = createViralKitClient({ publicClient: publicClient! });
        const owner = (await client.resolveReferralCode(refCode)) as Address;
        if (!cancelled) setReferrer(owner === "0x0000000000000000000000000000000000000000" ? undefined : owner);
      } catch {
        if (!cancelled) setReferrer(undefined);
      } finally {
        if (!cancelled) setReferralChecked(true);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [publicClient, refCode]);

  useEffect(() => {
    let cancelled = false;
    async function loadPurchase() {
      if (!address || !publicClient || !campaign || !isConnected) {
        setOwned(false);
        return;
      }
      try {
        const client = createViralKitClient({ publicClient });
        const hasAccess = await client.hasPurchased(campaign.id, address);
        if (!cancelled) setOwned(hasAccess);
      } catch {
        if (!cancelled) setOwned(false);
      }
    }
    void loadPurchase();
    return () => {
      cancelled = true;
    };
  }, [address, campaign, isConnected, publicClient]);

  async function purchase() {
    if (!publicClient || !walletClient || !address || !campaign) {
      setError("Connect a wallet on Monad Testnet before purchasing.");
      return;
    }
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const client = createViralKitClient({ publicClient, walletClient });
      const hash = await client.purchaseWithReferral(campaign.id, referrer ? refCode : "", hash => {
        setApprovalHash(hash);
        setMessage("Payment token approval confirmed on Monad Testnet. Preparing your purchase…");
      });
      setTxHash(hash);
      setMessage("Purchase submitted. Waiting for Monad to confirm it…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("The purchase transaction reverted. Your access was not unlocked.");
      const hasAccess = await client.hasPurchased(campaign.id, address);
      if (!hasAccess)
        throw new Error(
          "The receipt confirmed, but purchase access could not be verified. Try refreshing in a moment.",
        );
      setOwned(true);
      setMessage("Purchase confirmed on Monad Testnet. This app can now grant access based on the onchain purchase.");
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "The purchase could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isWrongNetwork = isConnected && chainId !== MONAD_TESTNET_ID;
  const shareHref = `${kind === "newsletter" ? "/examples/newsletter" : kind === "event" ? "/examples/event" : `/checkout/${campaignIdValue}`}?ref=${encodeURIComponent(refCode)}`;

  return (
    <div className="product-layout">
      <article className="product-card">
        <div className={`product-art ${kind === "event" ? "event-art" : ""}`}>
          <span className="product-art-label">
            {kind === "newsletter"
              ? "VIRALKIT FIELD NOTES"
              : kind === "event"
                ? "MONAD COMMUNITY"
                : `CAMPAIGN ${campaignIdValue}`}
          </span>
          <span className="product-art-code" aria-hidden="true">
            {kind === "newsletter" ? "01" : kind === "event" ? "02" : campaignIdValue.slice(-2)}
          </span>
        </div>
        <span className="eyebrow">
          {kind === "newsletter"
            ? "Newsletter access · sample"
            : kind === "event"
              ? "Event pass · sample"
              : `Onchain campaign · #${campaignIdValue}`}
        </span>
        <h2>{kind === "campaign" && campaign?.metadata ? decodeCampaignMetadata(campaign.metadata).name : title}</h2>
        <p>{description}</p>
        <div className="product-meta">
          <span>One-time access</span>
          <strong>
            {campaign ? `${formatUnits(campaign.price, campaign.decimals)} ${campaign.symbol}` : "— payment token"}
          </strong>
        </div>

        {refCode && (
          <div className="notice referral-notice">
            {referralChecked && referrer ? (
              <span className="code-valid">
                Referral <span className="code-chip">{refCode}</span> resolves to {referrer.slice(0, 6)}…
                {referrer.slice(-4)}. It will be used in checkout.
              </span>
            ) : referralChecked ? (
              <span className="code-invalid">
                Referral code “{refCode}” is not registered. You can continue without a referral.
              </span>
            ) : (
              "Checking this referral on Monad…"
            )}
          </div>
        )}

        {isLoading ? (
          <div className="purchase-box" aria-live="polite">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ) : campaignError ? (
          <div className="notice" role="status">
            {campaignError}
          </div>
        ) : !campaign?.active ? (
          <div className="notice" role="status">
            This campaign is paused right now.
          </div>
        ) : owned ? (
          kind === "newsletter" ? (
            <div className="article-unlocked">
              <h3>Premium note · Shipping small, useful tools</h3>
              <p>
                Good infrastructure is quiet. It saves a team from rebuilding the same referral logic for every product,
                and it lets a trusted community carry one identity from app to app.
              </p>
            </div>
          ) : (
            <div className="pass-unlocked">
              <strong>Pass verified on Monad</strong>
              <p>Your wallet has an active purchase for this campaign.</p>
            </div>
          )
        ) : (
          <div className="purchase-box">
            {isWrongNetwork && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
                disabled={isSwitching}
              >
                {isSwitching ? "Switching…" : "Switch to Monad Testnet"}
              </button>
            )}
            {!isConnected && (
              <p className="purchase-state">Connect a wallet to check your balance and purchase access.</p>
            )}
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="inline-success" role="status">
                {message}
                {txHash && (
                  <>
                    {" "}
                    <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">
                      View purchase ↗
                    </a>
                  </>
                )}
                {approvalHash && !txHash && (
                  <>
                    {" "}
                    <a href={`${EXPLORER_URL}/tx/${approvalHash}`} target="_blank" rel="noreferrer">
                      View approval ↗
                    </a>
                  </>
                )}
              </div>
            )}
            {isConnected && walletClient && (
              <button
                className="button button-primary"
                type="button"
                onClick={purchase}
                disabled={isSubmitting || !referralChecked}
                aria-busy={isSubmitting}
              >
                {isSubmitting
                  ? "Confirming transaction…"
                  : `Pay ${formatUnits(campaign.price, campaign.decimals)} ${campaign.symbol}`}
              </button>
            )}
            {refCode && (
              <Link className="text-link" href={shareHref}>
                Share this referral link ↗
              </Link>
            )}
          </div>
        )}
      </article>

      <aside className="panel">
        <h2>How your purchase works</h2>
        <p className="panel-intro">A referral reward is paid only when the campaign contract confirms a purchase.</p>
        <ul className="card-list">
          <li>
            <span>Payment token</span>
            <strong>{campaign?.symbol ?? "—"}</strong>
          </li>
          <li>
            <span>Referral share</span>
            <strong>{campaign ? `${campaign.commissionBps / 100}%` : "—"}</strong>
          </li>
          <li>
            <span>Settlement</span>
            <strong>Atomic ERC-20 split</strong>
          </li>
          <li>
            <span>Network</span>
            <strong>Monad Testnet</strong>
          </li>
        </ul>
        <p className="source-note">
          Contract campaign #{campaignIdValue || "not configured"} · access is checked from onchain purchase state.
        </p>
      </aside>
    </div>
  );
}
