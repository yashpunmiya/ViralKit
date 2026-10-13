"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { type Address, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { ERC20_ABI, REFERRAL_HUB_ABI } from "~~/lib/viralkit/abi";
import {
  AUSD_ADDRESS,
  EXPLORER_URL,
  MONAD_TESTNET_ID,
  REFERRAL_HUB_ADDRESS,
  createViralKitClient,
  hasContractConfiguration,
} from "~~/lib/viralkit/client";
import { decodeCampaignMetadata, encodeCampaignMetadata } from "~~/lib/viralkit/metadata";

type Campaign = {
  id: bigint;
  merchant: Address;
  token: Address;
  price: bigint;
  commissionBps: number;
  active: boolean;
  metadata: string;
  decimals: number;
  symbol: string;
  sales: bigint;
  revenue: bigint;
};

export function DeveloperConsole() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const { data: walletClient } = useWalletClient({ chainId: MONAD_TESTNET_ID });
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState("10");
  const [paymentToken, setPaymentToken] = useState(AUSD_ADDRESS ?? "");
  const [commission, setCommission] = useState("20");
  const [campaignName, setCampaignName] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedCampaign, setCopiedCampaign] = useState("");
  const configured = hasContractConfiguration();

  useEffect(() => setOrigin(window.location.origin), []);

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !REFERRAL_HUB_ADDRESS) return;
    const hubAddress = REFERRAL_HUB_ADDRESS as Address;
    setLoading(true);
    try {
      const nextId = (await publicClient.readContract({
        address: hubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "nextCampaignId",
      })) as bigint;
      const end = Number(nextId - 1n);
      const rows = await Promise.all(
        Array.from({ length: end }, async (_, i) => {
          const result = (await publicClient.readContract({
            address: hubAddress,
            abi: REFERRAL_HUB_ABI,
            functionName: "campaigns",
            args: [BigInt(i + 1)],
          })) as unknown as readonly [bigint, Address, Address, bigint, number, boolean, string];
          const [id, merchant, token, campaignPrice, commissionBps, active, campaignMetadata] = result;
          const [decimals, symbol, sales, revenue] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
            publicClient.readContract({
              address: hubAddress,
              abi: REFERRAL_HUB_ABI,
              functionName: "campaignPurchaseCount",
              args: [BigInt(i + 1)],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: hubAddress,
              abi: REFERRAL_HUB_ABI,
              functionName: "campaignMerchantRevenue",
              args: [BigInt(i + 1)],
            }) as Promise<bigint>,
          ]);
          return {
            id,
            merchant,
            token,
            price: campaignPrice,
            commissionBps,
            active,
            metadata: campaignMetadata,
            decimals,
            symbol,
            sales,
            revenue,
          };
        }),
      );
      setCampaigns(rows.filter(campaign => campaign.merchant.toLowerCase() === address.toLowerCase()));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not load campaigns from Monad.");
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletClient || !publicClient || !REFERRAL_HUB_ADDRESS) {
      setError("Connect a Dynamic wallet and configure the ReferralHub before creating a campaign.");
      return;
    }
    if (!isAddress(paymentToken)) {
      setError("Enter a valid ERC-20 payment token address.");
      return;
    }
    if (chainId !== MONAD_TESTNET_ID) {
      setError("Switch to Monad Testnet before creating a campaign.");
      return;
    }
    setError("");
    setNotice("");
    setPending(true);
    try {
      const tokenAddress = paymentToken as Address;
      const [decimals, code] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }) as Promise<number>,
        publicClient.getCode({ address: tokenAddress }),
      ]);
      if (!code || code === "0x") throw new Error("The payment token address does not contain a deployed contract.");
      const hash = await createViralKitClient({ publicClient, walletClient }).createCampaign({
        token: tokenAddress,
        price: parseUnits(price, decimals),
        commissionBps: Math.round(Number(commission) * 100),
        metadata: encodeCampaignMetadata({ name: campaignName, description }),
      });
      setNotice(`Campaign submitted. Waiting for confirmation…`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Campaign creation reverted.");
      setNotice(`Campaign created. Transaction ${hash}`);
      setCampaignName("");
      setDescription("");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Campaign creation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Creator workspace</span>
        <h1>Campaigns for your product.</h1>
        <p>Set campaign terms once and use the checkout URL or ViralKit SDK to connect referrals to real purchases.</p>
      </div>
      {!configured && (
        <div className="notice">
          Set the ReferralHub and AUSD addresses in your local environment to enable campaign creation.
        </div>
      )}
      {!isConnected && (
        <div className="notice">
          Connect your Dynamic wallet to create campaigns and view campaigns owned by your address.
        </div>
      )}
      {chainId !== undefined && chainId !== MONAD_TESTNET_ID && (
        <div className="notice network-switch-notice">
          Your wallet is on a different network.{" "}
          <button
            className="text-link"
            type="button"
            onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching…" : "Switch to Monad Testnet"}
          </button>
        </div>
      )}
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="inline-success" role="status">
          {notice}
        </div>
      )}
      <div className="page-grid section">
        <section className="panel">
          <h2>Create a campaign</h2>
          <p className="panel-intro">
            Choose an ERC-20 on Monad Testnet. Price precision is read from the token contract.
          </p>
          <form className="form-stack" onSubmit={createCampaign}>
            <div className="field">
              <label htmlFor="campaign-token">Payment token contract</label>
              <input
                id="campaign-token"
                className="mono"
                value={paymentToken}
                onChange={e => setPaymentToken(e.target.value)}
                required
              />
              <p className="field-hint">
                Defaults to the configured AUSD test token. Token transfers must follow standard ERC-20 behavior.
              </p>
            </div>
            <div className="field">
              <label htmlFor="campaign-price">Price in selected token</label>
              <input
                id="campaign-price"
                type="number"
                min="0.000001"
                step="any"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="campaign-commission">Referral commission (%)</label>
              <input
                id="campaign-commission"
                type="number"
                min="0"
                max="25"
                step="0.1"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                required
              />
              <p className="field-hint">Contract maximum is 25%.</p>
            </div>
            <div className="field">
              <label htmlFor="campaign-name">Campaign name</label>
              <input
                id="campaign-name"
                maxLength={80}
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="Pro membership"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="campaign-metadata">Campaign description</label>
              <textarea
                id="campaign-metadata"
                maxLength={350}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does a customer receive?"
                required
              />
              <p className="field-hint">Name and description are stored in the campaign’s onchain metadata.</p>
            </div>
            <button
              className="button button-primary"
              type="submit"
              disabled={
                !configured || !isConnected || pending || (chainId !== undefined && chainId !== MONAD_TESTNET_ID)
              }
              aria-busy={pending}
            >
              {pending ? "Waiting for confirmation…" : "Create campaign"}
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Payment and contract</h2>
          <p className="panel-intro">
            Use these values in your separate app configuration. No campaign IDs are assumed.
          </p>
          <ul className="card-list">
            <li>
              <span>Network</span>
              <strong>Monad Testnet · 10143</strong>
            </li>
            <li>
              <span>ReferralHub</span>
              <strong className="mono">
                {REFERRAL_HUB_ADDRESS
                  ? `${REFERRAL_HUB_ADDRESS.slice(0, 8)}…${REFERRAL_HUB_ADDRESS.slice(-6)}`
                  : "Not configured"}
              </strong>
            </li>
            <li>
              <span>Selected payment token</span>
              <strong className="mono">
                {paymentToken ? `${paymentToken.slice(0, 8)}…${paymentToken.slice(-6)}` : "Not configured"}
              </strong>
            </li>
          </ul>
          <a className="text-link" href={`${EXPLORER_URL}`} target="_blank" rel="noreferrer">
            Open Monad explorer ↗
          </a>
        </section>
      </div>
      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Onchain configuration</span>
          <h2>Your campaigns</h2>
          <p>Campaign records are loaded from the contract and filtered by connected merchant wallet.</p>
        </div>
        {loading ? (
          <div className="skeleton-stack">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        ) : campaigns.length ? (
          <div className="demo-grid">
            {campaigns.map(c => (
              <article className="demo-card" key={c.id.toString()}>
                <div>
                  <div>
                    <span className="eyebrow">
                      Campaign #{c.id.toString()} · {c.active ? "Active" : "Paused"}
                    </span>
                    <h3>{decodeCampaignMetadata(c.metadata).name}</h3>
                    <p>
                      {c.commissionBps / 100}% referral commission · {c.sales.toString()} confirmed sales
                    </p>
                  </div>
                  <span className="demo-price">
                    {formatUnits(c.price, c.decimals)} {c.symbol}
                  </span>
                </div>
                <div className="campaign-card-actions">
                  <span className="source-note">
                    Merchant revenue: {formatUnits(c.revenue, c.decimals)} · Monad Testnet
                  </span>
                  <Link className="button button-secondary" href={`/checkout/${c.id.toString()}`}>
                    Open checkout
                  </Link>
                  <Link className="button button-quiet" href={`/creator/campaign/${c.id.toString()}`}>
                    Manage
                  </Link>
                  <button
                    className="button button-quiet"
                    type="button"
                    onClick={async () => {
                      const link = `${origin}/checkout/${c.id.toString()}`;
                      try {
                        await navigator.clipboard.writeText(link);
                        setCopiedCampaign(c.id.toString());
                        window.setTimeout(() => setCopiedCampaign(""), 1800);
                      } catch {
                        setError(
                          "Clipboard access was blocked. Open the checkout link and copy it from the address bar.",
                        );
                      }
                    }}
                  >
                    {copiedCampaign === c.id.toString() ? "Copied" : "Copy link"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="activity-empty">
            <strong>{isConnected ? "No campaigns found for this wallet" : "Connect to load campaigns"}</strong>
            <p>
              {isConnected
                ? "Campaigns created by this wallet will appear here after the contract confirms."
                : "Connect your wallet to load campaigns owned by your address."}
            </p>
          </div>
        )}
        <button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={loading}>
          Refresh campaigns
        </button>
      </section>
    </>
  );
}
