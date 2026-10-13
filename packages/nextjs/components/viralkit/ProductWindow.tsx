"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { type Address, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { ArrowPathIcon, ArrowUpRightIcon, ChartBarIcon, LinkIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { ERC20_ABI, REFERRAL_HUB_ABI } from "~~/lib/viralkit/abi";
import { MONAD_TESTNET_ID, REFERRAL_HUB_ADDRESS } from "~~/lib/viralkit/client";
import { decodeCampaignMetadata } from "~~/lib/viralkit/metadata";

type PreviewCampaign = {
  id: string;
  name: string;
  price: string;
  commission: string;
  token: string;
  active: boolean;
};

type PreviewState = "loading" | "ready" | "empty" | "error" | "unconfigured";

export function ProductWindow() {
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const [state, setState] = useState<PreviewState>("loading");
  const [campaigns, setCampaigns] = useState<PreviewCampaign[]>([]);
  const [count, setCount] = useState("—");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    const hubAddress = REFERRAL_HUB_ADDRESS;
    if (!publicClient || !hubAddress) {
      setState("unconfigured");
      return;
    }
    setState("loading");
    setError("");
    try {
      const nextId = (await publicClient.readContract({
        address: hubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "nextCampaignId",
      })) as bigint;
      const total = nextId > 0n ? nextId - 1n : 0n;
      setCount(total.toString());
      if (total === 0n) {
        setCampaigns([]);
        setState("empty");
        return;
      }

      const firstId = total > 3n ? total - 2n : 1n;
      const ids = Array.from({ length: Number(total - firstId + 1n) }, (_, index) => firstId + BigInt(index)).reverse();
      const rows = await Promise.all(
        ids.map(async id => {
          const result = (await publicClient.readContract({
            address: hubAddress,
            abi: REFERRAL_HUB_ABI,
            functionName: "campaigns",
            args: [id],
          })) as readonly [bigint, Address, Address, bigint, number, boolean, string];
          const [campaignId, , token, price, commissionBps, active, metadata] = result;
          if (campaignId === 0n) return undefined;
          const [symbol, decimals] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
          ]);
          return {
            id: campaignId.toString(),
            name: decodeCampaignMetadata(metadata).name || `Campaign #${campaignId}`,
            price: `${formatUnits(price, decimals)} ${symbol}`,
            commission: `${commissionBps / 100}%`,
            token: symbol,
            active,
          };
        }),
      );
      const visible = rows.filter((row): row is PreviewCampaign => Boolean(row));
      setCampaigns(visible);
      setState(visible.length ? "ready" : "empty");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the ReferralHub contract.");
      setState("error");
    }
  }, [publicClient]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return (
    <section className="product-window" aria-label="ViralKit campaign workspace preview">
      <div className="window-chrome">
        <div className="window-controls" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span className="window-title">
          ViralKit <span>/</span> Campaigns
        </span>
        <span className="window-network">
          <i aria-hidden="true" /> Monad Testnet
        </span>
      </div>
      <div className="workspace-preview">
        <aside className="preview-sidebar" aria-label="Workspace preview navigation">
          <div className="preview-workspace-mark">v</div>
          <div className="preview-workspace-name">
            <strong>Workspace</strong>
            <span>Monad Testnet</span>
          </div>
          <span className="preview-nav-label">PRODUCT</span>
          <Link className="preview-nav-item" href="/">
            <Squares2X2Icon aria-hidden="true" /> Overview
          </Link>
          <Link className="preview-nav-item preview-nav-active" href="/creator">
            <LinkIcon aria-hidden="true" /> Campaigns
          </Link>
          <Link className="preview-nav-item" href="/dashboard">
            <ChartBarIcon aria-hidden="true" /> Referrals
          </Link>
          <div className="preview-sidebar-bottom">
            <span className="sidebar-avatar">MN</span>
            <span>
              <strong>Monad Testnet</strong>
              <small>Contract-backed data</small>
            </span>
          </div>
        </aside>

        <div className="preview-main">
          <div className="preview-heading-row">
            <div>
              <span className="preview-overline">MERCHANT WORKSPACE</span>
              <h2>Campaigns</h2>
              <p>Referral offers deployed to the Monad Testnet contract.</p>
            </div>
            <Link className="button button-primary preview-create" href="/creator">
              Create campaign <ArrowUpRightIcon aria-hidden="true" />
            </Link>
          </div>
          <div className="preview-data-heading">
            <div>
              <strong>Recent campaigns</strong>
              <span>Loaded from ReferralHub</span>
            </div>
            <div className="preview-count">
              <span>ONCHAIN RECORDS</span>
              <strong>{count}</strong>
            </div>
          </div>
          <div className="preview-campaign-list" aria-live="polite" aria-busy={state === "loading"}>
            {state === "loading" && (
              <div className="preview-loading">
                <i />
                <i />
                <i />
              </div>
            )}
            {state === "ready" &&
              campaigns.map(campaign => (
                <Link className="preview-campaign-row" href={`/checkout/${campaign.id}`} key={campaign.id}>
                  <span className="campaign-row-icon">
                    <LinkIcon aria-hidden="true" />
                  </span>
                  <span className="campaign-row-name">
                    <strong>{campaign.name}</strong>
                    <small>
                      Campaign #{campaign.id} · {campaign.commission} referral share
                    </small>
                  </span>
                  <span className="campaign-row-price">
                    <strong>{campaign.price}</strong>
                    <small>{campaign.active ? "Active" : "Paused"}</small>
                  </span>
                  <ArrowUpRightIcon className="campaign-row-arrow" aria-hidden="true" />
                </Link>
              ))}
            {state === "empty" && (
              <div className="preview-empty">
                <strong>No campaigns yet</strong>
                <span>Create your first campaign to see its contract terms here.</span>
                <Link href="/creator">
                  Create campaign <ArrowUpRightIcon aria-hidden="true" />
                </Link>
              </div>
            )}
            {state === "unconfigured" && (
              <div className="preview-empty">
                <strong>Campaign data unavailable</strong>
                <span>The deployed ReferralHub is not configured in this environment.</span>
              </div>
            )}
            {state === "error" && (
              <div className="preview-empty">
                <strong>Could not load campaign data</strong>
                <span>{error}</span>
                <button type="button" onClick={() => setRefreshKey(key => key + 1)}>
                  <ArrowPathIcon aria-hidden="true" /> Try again
                </button>
              </div>
            )}
          </div>
          <div className="preview-footnote">
            <span>
              <i aria-hidden="true" /> Live contract data
            </span>
            <span>Prices and campaign terms are read from Monad Testnet.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
