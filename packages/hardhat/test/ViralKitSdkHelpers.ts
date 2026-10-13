import { expect } from "chai";
import { decodeCampaignMetadata, encodeCampaignMetadata } from "../../nextjs/lib/viralkit/metadata";
import { generateCampaignReferralLink } from "../../nextjs/lib/viralkit/links";

describe("ViralKit local SDK helpers", function () {
  it("creates campaign-specific referral links with normalized codes", function () {
    expect(generateCampaignReferralLink("https://app.example", 12, "alice")).to.equal(
      "https://app.example/checkout/12?ref=ALICE",
    );
  });

  it("rejects invalid campaign IDs and referral codes", function () {
    expect(() => generateCampaignReferralLink("https://app.example", 0, "ALICE")).to.throw("positive");
    expect(() => generateCampaignReferralLink("https://app.example", 1, "A LICE")).to.throw("3–24");
  });

  it("round trips campaign display metadata and reads legacy strings", function () {
    const encoded = encodeCampaignMetadata({ name: "Pro plan", description: "Full access" });
    expect(decodeCampaignMetadata(encoded)).to.deep.equal({ name: "Pro plan", description: "Full access" });
    expect(decodeCampaignMetadata("Legacy campaign").name).to.equal("Legacy campaign");
  });
});
