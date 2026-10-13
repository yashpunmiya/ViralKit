import { notFound } from "next/navigation";
import { ProductCheckout } from "~~/components/viralkit/ProductCheckout";

export default async function CampaignCheckout({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(campaignId) || BigInt(campaignId) === 0n) notFound();
  const refCode = typeof query.ref === "string" ? query.ref.slice(0, 24) : "";
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Campaign checkout · Monad Testnet</span>
        <h1>Complete your purchase.</h1>
        <p>
          Campaign terms and payment details are loaded from the ViralKit contract. A purchase is final only after its
          transaction confirms.
        </p>
      </div>
      <ProductCheckout
        kind="campaign"
        campaignId={campaignId}
        refCode={refCode}
        title={`Campaign #${campaignId}`}
        description="Payment and access status are checked directly against the campaign contract."
      />
    </>
  );
}
