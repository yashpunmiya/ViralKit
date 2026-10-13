import { indexer } from "envio";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const txFields = { transaction: ["hash"] } as const;
const purchaseFields = { transaction: ["hash"], block: ["timestamp"] } as const;

indexer.onEvent(
  { contract: "ReferralHub", event: "ReferralRegistered", fields: txFields },
  async ({ event, context }) => {
    const referrer = event.params.referrer.toLowerCase();
    const current = await context.Referral.get(referrer);
    context.Referral.set({
      id: referrer,
      code: event.params.code,
      codeHash: event.params.codeHash,
      registeredAtBlock: BigInt(event.block.number),
      registrationTransactionHash: event.transaction.hash,
      totalEarnings: current?.totalEarnings ?? 0n,
      referredPurchases: current?.referredPurchases ?? 0,
    });
  },
);

indexer.onEvent(
  { contract: "ReferralHub", event: "CampaignCreated" },
  async ({ event, context }) => {
    const id = event.params.campaignId.toString();
    const current = await context.Campaign.get(id);
    context.Campaign.set({
      id,
      merchant: event.params.merchant.toLowerCase(),
      token: event.params.token.toLowerCase(),
      price: event.params.price,
      commissionBps: Number(event.params.commissionBps),
      active: true,
      metadata: event.params.metadata,
      createdAtBlock: BigInt(event.block.number),
      purchaseCount: current?.purchaseCount ?? 0,
      merchantRevenue: current?.merchantRevenue ?? 0n,
    });
  },
);

indexer.onEvent(
  { contract: "ReferralHub", event: "CampaignUpdated" },
  async ({ event, context }) => {
    const id = event.params.campaignId.toString();
    const current = await context.Campaign.get(id);
    context.Campaign.set({
      id,
      merchant: event.params.merchant.toLowerCase(),
      token: event.params.token.toLowerCase(),
      price: event.params.price,
      commissionBps: Number(event.params.commissionBps),
      active: event.params.active,
      metadata: event.params.metadata,
      createdAtBlock: current?.createdAtBlock ?? BigInt(event.block.number),
      purchaseCount: current?.purchaseCount ?? 0,
      merchantRevenue: current?.merchantRevenue ?? 0n,
    });
  },
);

// PurchaseCompleted is the one canonical purchase event. Indexing it once avoids
// double counting merchant and referral payouts as separate purchase events.
indexer.onEvent(
  { contract: "ReferralHub", event: "PurchaseCompleted", fields: purchaseFields },
  async ({ event, context }) => {
    const campaignId = event.params.campaignId.toString();
    const buyer = event.params.buyer.toLowerCase();
    const referrer = event.params.referrer.toLowerCase();
    const transactionHash = event.transaction.hash;
    const id = `${event.chainId}-${transactionHash}-${event.logIndex}`;
    const purchase = {
      id,
      campaignId,
      buyer,
      referrer,
      token: event.params.token.toLowerCase(),
      price: event.params.price,
      merchantAmount: event.params.merchantAmount,
      referralAmount: event.params.referralAmount,
      transactionHash,
      blockNumber: BigInt(event.block.number),
      blockTimestamp: event.block.timestamp,
      logIndex: event.logIndex,
    };
    context.Purchase.set(purchase);

    const campaign = await context.Campaign.get(campaignId);
    if (campaign) {
      context.Campaign.set({
        ...campaign,
        purchaseCount: campaign.purchaseCount + 1,
        merchantRevenue: campaign.merchantRevenue + event.params.merchantAmount,
      });
    }

    if (referrer !== ZERO_ADDRESS && event.params.referralAmount > 0n) {
      const existing = await context.Referral.get(referrer);
      if (existing) {
        context.Referral.set({
          ...existing,
          totalEarnings: existing.totalEarnings + event.params.referralAmount,
          referredPurchases: existing.referredPurchases + 1,
        });
      }
    }
  },
);
