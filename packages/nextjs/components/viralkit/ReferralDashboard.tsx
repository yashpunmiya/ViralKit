"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { type Address, formatUnits } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { ERC20_ABI, REFERRAL_HUB_ABI } from "~~/lib/viralkit/abi";
import {
  EXPLORER_URL,
  MONAD_TESTNET_ID,
  REFERRAL_HUB_ADDRESS,
  createViralKitClient,
  hasContractConfiguration,
} from "~~/lib/viralkit/client";
import { generateCampaignReferralLink } from "~~/lib/viralkit/links";
import { decodeCampaignMetadata } from "~~/lib/viralkit/metadata";

type PurchaseActivity = {
  id: string;
  campaignId: string;
  buyer: string;
  price: string;
  referralAmount: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
};

export function ReferralDashboard() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: MONAD_TESTNET_ID });
  const { data: walletClient } = useWalletClient({ chainId: MONAD_TESTNET_ID });
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [code, setCode] = useState("");
  const [registeredCode, setRegisteredCode] = useState("");
  const [earningsByToken, setEarningsByToken] = useState<Array<{ amount: bigint; symbol: string; decimals: number }>>(
    [],
  );
  const [referralCount, setReferralCount] = useState<bigint>();
  const [campaignEarnings, setCampaignEarnings] = useState<
    Array<{ name: string; id: string; amount: bigint; symbol: string; decimals: number }>
  >([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<
    Array<{
      id: string;
      merchant: Address;
      token: Address;
      price: bigint;
      commissionBps: number;
      active: boolean;
      name: string;
      description: string;
      symbol: string;
      decimals: number;
    }>
  >([]);
  const [activity, setActivity] = useState<PurchaseActivity[]>([]);
  const [indexerState, setIndexerState] = useState<"unconfigured" | "loading" | "ready" | "empty" | "error">(
    "unconfigured",
  );
  const [indexerError, setIndexerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCampaign, setCopiedCampaign] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [indexerRetry, setIndexerRetry] = useState(0);
  const envioUrl = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL;

  useEffect(() => setOrigin(window.location.origin), []);

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !hasContractConfiguration()) return;
    setIsLoading(true);
    setError("");
    try {
      const [userCode, referredPurchases, nextId] = (await Promise.all([
        publicClient.readContract({
          address: REFERRAL_HUB_ADDRESS!,
          abi: REFERRAL_HUB_ABI,
          functionName: "referralCodeByReferrer",
          args: [address],
        }),
        publicClient.readContract({
          address: REFERRAL_HUB_ADDRESS!,
          abi: REFERRAL_HUB_ABI,
          functionName: "referralPurchaseCount",
          args: [address],
        }),
        publicClient.readContract({
          address: REFERRAL_HUB_ADDRESS!,
          abi: REFERRAL_HUB_ABI,
          functionName: "nextCampaignId",
        }) as Promise<bigint>,
      ])) as unknown as [string, bigint, bigint];
      const ids = Array.from({ length: Number(nextId > 1n ? nextId - 1n : 0n) }, (_, index) => BigInt(index + 1));
      const campaignRows = await Promise.all(
        ids.map(async campaignId => {
          const [campaign, amount] = await Promise.all([
            publicClient.readContract({
              address: REFERRAL_HUB_ADDRESS!,
              abi: REFERRAL_HUB_ABI,
              functionName: "campaigns",
              args: [campaignId],
            }) as Promise<readonly [bigint, Address, Address, bigint, number, boolean, string]>,
            publicClient.readContract({
              address: REFERRAL_HUB_ADDRESS!,
              abi: REFERRAL_HUB_ABI,
              functionName: "campaignReferralEarnings",
              args: [campaignId, address],
            }) as Promise<bigint>,
          ]);
          const [id, merchant, token, price, commissionBps, active, metadata] = campaign;
          const [symbol, tokenDecimals] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
            publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
          ]);
          const decoded = decodeCampaignMetadata(metadata);
          return {
            id: id.toString(),
            merchant,
            token,
            price,
            commissionBps,
            active,
            name: decoded.name,
            description: decoded.description,
            symbol,
            decimals: tokenDecimals,
            amount,
          };
        }),
      );
      setRegisteredCode(userCode);
      setReferralCount(referredPurchases);
      setAvailableCampaigns(campaignRows);
      setCampaignEarnings(
        campaignRows
          .filter(row => row.amount > 0n)
          .map(({ name, id, amount, symbol, decimals }) => ({ name, id, amount, symbol, decimals })),
      );
      const totals = new Map<string, { amount: bigint; symbol: string; decimals: number }>();
      for (const row of campaignRows) {
        const existing = totals.get(row.token.toLowerCase()) ?? {
          amount: 0n,
          symbol: row.symbol,
          decimals: row.decimals,
        };
        existing.amount += row.amount;
        totals.set(row.token.toLowerCase(), existing);
      }
      setEarningsByToken([...totals.values()].filter(value => value.amount > 0n));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not read your referral data from Monad.");
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivity() {
      if (!envioUrl || !address || !publicClient) {
        setActivity([]);
        setIndexerState("unconfigured");
        return;
      }
      setIndexerState("loading");
      setIndexerError("");
      try {
        const response = await fetch(envioUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `query ReferralPurchases($referrer: String!) { Purchase(where: { referrer: { _eq: $referrer } }, limit: 50, order_by: { blockNumber: desc }) { id campaignId buyer price referralAmount token transactionHash blockNumber blockTimestamp } }`,
            variables: { referrer: address.toLowerCase() },
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`Indexer returned HTTP ${response.status}.`);
        const result = await response.json();
        if (result.errors?.length) throw new Error(result.errors[0].message ?? "The Envio query failed.");
        const rows = await Promise.all(
          ((result.data?.Purchase ?? []) as PurchaseActivity[]).map(async row => {
            const token = row.token as Address;
            const [tokenSymbol, tokenDecimals] = await Promise.all([
              publicClient!.readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
              publicClient!.readContract({
                address: token,
                abi: ERC20_ABI,
                functionName: "decimals",
              }) as Promise<number>,
            ]);
            return { ...row, tokenSymbol, tokenDecimals };
          }),
        );
        if (!cancelled) {
          setActivity(rows);
          setIndexerState(rows.length ? "ready" : "empty");
        }
      } catch (loadError) {
        if (!cancelled) {
          setIndexerState("error");
          setIndexerError(loadError instanceof Error ? loadError.message : "Could not reach Envio.");
        }
      }
    }
    void loadActivity();
    return () => {
      cancelled = true;
    };
  }, [address, envioUrl, indexerRetry, publicClient]);

  async function registerCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publicClient || !walletClient) {
      setError("Connect a Dynamic wallet to register your referral code.");
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,24}$/.test(normalized)) {
      setError("Use 3–24 letters or numbers, with no spaces or symbols.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const client = createViralKitClient({ publicClient, walletClient });
      const hash = await client.registerReferralCode(normalized);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Referral registration reverted on Monad Testnet.");
      setSuccess(`Referral code ${normalized} is registered on Monad.`);
      setCode("");
      await refresh();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "The referral code could not be registered.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyLink(campaignId: string) {
    if (!registeredCode || !origin) return;
    try {
      await navigator.clipboard.writeText(generateCampaignReferralLink(origin, campaignId, registeredCode));
      setCopiedCampaign(campaignId);
      window.setTimeout(() => setCopiedCampaign(""), 1800);
    } catch {
      setError("Clipboard access was blocked. Select and copy the links below.");
    }
  }

  const configMissing = !hasContractConfiguration();

  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Referral dashboard</span>
        <h1>Your identity, across apps.</h1>
        <p>
          Register once, share across campaigns and see confirmed earnings from the contract alongside the Envio-indexed
          purchase history.
        </p>
      </div>

      {!isConnected && (
        <div className="notice">Connect with Dynamic to register your code and read your onchain earnings.</div>
      )}
      {isConnected && chainId !== MONAD_TESTNET_ID && (
        <div className="notice network-switch-notice">
          Switch your wallet to Monad Testnet before registering a referral code.{" "}
          <button
            className="text-link"
            type="button"
            onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
            disabled={isSwitching}
          >
            {isSwitching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}
      {configMissing && (
        <div className="notice">
          Set the ReferralHub and AUSD contract addresses to load live data. No sample activity is shown here.
        </div>
      )}
      {error && (
        <div className="inline-error" role="alert">
          {error}{" "}
          <button type="button" className="text-link" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <section className="section">
        <div className="stat-grid">
          <div className="stat-card">
            <span>Total referral earnings</span>
            <strong>
              {isLoading
                ? "—"
                : earningsByToken.length
                  ? earningsByToken
                      .map(value => `${formatUnits(value.amount, value.decimals)} ${value.symbol}`)
                      .join(" · ")
                  : "0"}
            </strong>
          </div>
          <div className="stat-card">
            <span>Purchases referred</span>
            <strong>{referralCount === undefined ? "—" : referralCount.toString()}</strong>
          </div>
          <div className="stat-card">
            <span>Shared identity</span>
            <strong>{registeredCode || "Not registered"}</strong>
          </div>
        </div>
      </section>

      <div className="page-grid">
        <section className="panel">
          <h2>Referral earnings by campaign</h2>
          <p className="panel-intro">These totals are read directly from ReferralHub in token base units.</p>
          {isLoading ? (
            <div className="skeleton-stack" aria-label="Loading onchain earnings">
              <div className="skeleton-line" />
              <div className="skeleton-line" />
            </div>
          ) : campaignEarnings.length ? (
            <ul className="card-list earnings-list">
              {campaignEarnings.map(campaign => (
                <li key={campaign.id}>
                  <span>
                    {campaign.name} · campaign #{campaign.id}
                  </span>
                  <strong>
                    {formatUnits(campaign.amount, campaign.decimals)} {campaign.symbol}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <div className="activity-empty">
              <strong>No earnings yet</strong>
              <p>When a buyer completes a referred purchase, the contract records the commission here.</p>
            </div>
          )}
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            Refresh onchain totals
          </button>
        </section>

        <section className="panel">
          <h2>Your referral code</h2>
          <p className="panel-intro">
            One wallet can register one permanent code. The contract owns the code-to-wallet mapping.
          </p>
          {registeredCode ? (
            <div className="form-stack">
              <div className="code-chip">{registeredCode}</div>
              <p className="panel-intro">
                Your code works across active ViralKit campaigns. Choose a campaign below to create its link.
              </p>
            </div>
          ) : isConnected ? (
            <form className="form-stack" onSubmit={registerCode}>
              <div className="field">
                <label htmlFor="referral-code">
                  Choose a referral code <span aria-hidden="true">*</span>
                </label>
                <input
                  id="referral-code"
                  name="referral-code"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={24}
                  minLength={3}
                  value={code}
                  onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  aria-describedby="referral-code-hint"
                  aria-invalid={Boolean(error) || undefined}
                />
                <p id="referral-code-hint" className="field-hint">
                  3–24 letters or numbers. Registration is permanent for this wallet.
                </p>
              </div>
              {success && (
                <div className="inline-success" role="status">
                  {success}
                </div>
              )}
              <button
                className="button button-primary"
                type="submit"
                disabled={isSubmitting || !code.trim() || chainId !== MONAD_TESTNET_ID}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? "Waiting for confirmation…" : "Register referral code"}
              </button>
            </form>
          ) : (
            <div className="activity-empty">
              <strong>Connect to get started</strong>
              <p>Your referral code is stored onchain and can be resolved by any app.</p>
            </div>
          )}
        </section>
      </div>
      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Campaign discovery</span>
          <h2>Promote a live offer.</h2>
          <p>Campaign terms are read from the deployed contract. Only active campaigns can be purchased.</p>
        </div>
        {availableCampaigns.filter(item => item.active).length ? (
          <div className="demo-grid">
            {availableCampaigns
              .filter(item => item.active)
              .map(item => (
                <article className="demo-card" key={item.id}>
                  <span className="eyebrow">
                    Campaign #{item.id} · {item.commissionBps / 100}% referral share
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <strong className="demo-price">
                    {formatUnits(item.price, item.decimals)} {item.symbol}
                  </strong>
                  {registeredCode && (
                    <>
                      <div className="field">
                        <label htmlFor={`link-${item.id}`}>Your campaign link</label>
                        <input
                          id={`link-${item.id}`}
                          readOnly
                          value={origin ? generateCampaignReferralLink(origin, item.id, registeredCode) : ""}
                        />
                      </div>
                      <div className="campaign-card-actions">
                        <Link
                          className="button button-secondary"
                          href={`/checkout/${item.id}?ref=${encodeURIComponent(registeredCode)}`}
                        >
                          Preview offer
                        </Link>
                        <button className="button button-primary" type="button" onClick={() => void copyLink(item.id)}>
                          {copiedCampaign === item.id ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
          </div>
        ) : (
          <div className="activity-empty">
            <strong>No active campaigns are available</strong>
            <p>Active merchant campaigns will appear here when they are published on Monad Testnet.</p>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Envio HyperIndex</span>
          <h2>Confirmed referral activity.</h2>
          <p>
            Purchases below come from the configured Envio GraphQL endpoint. Indexing can lag behind chain confirmation.
          </p>
        </div>
        {indexerState === "unconfigured" && (
          <div className="activity-empty">
            <strong>Envio isn’t configured</strong>
            <p>
              Add NEXT_PUBLIC_ENVIO_GRAPHQL_URL to show indexed purchases. Onchain totals above remain live contract
              reads.
            </p>
          </div>
        )}
        {indexerState === "loading" && (
          <div className="skeleton-stack" aria-label="Loading Envio purchase activity">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        )}
        {indexerState === "empty" && (
          <div className="activity-empty">
            <strong>No indexed purchases yet</strong>
            <p>After a purchase is confirmed, allow the Envio indexer time to process its event.</p>
          </div>
        )}
        {indexerState === "error" && (
          <div className="inline-error" role="alert">
            Couldn’t load Envio activity: {indexerError}{" "}
            <button className="text-link" type="button" onClick={() => setIndexerRetry(value => value + 1)}>
              Retry
            </button>
          </div>
        )}
        {indexerState === "ready" && (
          <div className="panel activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Buyer</th>
                  <th>Referral reward</th>
                  <th>Block</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(row => (
                  <tr key={row.id}>
                    <td>#{row.campaignId}</td>
                    <td className="mono">
                      {row.buyer.slice(0, 6)}…{row.buyer.slice(-4)}
                    </td>
                    <td>
                      {formatUnits(BigInt(row.referralAmount), row.tokenDecimals)} {row.tokenSymbol}
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
      <p className="source-note">
        Need integration examples? See{" "}
        <Link className="text-link" href="/examples">
          the examples
        </Link>
        .
      </p>
    </>
  );
}
