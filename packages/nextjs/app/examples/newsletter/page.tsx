import { ProductCheckout } from "~~/components/viralkit/ProductCheckout";

export const metadata = { title: "Newsletter example · ViralKit" };
export default async function NewsletterExample({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 24) : "";
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Example integration · membership</span>
        <h1>ViralKit Field Notes</h1>
        <p>
          A sample membership checkout powered by a reusable referral identity. Access unlocks only after the contract
          confirms your purchase.
        </p>
      </div>
      <ProductCheckout
        kind="newsletter"
        campaignId={process.env.NEXT_PUBLIC_NEWSLETTER_CAMPAIGN_ID ?? ""}
        refCode={ref}
        title="Practical notes for shipping onchain products"
        description="A concise monthly field note on payment UX, composable growth and small engineering decisions that make products easier to trust."
      />
    </>
  );
}
