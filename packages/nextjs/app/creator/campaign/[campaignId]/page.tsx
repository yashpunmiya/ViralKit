"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type Address, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { ERC20_ABI, REFERRAL_HUB_ABI } from "~~/lib/viralkit/abi";
import { EXPLORER_URL, MONAD_TESTNET_ID, REFERRAL_HUB_ADDRESS, createViralKitClient } from "~~/lib/viralkit/client";
import { decodeCampaignMetadata, encodeCampaignMetadata } from "~~/lib/viralkit/metadata";

type PurchaseRow = {
  id: string;
  buyer: string;
  price: string;
  merchantAmount: string;
  referralAmount: string;
  transactionHash: string;
  blockNumber: string;
};

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const id = /^\d+$/.test(params.campaignId) ? BigInt(params.campaignId) : 0n;
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const { data: walletClient } = useWalletClient({ chainId: MONAD_TESTNET_ID });
  const [campaign, setCampaign] = useState<{
    merchant: Address;
    token: Address;
    price: bigint;
    bps: number;
    active: boolean;
    metadata: string;
    decimals: number;
    symbol: string;
  }>();
  const [sales, setSales] = useState<bigint>();
  const [revenue, setRevenue] = useState<bigint>();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [activityState, setActivityState] = useState<"loading" | "ready" | "empty" | "unconfigured" | "error">(
    "unconfigured",
  );
  const [activityError, setActivityError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const owner = Boolean(address && campaign && address.toLowerCase() === campaign.merchant.toLowerCase());
  const load = useCallback(async () => {
    if (!publicClient || !REFERRAL_HUB_ADDRESS) return;
    const client = createViralKitClient({ publicClient });
    const row = (await client.getCampaign(id)) as readonly [bigint, Address, Address, bigint, number, boolean, string];
    if (row[0] === 0n) throw new Error("This campaign does not exist on Monad Testnet.");
    const [decimals, symbol, count, total] = await Promise.all([
      publicClient.readContract({ address: row[2], abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      publicClient.readContract({ address: row[2], abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
      publicClient.readContract({
        address: REFERRAL_HUB_ADDRESS,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaignPurchaseCount",
        args: [id],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: REFERRAL_HUB_ADDRESS,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaignMerchantRevenue",
        args: [id],
      }) as Promise<bigint>,
    ]);
    setCampaign({
      merchant: row[1],
      token: row[2],
      price: row[3],
      bps: row[4],
      active: row[5],
      metadata: row[6],
      decimals,
      symbol,
    });
    setSales(count);
    setRevenue(total);
    const meta = decodeCampaignMetadata(row[6]);
    setName(meta.name);
    setDescription(meta.description);
    setPrice(formatUnits(row[3], decimals));
    setTokenAddress(row[2]);
    setCommission(String(row[4] / 100));
  }, [id, publicClient]);
  useEffect(() => {
    void load().catch(e => setError(e instanceof Error ? e.message : "Could not load campaign."));
  }, [load]);
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL;
    if (!endpoint) {
      setActivityState("unconfigured");
      return;
    }
    let cancelled = false;
    setActivityState("loading");
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        query:
          "query CampaignPurchases($campaignId: String!) { Purchase(where: { campaignId: { _eq: $campaignId } }, limit: 25, order_by: { blockNumber: desc }) { id buyer price merchantAmount referralAmount transactionHash blockNumber } }",
        variables: { campaignId: params.campaignId },
      }),
    })
      .then(async response => {
        if (!response.ok) throw new Error(`Envio returned HTTP ${response.status}.`);
        const result = await response.json();
        if (result.errors?.length) throw new Error(result.errors[0].message ?? "Envio query failed.");
        const rows = (result.data?.Purchase ?? []) as PurchaseRow[];
        if (!cancelled) {
          setPurchases(rows);
          setActivityState(rows.length ? "ready" : "empty");
        }
      })
      .catch(e => {
        if (!cancelled) {
          setActivityError(e instanceof Error ? e.message : "Could not reach Envio.");
          setActivityState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.campaignId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!campaign || !walletClient || !publicClient || !REFERRAL_HUB_ADDRESS) {
      setError("Connect the merchant wallet on Monad Testnet.");
      return;
    }
    if (!owner) {
      setError("Only the merchant wallet that created this campaign can manage it.");
      return;
    }
    if (chainId !== MONAD_TESTNET_ID) {
      setError("Switch to Monad Testnet before signing.");
      return;
    }
    setPending(true);
    try {
      if (!isAddress(tokenAddress)) throw new Error("Enter a valid ERC-20 payment token address.");
      if ((sales ?? 0n) > 0n && tokenAddress.toLowerCase() !== campaign.token.toLowerCase()) {
        throw new Error(
          "Payment token cannot be changed after the first sale because the onchain revenue total uses one token unit.",
        );
      }
      const [tokenCode, tokenDecimals] = await Promise.all([
        publicClient.getCode({ address: tokenAddress }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }) as Promise<number>,
      ]);
      if (!tokenCode || tokenCode === "0x") throw new Error("The payment token address is not a deployed contract.");
      const hash = await createViralKitClient({ publicClient, walletClient }).updateCampaign(id, {
        token: tokenAddress,
        price: parseUnits(price, tokenDecimals),
        commissionBps: Math.round(Number(commission) * 100),
        active: campaign.active,
        metadata: encodeCampaignMetadata({ name, description }),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Campaign update reverted.");
      setStatus(`Campaign updated · ${hash}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  async function toggleActive() {
    if (!campaign || !publicClient || !owner) {
      setError("Connect the merchant wallet that created this campaign.");
      return;
    }
    if (chainId !== MONAD_TESTNET_ID || !walletClient) {
      setError("Switch to Monad Testnet before changing campaign status.");
      return;
    }
    setError("");
    setStatus("");
    setPending(true);
    try {
      const hash = await createViralKitClient({ publicClient, walletClient }).updateCampaign(id, {
        token: campaign.token,
        price: campaign.price,
        commissionBps: campaign.bps,
        active: !campaign.active,
        metadata: campaign.metadata,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Campaign status update reverted.");
      setStatus(`Campaign ${campaign.active ? "paused" : "published"} · ${hash}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Campaign #{params.campaignId}</span>
        <h1>{campaign ? decodeCampaignMetadata(campaign.metadata).name : "Campaign details"}</h1>
        <p>Onchain sales and management · Monad Testnet</p>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {status && (
        <div className="inline-success" role="status">
          {status}
        </div>
      )}
      {campaign && (
        <>
          <section className="stat-grid section">
            <div className="stat-card">
              <span>Confirmed purchases</span>
              <strong>{sales?.toString() ?? "—"}</strong>
            </div>
            <div className="stat-card">
              <span>Merchant revenue</span>
              <strong>
                {revenue === undefined ? "—" : `${formatUnits(revenue, campaign.decimals)} ${campaign.symbol}`}
              </strong>
            </div>
            <div className="stat-card">
              <span>Status</span>
              <strong>{campaign.active ? "Published" : "Paused"}</strong>
            </div>
          </section>
          <section className="panel section">
            <p className="panel-intro">
              Merchant wallet: <span className="mono">{campaign.merchant}</span> · {campaign.bps / 100}% referral share
            </p>
            <div className="campaign-card-actions">
              <Link className="button button-secondary" href={`/checkout/${params.campaignId}`}>
                View checkout
              </Link>
              <a
                className="text-link"
                href={`${EXPLORER_URL}/address/${REFERRAL_HUB_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                View contract on explorer ↗
              </a>
            </div>
          </section>
          <section className="section">
            <div className="section-heading">
              <span className="eyebrow">Envio indexed activity</span>
              <h2>Recent purchases</h2>
              <p>Confirmed purchase events may take time to appear in the index.</p>
            </div>
            {activityState === "loading" && (
              <div className="skeleton-stack">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            )}
            {activityState === "unconfigured" && (
              <div className="activity-empty">
                <strong>Purchase history unavailable</strong>
                <p>Configure NEXT_PUBLIC_ENVIO_GRAPHQL_URL to load indexed events.</p>
              </div>
            )}
            {activityState === "error" && (
              <div className="inline-error" role="alert">
                Envio activity unavailable: {activityError}
              </div>
            )}
            {activityState === "empty" && (
              <div className="activity-empty">
                <strong>No indexed purchases yet</strong>
                <p>Confirmed purchases will appear here after Envio processes them.</p>
              </div>
            )}
            {activityState === "ready" && (
              <div className="panel activity-table-wrap">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th>Merchant received</th>
                      <th>Referral share</th>
                      <th>Block</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(row => (
                      <tr key={row.id}>
                        <td className="mono">
                          {row.buyer.slice(0, 6)}…{row.buyer.slice(-4)}
                        </td>
                        <td>
                          {formatUnits(BigInt(row.merchantAmount), campaign.decimals)} {campaign.symbol}
                        </td>
                        <td>
                          {formatUnits(BigInt(row.referralAmount), campaign.decimals)} {campaign.symbol}
                        </td>
                        <td>{row.blockNumber}</td>
                        <td>
                          <a
                            className="text-link"
                            href={`${EXPLORER_URL}/tx/${row.transactionHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {owner ? (
            <form className="panel form-stack section" onSubmit={save}>
              <h2>Manage campaign</h2>
              {chainId !== MONAD_TESTNET_ID && (
                <div className="notice network-switch-notice">
                  Switch to Monad Testnet before saving changes or changing campaign status.{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
                    disabled={isSwitching}
                  >
                    {isSwitching ? "Switching…" : "Switch network"}
                  </button>
                </div>
              )}
              <div className="field">
                <label htmlFor="manage-name">Name</label>
                <input id="manage-name" value={name} onChange={e => setName(e.target.value)} required maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="manage-description">Description</label>
                <textarea
                  id="manage-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  maxLength={350}
                />
              </div>
              <div className="field">
                <label htmlFor="manage-token">Payment token contract</label>
                <input
                  id="manage-token"
                  className="mono"
                  value={tokenAddress}
                  onChange={e => setTokenAddress(e.target.value)}
                  disabled={(sales ?? 0n) > 0n}
                  required
                />
                <p className="field-hint">
                  {(sales ?? 0n) > 0n
                    ? "Locked after the first sale to keep revenue totals denominated consistently."
                    : "ERC-20 token on Monad Testnet."}
                </p>
              </div>
              <div className="field">
                <label htmlFor="manage-price">Price ({campaign.symbol})</label>
                <input
                  id="manage-price"
                  type="number"
                  min="0.000001"
                  step="any"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="manage-commission">Referral commission (%)</label>
                <input
                  id="manage-commission"
                  type="number"
                  min="0"
                  max="25"
                  step="0.1"
                  value={commission}
                  onChange={e => setCommission(e.target.value)}
                  required
                />
              </div>
              <div className="campaign-card-actions">
                <button className="button button-primary" type="submit" disabled={pending}>
                  {pending ? "Waiting for confirmation…" : "Save changes"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => void toggleActive()}
                  disabled={pending}
                >
                  {campaign.active ? "Pause campaign" : "Publish campaign"}
                </button>
              </div>
            </form>
          ) : (
            <div className="activity-empty">
              <strong>Merchant access required</strong>
              <p>Connect the wallet that created this campaign to edit or pause it.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
