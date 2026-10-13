import Link from "next/link";

export const metadata = { title: "Examples · ViralKit" };
export default function ExamplesPage() {
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Example integrations</span>
        <h1>See ViralKit in a checkout.</h1>
        <p>
          These sample newsletter and event flows use the same SDK and onchain campaigns. Campaign availability and
          pricing are read from Monad Testnet.
        </p>
      </div>
      <div className="demo-grid section">
        <Link className="integration-card" href="/examples/newsletter">
          <span className="eyebrow">Sample integration · membership</span>
          <h2>Newsletter access</h2>
          <p>One-time checkout with wallet-verified access after a confirmed purchase.</p>
          <span className="text-link">Open example →</span>
        </Link>
        <Link className="integration-card" href="/examples/event">
          <span className="eyebrow">Sample integration · ticketing</span>
          <h2>Event pass</h2>
          <p>Separate campaign settings with the same cross-app referral identity.</p>
          <span className="text-link">Open example →</span>
        </Link>
      </div>
    </>
  );
}
