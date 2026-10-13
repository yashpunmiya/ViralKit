export function generateCampaignReferralLink(origin: string, campaignId: bigint | number | string, code: string) {
  const id = BigInt(campaignId);
  if (id <= 0n) throw new Error("Campaign ID must be positive.");
  if (!/^[A-Z0-9]{3,24}$/i.test(code)) throw new Error("Referral code must contain 3–24 letters or numbers.");
  const url = new URL(`/checkout/${id.toString()}`, origin);
  url.searchParams.set("ref", code.toUpperCase());
  return url.toString();
}
