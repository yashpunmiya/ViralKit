import Link from "next/link";
import { ArrowRightIcon, CheckBadgeIcon, CodeBracketIcon, LinkIcon } from "@heroicons/react/24/outline";
import { ProductWindow } from "~~/components/viralkit/ProductWindow";

const features = [
  {
    icon: LinkIcon,
    number: "01",
    title: "One identity across apps",
    description: "A referrer registers a code once and carries it to every participating campaign.",
  },
  {
    icon: CheckBadgeIcon,
    number: "02",
    title: "Rewards follow purchases",
    description: "The contract attributes a reward only when a purchase is confirmed onchain.",
  },
  {
    icon: CodeBracketIcon,
    number: "03",
    title: "Fits your checkout",
    description: "Use a ready campaign link or integrate referral registration and payment with the SDK.",
  },
];

const setup = [
  ["Create", "Connect a wallet and set your campaign terms."],
  ["Integrate", "Share the checkout URL or add the ViralKit SDK."],
  ["Measure", "Follow confirmed earnings in the creator and referrer workspaces."],
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <span className="landing-kicker">
          <i aria-hidden="true" /> REFERRAL INFRASTRUCTURE FOR MONAD
        </span>
        <h1>
          Turn word of mouth
          <br />
          <span>into onchain growth.</span>
        </h1>
        <p>
          One referral identity follows your users across apps. Reward real purchases with transparent, automatic
          payment splits.
        </p>
        <div className="landing-actions">
          <Link className="button button-primary landing-primary" href="/onboarding">
            Create a campaign <ArrowRightIcon aria-hidden="true" />
          </Link>
          <Link className="landing-secondary" href="/docs">
            Explore the SDK <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
        <div className="landing-trust">
          <span>
            <i aria-hidden="true" /> Monad Testnet
          </span>
          <span>Test assets have no real-world value</span>
        </div>
      </section>

      <ProductWindow />

      <section className="landing-features">
        <div className="landing-section-heading">
          <span className="landing-kicker">BUILT AROUND REAL CONVERSIONS</span>
          <h2>Referral growth, without the guesswork.</h2>
          <p>Every step is tied to wallet identity and contract state.</p>
        </div>
        <div className="feature-rail">
          {features.map(({ icon: Icon, number, title, description }) => (
            <article className="feature-item" key={number}>
              <div className="feature-item-top">
                <span className="feature-number">{number}</span>
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-setup">
        <div className="setup-heading">
          <span className="landing-kicker">A STRAIGHTFORWARD SETUP</span>
          <h2>
            From campaign
            <br />
            to confirmed reward.
          </h2>
          <Link href="/onboarding" className="text-link">
            Start your workspace <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
        <div className="setup-list">
          {setup.map(([title, description], index) => (
            <div className="setup-row" key={title}>
              <span className="setup-number">0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <ArrowRightIcon aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-kicker">READY WHEN YOU ARE</span>
          <h2>Start with one campaign.</h2>
          <p>Create a checkout flow on Monad Testnet and see how referrals settle.</p>
        </div>
        <Link href="/onboarding" className="button button-primary landing-primary">
          Get started <ArrowRightIcon aria-hidden="true" />
        </Link>
      </section>
      <p className="landing-disclaimer">
        ViralKit currently runs on Monad Testnet. MON and AUSD shown here are test assets, not real money.
      </p>
    </div>
  );
}
