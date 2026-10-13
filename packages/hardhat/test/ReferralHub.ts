import { expect } from "chai";
import { ethers } from "hardhat";

const UNIT = 10n ** 18n;
const PRICE = 10n * UNIT;

describe("ReferralHub", function () {
  let hub: any;
  let token: any;
  let merchant: any;
  let alice: any;
  let bob: any;
  let carol: any;

  async function createCampaign(owner = merchant, commissionBps = 2_000, metadata = "newsletter:v1") {
    const tx = await hub.connect(owner).createCampaign(await token.getAddress(), PRICE, commissionBps, metadata);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log: any) => {
        try {
          return hub.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "CampaignCreated");
    return event.args.campaignId as bigint;
  }

  async function approveAndPurchase(buyer: any, campaignId: bigint, code = "") {
    await token.connect(buyer).approve(await hub.getAddress(), PRICE);
    return hub.connect(buyer).purchaseWithReferral(campaignId, code);
  }

  beforeEach(async function () {
    [merchant, alice, bob, carol] = await ethers.getSigners();
    hub = await (await ethers.getContractFactory("ReferralHub")).deploy();
    token = await (await ethers.getContractFactory("MockERC20")).deploy();
    await hub.waitForDeployment();
    await token.waitForDeployment();
    await token.mint(bob.address, 100n * UNIT);
    await token.mint(carol.address, 100n * UNIT);
  });

  describe("referral identities", function () {
    it("registers a unique code and resolves it case-insensitively", async function () {
      await expect(hub.connect(alice).registerReferralCode("Alice7"))
        .to.emit(hub, "ReferralRegistered")
        .withArgs(alice.address, ethers.keccak256(ethers.toUtf8Bytes("ALICE7")), "ALICE7");
      expect(await hub.resolveReferralCode("alice7")).to.equal(alice.address);
      expect(await hub.getReferralCode(alice.address)).to.equal(ethers.keccak256(ethers.toUtf8Bytes("ALICE7")));
    });

    it("rejects duplicate codes, a second identity for one wallet, and invalid characters or lengths", async function () {
      await hub.connect(alice).registerReferralCode("ALICE");
      await expect(hub.connect(bob).registerReferralCode("alice")).to.be.revertedWithCustomError(
        hub,
        "ReferralCodeAlreadyRegistered",
      );
      await expect(hub.connect(alice).registerReferralCode("ANOTHER")).to.be.revertedWithCustomError(
        hub,
        "WalletAlreadyHasReferralCode",
      );
      await expect(hub.connect(carol).registerReferralCode("ab")).to.be.revertedWithCustomError(
        hub,
        "InvalidReferralCode",
      );
      await expect(hub.connect(carol).registerReferralCode("BAD-CODE")).to.be.revertedWithCustomError(
        hub,
        "InvalidReferralCode",
      );
    });
  });

  describe("campaigns", function () {
    it("creates active campaigns with unique IDs and validates configuration", async function () {
      const firstId = await createCampaign();
      const secondId = await createCampaign(merchant, 0, "event:v1");
      expect(firstId).to.equal(1n);
      expect(secondId).to.equal(2n);
      const first = await hub.getCampaign(firstId);
      expect(first.merchant).to.equal(merchant.address);
      expect(first.price).to.equal(PRICE);
      expect(first.commissionBps).to.equal(2_000);
      expect(first.active).to.equal(true);

      await expect(
        hub.connect(merchant).createCampaign(ethers.ZeroAddress, PRICE, 2_000, "item"),
      ).to.be.revertedWithCustomError(hub, "InvalidCampaignConfiguration");
      await expect(
        hub.connect(merchant).createCampaign(await token.getAddress(), 0, 2_000, "item"),
      ).to.be.revertedWithCustomError(hub, "InvalidCampaignConfiguration");
      await expect(
        hub.connect(merchant).createCampaign(await token.getAddress(), PRICE, 2_501, "item"),
      ).to.be.revertedWithCustomError(hub, "InvalidCampaignConfiguration");
      await expect(
        hub.connect(merchant).createCampaign(await token.getAddress(), PRICE, 2_000, ""),
      ).to.be.revertedWithCustomError(hub, "InvalidCampaignConfiguration");
    });

    it("lets only the merchant update their own campaign", async function () {
      const id = await createCampaign();
      await expect(
        hub.connect(alice).updateCampaign(id, await token.getAddress(), PRICE, 1_000, true, "changed"),
      ).to.be.revertedWithCustomError(hub, "NotCampaignMerchant");
      await expect(
        hub.connect(merchant).updateCampaign(id, await token.getAddress(), PRICE, 1_000, false, "changed"),
      ).to.emit(hub, "CampaignUpdated");
      expect((await hub.getCampaign(id)).active).to.equal(false);
      await expect(
        hub.connect(merchant).updateCampaign(999, await token.getAddress(), PRICE, 1, true, "item"),
      ).to.be.revertedWithCustomError(hub, "CampaignNotFound");
    });
  });

  describe("purchases and payouts", function () {
    it("splits a referred payment exactly and emits one canonical purchase record", async function () {
      await hub.connect(alice).registerReferralCode("ALICE");
      const id = await createCampaign();
      const merchantBefore = await token.balanceOf(merchant.address);
      const aliceBefore = await token.balanceOf(alice.address);

      await expect(approveAndPurchase(bob, id, "alice"))
        .to.emit(hub, "PurchaseCompleted")
        .withArgs(
          id,
          bob.address,
          alice.address,
          await token.getAddress(),
          PRICE,
          8n * UNIT,
          2n * UNIT,
          ethers.keccak256(ethers.toUtf8Bytes("ALICE")),
        );

      expect((await token.balanceOf(merchant.address)) - merchantBefore).to.equal(8n * UNIT);
      expect((await token.balanceOf(alice.address)) - aliceBefore).to.equal(2n * UNIT);
      expect(await token.balanceOf(await hub.getAddress())).to.equal(0n);
      expect(await hub.hasPurchased(id, bob.address)).to.equal(true);
      expect(await hub.totalReferralEarnings(alice.address)).to.equal(2n * UNIT);
      expect(await hub.campaignReferralEarnings(id, alice.address)).to.equal(2n * UNIT);
      expect(await hub.campaignMerchantRevenue(id)).to.equal(8n * UNIT);
      expect(await hub.campaignPurchaseCount(id)).to.equal(1n);
      expect(await hub.referralPurchaseCount(alice.address)).to.equal(1n);
    });

    it("pays the full price without a referral and rejects unknown, self, and repeat purchases", async function () {
      const id = await createCampaign();
      const merchantBefore = await token.balanceOf(merchant.address);
      await approveAndPurchase(bob, id);
      expect((await token.balanceOf(merchant.address)) - merchantBefore).to.equal(PRICE);
      expect(await hub.hasPurchased(id, bob.address)).to.equal(true);
      await expect(hub.connect(bob).purchaseWithReferral(id, "")).to.be.revertedWithCustomError(
        hub,
        "AlreadyPurchased",
      );

      await hub.connect(carol).registerReferralCode("CAROL");
      const secondId = await createCampaign(merchant, 2_000, "event:v1");
      await expect(hub.connect(carol).purchaseWithReferral(secondId, "CAROL")).to.be.revertedWithCustomError(
        hub,
        "InvalidReferral",
      );
      await expect(hub.connect(bob).purchaseWithReferral(secondId, "UNKNOWN")).to.be.revertedWithCustomError(
        hub,
        "InvalidReferral",
      );
      expect(await hub.hasPurchased(secondId, bob.address)).to.equal(false);
    });

    it("reuses one referral identity across independent campaigns", async function () {
      await hub.connect(alice).registerReferralCode("ALICE");
      const newsletter = await createCampaign(merchant, 2_000, "newsletter:v1");
      const eventPass = await createCampaign(carol, 1_000, "event:v1");
      await approveAndPurchase(bob, newsletter, "ALICE");
      await approveAndPurchase(bob, eventPass, "ALICE");
      expect(await hub.totalReferralEarnings(alice.address)).to.equal(3n * UNIT);
      expect(await hub.campaignReferralEarnings(newsletter, alice.address)).to.equal(2n * UNIT);
      expect(await hub.campaignReferralEarnings(eventPass, alice.address)).to.equal(UNIT);
      expect(await hub.campaignMerchantRevenue(newsletter)).to.equal(8n * UNIT);
      expect(await hub.campaignMerchantRevenue(eventPass)).to.equal(9n * UNIT);
    });

    it("rejects inactive campaigns and token transfers without allowance or balance", async function () {
      const id = await createCampaign();
      await hub.connect(merchant).updateCampaign(id, await token.getAddress(), PRICE, 2_000, false, "newsletter:v1");
      await expect(approveAndPurchase(bob, id)).to.be.revertedWithCustomError(hub, "CampaignInactive");
      const activeId = await createCampaign();
      await expect(hub.connect(carol).purchaseWithReferral(activeId, "")).to.be.revertedWithCustomError(
        token,
        "ERC20InsufficientAllowance",
      );
      await token.connect(alice).approve(await hub.getAddress(), PRICE);
      await expect(hub.connect(alice).purchaseWithReferral(activeId, "")).to.be.revertedWithCustomError(
        token,
        "ERC20InsufficientBalance",
      );
    });

    it("rolls back the entire purchase when the second payout fails", async function () {
      await hub.connect(alice).registerReferralCode("ALICE");
      const id = await createCampaign();
      await token.setBlockedReceiver(alice.address);
      await expect(approveAndPurchase(bob, id, "ALICE")).to.be.revertedWith("blocked receiver");
      expect(await token.balanceOf(merchant.address)).to.equal(0n);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
      expect(await token.balanceOf(bob.address)).to.equal(100n * UNIT);
      expect(await hub.hasPurchased(id, bob.address)).to.equal(false);
      expect(await hub.campaignPurchaseCount(id)).to.equal(0n);
      expect(await hub.totalReferralEarnings(alice.address)).to.equal(0n);
    });

    it("does not retain payment balances after exact transfers", async function () {
      const id = await createCampaign();
      await approveAndPurchase(bob, id);
      expect(await token.balanceOf(await hub.getAddress())).to.equal(0n);
      expect(await hub.campaignMerchantRevenue(id)).to.equal(PRICE);
    });

    it("rejects fee-on-transfer tokens without moving funds", async function () {
      const feeToken = await (await ethers.getContractFactory("MockFeeOnTransferERC20")).deploy();
      await feeToken.waitForDeployment();
      await feeToken.mint(bob.address, PRICE);
      const id = await hub.connect(merchant).createCampaign(await feeToken.getAddress(), PRICE, 2_000, "item:v1");
      const receipt = await id.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return hub.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "CampaignCreated");
      const campaignId = event.args.campaignId as bigint;
      await (feeToken.connect(bob) as any).approve(await hub.getAddress(), PRICE);
      await expect(hub.connect(bob).purchaseWithReferral(campaignId, "")).to.be.revertedWithCustomError(
        hub,
        "UnsupportedTokenBehavior",
      );
      expect(await feeToken.balanceOf(bob.address)).to.equal(PRICE);
      expect(await feeToken.balanceOf(merchant.address)).to.equal(0n);
      expect(await hub.hasPurchased(campaignId, bob.address)).to.equal(false);
    });

    it("blocks reentrant purchase attempts from a token callback", async function () {
      const reentrantToken = await (await ethers.getContractFactory("ReentrantERC20")).deploy();
      await reentrantToken.waitForDeployment();
      await reentrantToken.mint(bob.address, PRICE);
      const campaignTx = await hub
        .connect(merchant)
        .createCampaign(await reentrantToken.getAddress(), PRICE, 0, "item:v1");
      const receipt = await campaignTx.wait();
      const event = receipt.logs
        .map((log: any) => {
          try {
            return hub.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "CampaignCreated");
      const campaignId = event.args.campaignId as bigint;
      await (reentrantToken.connect(bob) as any).approve(await hub.getAddress(), PRICE);
      await reentrantToken.armAttack(await hub.getAddress(), campaignId);
      await hub.connect(bob).purchaseWithReferral(campaignId, "");
      expect(await reentrantToken.reentryBlocked()).to.equal(true);
      expect(await hub.campaignPurchaseCount(campaignId)).to.equal(1n);
      expect(await reentrantToken.balanceOf(merchant.address)).to.equal(PRICE);
    });
  });
});
