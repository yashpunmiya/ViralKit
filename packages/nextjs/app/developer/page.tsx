import Link from "next/link";
import { CopyButton } from "~~/components/viralkit/CopyButton";
import { AUSD_ADDRESS, EXPLORER_URL, REFERRAL_HUB_ADDRESS, hasContractConfiguration } from "~~/lib/viralkit/client";

const setupCode = `// Local SDK source; not published to npm yet.\nimport { createViralKitClient } from "~~/lib/viralkit";\n\nconst viralKit = createViralKitClient({ publicClient, walletClient });`;
const checkoutCode = `const hash = await viralKit.purchaseWithReferral(campaignId, referralCode);\nconst receipt = await publicClient.waitForTransactionReceipt({ hash });\nif (receipt.status !== "success") throw new Error("Purchase failed");\nconst hasAccess = await viralKit.hasPurchased(campaignId, buyerAddress);`;

export const metadata = { title: "Developer workspace · ViralKit" };
export default function DeveloperPage() {
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Developer workspace</span>
        <h1>Referral rewards, built into checkout.</h1>
        <p>
          Integrate one shared referral identity across your app. The existing ViralKit client handles code resolution
          and ERC-20 approval plus purchase transactions.
        </p>
      </div>
      <section className="dev-summary">
        <div>
          <span className="eyebrow">Network</span>
          <strong>Monad Testnet · chain 10143</strong>
          <small>Test assets have no real-world value.</small>
        </div>
        <div>
          <span className="eyebrow">ReferralHub</span>
          <strong className="mono">{REFERRAL_HUB_ADDRESS ?? "Not configured"}</strong>
          <small>
            {hasContractConfiguration() ? "Configured in this environment" : "Contract configuration unavailable"}
          </small>
        </div>
        <div>
          <span className="eyebrow">Payment token</span>
          <strong className="mono">{AUSD_ADDRESS ?? "Not configured"}</strong>
          <small>AUSD test token</small>
        </div>
      </section>
      <div className="dev-grid section">
        <article className="panel">
          <span className="eyebrow">01 · Initialize</span>
          <h2>Connect the shared client.</h2>
          <p className="panel-intro">Pass the viem public client and connected wallet client from your app.</p>
          <pre className="code-block">
            <code>{setupCode}</code>
          </pre>
          <div className="copy-actions">
            <CopyButton value={setupCode} label="Copy snippet" />
            <Link className="text-link" href="/docs">
              Read SDK guide →
            </Link>
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">02 · Settle</span>
          <h2>Purchase with attribution.</h2>
          <p className="panel-intro">
            Referral codes resolve onchain. The contract splits payment only after a successful campaign purchase.
          </p>
          <pre className="code-block">
            <code>{checkoutCode}</code>
          </pre>
          <div className="copy-actions">
            <CopyButton value={checkoutCode} label="Copy snippet" />
            <a className="text-link" href={EXPLORER_URL} target="_blank" rel="noreferrer">
              Open Monad explorer ↗
            </a>
          </div>
        </article>
      </div>
      <section className="developer-next">
        <div>
          <span className="eyebrow">Campaign setup</span>
          <h2>Create a live campaign onchain.</h2>
          <p>Configure price, AUSD token, metadata, and referral share from the campaign workspace.</p>
        </div>
        <Link className="button button-primary" href="/creator">
          Open campaign workspace ↗
        </Link>
      </section>
      <section className="panel section">
        <h2>Referral identity</h2>
        <p className="panel-intro">
          A registered code can travel across your participating apps. Pass it as a `ref` query parameter in a share
          link, then submit it with the campaign purchase.
        </p>
        <pre className="code-block">
          <code>{`import { zeroAddress } from "viem";\n\nconst referrer = await viralKit.resolveReferralCode(referralCode);\nif (referrer !== zeroAddress) {\n  // Pass referralCode to purchaseWithReferral after user confirmation.\n}`}</code>
        </pre>
      </section>
    </>
  );
}
