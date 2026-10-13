import Link from "next/link";

export const metadata = { title: "Documentation · ViralKit" };
export default function DocsPage() {
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Documentation · viem SDK</span>
        <h1>Ship referrals with your checkout.</h1>
        <p>
          Use the deployed ReferralHub to register a referral identity, create campaigns, and settle purchases with
          attribution.
        </p>
      </div>
      <div className="docs-layout">
        <nav className="docs-nav" aria-label="Documentation sections">
          <a href="#client">Initialize</a>
          <a href="#identity">Referral identity</a>
          <a href="#campaign">Create campaign</a>
          <a href="#purchase">Purchase and verify</a>
          <a href="#analytics">Read activity</a>
          <a href="#network">Network and contracts</a>
        </nav>
        <div className="docs-content">
          <section id="client">
            <h2>Initialize the client</h2>
            <p>
              Create the SDK client with your existing viem clients. The wallet client is required for signed
              transactions; public reads work without it.
            </p>
            <pre>
              <code>{`// This repository exposes a local SDK module. It is not published to npm.\nimport { createViralKitClient, ERC20_ABI, encodeCampaignMetadata } from "~~/lib/viralkit";\nimport { parseUnits, zeroAddress } from "viem";\n\nconst viralKit = createViralKitClient({ publicClient, walletClient });`}</code>
            </pre>
          </section>
          <section id="identity">
            <h2>Register a referral identity and create a link</h2>
            <p>
              Registration is a wallet-signed, permanent onchain action. Campaign links preserve the same code across
              apps.
            </p>
            <pre>
              <code>{`const registrationHash = await viralKit.registerReferralCode("ALICE");\nconst registrationReceipt = await publicClient.waitForTransactionReceipt({ hash: registrationHash });\nif (registrationReceipt.status !== "success") throw new Error("Registration failed");\n\nconst referralLink = viralKit.generateCampaignReferralLink(window.location.origin, campaignId, "ALICE");`}</code>
            </pre>
          </section>
          <section id="campaign">
            <h2>Create a campaign</h2>
            <p>
              Campaign settings are written onchain by the connected merchant. Read token decimals before converting a
              human-readable price.
            </p>
            <pre>
              <code>{`const decimals = await publicClient.readContract({\n  address: ausdAddress, abi: ERC20_ABI, functionName: "decimals",\n});\nconst hash = await viralKit.createCampaign({\n  token: ausdAddress, price: parseUnits("10", decimals),\n  commissionBps: 2_000,\n  metadata: encodeCampaignMetadata({ name: "Pro plan", description: "Full access" }),\n});\nconst receipt = await publicClient.waitForTransactionReceipt({ hash });\nif (receipt.status !== "success") throw new Error("Campaign creation failed");`}</code>
            </pre>
          </section>
          <section id="analytics">
            <h2>Read real campaign activity</h2>
            <p>
              Onchain aggregates and event logs are scoped to one campaign so each amount uses that campaign’s token and
              decimals.
            </p>
            <pre>
              <code>{`const [sales, merchantRevenue, referralEarnings, purchaseEvents] = await Promise.all([\n  viralKit.getCampaignSales(campaignId),\n  viralKit.getCampaignMerchantRevenue(campaignId),\n  viralKit.getCampaignReferralEarnings(campaignId, referrerAddress),\n  viralKit.getCampaignPurchaseEvents(campaignId, deploymentBlock),\n]);`}</code>
            </pre>
          </section>
          <section id="purchase">
            <h2>Resolve and purchase</h2>
            <p>
              Resolve the code for display and submit it with the checkout. The SDK checks allowance and balance,
              requests approval when required, then returns the purchase transaction hash.
            </p>
            <pre>
              <code>{`const referrer = await viralKit.resolveReferralCode(referralCode);\nconst referral = referrer === zeroAddress ? "" : referralCode;\nconst hash = await viralKit.purchaseWithReferral(campaignId, referral);\nconst receipt = await publicClient.waitForTransactionReceipt({ hash });\nif (receipt.status !== "success") throw new Error("Purchase failed");\nconst hasAccess = await viralKit.hasPurchased(campaignId, buyerAddress);\nif (hasAccess) {\n  // Your application may now grant its own product access.\n}`}</code>
            </pre>
            <p>
              Verify purchase access using <code>hasPurchased(campaignId, buyerAddress)</code>. ViralKit does not
              deliver a separate digital product.
            </p>
          </section>
          <section id="network">
            <h2>Network and contracts</h2>
            <p>
              ViralKit currently targets Monad Testnet (chain ID 10143). Payments and balances shown in this environment
              use test assets with no real-world value. The deployed ReferralHub and AUSD token addresses are provided
              to the app through public environment configuration.
            </p>
            <p>
              For a campaign link, use <code>/checkout/&#123;campaignId&#125;</code>. Add a referral code as the `ref`
              query parameter.
            </p>
          </section>
        </div>
      </div>
      <div className="hero-actions">
        <Link className="button button-primary" href="/creator">
          Create a campaign
        </Link>
        <Link className="button button-secondary" href="/developer">
          Open developer workspace
        </Link>
      </div>
    </>
  );
}
