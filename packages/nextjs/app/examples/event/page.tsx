import { ProductCheckout } from "~~/components/viralkit/ProductCheckout";

export const metadata = { title: "Event example · ViralKit" };
export default async function EventExample({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const params = await searchParams;
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 24) : "";
  return (
    <>
      <div className="page-top">
        <span className="eyebrow">Example integration · ticketing</span>
        <h1>Monad Community Night</h1>
        <p>
          A separate event campaign uses the same shared referral identity. A confirmed purchase creates a
          wallet-verified pass.
        </p>
      </div>
      <ProductCheckout
        kind="event"
        campaignId={process.env.NEXT_PUBLIC_EVENT_CAMPAIGN_ID ?? ""}
        refCode={ref}
        title="One evening for builders on Monad"
        description="A small gathering for demos, practical conversations and community. This sample pass is a one-time onchain access record."
      />
    </>
  );
}
