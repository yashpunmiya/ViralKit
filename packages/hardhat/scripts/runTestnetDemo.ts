import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const HUB_ADDRESS = "0xf8B23407977e7d741dD4cc8ed8De871117eA307a";
const TOKEN_ADDRESS = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const FAUCET_ADDRESS = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const EXPECTED_DEPLOYER = "0x5D92A004cB5a3D64597622883fC89520acA185db";
const EXPLORER = "https://testnet.monadexplorer.com/tx/";
const HUB_ABI = [
  "function nextCampaignId() view returns (uint256)",
  "function registerReferralCode(string code) returns (bytes32)",
  "function resolveReferralCode(string code) view returns (address)",
  "function createCampaign(address token,uint256 price,uint16 commissionBps,string metadata) returns (uint256)",
  "function purchaseWithReferral(uint256 campaignId,string code)",
  "function campaigns(uint256) view returns (uint256 id,address merchant,address token,uint256 price,uint16 commissionBps,bool active,string metadata)",
  "function hasPurchased(uint256,address) view returns (bool)",
  "function totalReferralEarnings(address) view returns (uint256)",
  "function campaignReferralEarnings(uint256,address) view returns (uint256)",
  "function campaignMerchantRevenue(uint256) view returns (uint256)",
  "function campaignPurchaseCount(uint256) view returns (uint256)",
  "event ReferralRegistered(address indexed referrer,bytes32 indexed codeHash,string code)",
  "event CampaignCreated(uint256 indexed campaignId,address indexed merchant,address indexed token,uint256 price,uint16 commissionBps,string metadata)",
  "event PurchaseCompleted(uint256 indexed campaignId,address indexed buyer,address indexed referrer,address token,uint256 price,uint256 merchantAmount,uint256 referralAmount,bytes32 referralCodeHash)",
];
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const FAUCET_ABI = ["function requestFunds(address account)"];

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function confirm(label: string, tx: ethers.TransactionResponse) {
  const receipt = await tx.wait();
  ensure(receipt?.status === 1, `${label} transaction reverted`);
  console.log(`${label}: ${tx.hash} (${EXPLORER}${tx.hash})`);
  return receipt;
}

async function waitForMonadReserveWindow(provider: ethers.JsonRpcProvider) {
  // Monad's reserve-balance rule tracks in-flight gas spend for three blocks.
  // Small test wallets should leave a short block gap between their own txs.
  const targetBlock = (await provider.getBlockNumber()) + 4;
  while ((await provider.getBlockNumber()) < targetBlock) {
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}

async function loadOrCreateActors(password: string) {
  const envPath = path.resolve(".env");
  let alice: ethers.HDNodeWallet | ethers.Wallet;
  let bob: ethers.HDNodeWallet | ethers.Wallet;

  if (process.env.VIRALKIT_DEMO_ALICE_ENCRYPTED && process.env.VIRALKIT_DEMO_BOB_ENCRYPTED) {
    alice = await ethers.Wallet.fromEncryptedJson(process.env.VIRALKIT_DEMO_ALICE_ENCRYPTED, password);
    bob = await ethers.Wallet.fromEncryptedJson(process.env.VIRALKIT_DEMO_BOB_ENCRYPTED, password);
  } else {
    alice = ethers.Wallet.createRandom();
    bob = ethers.Wallet.createRandom();
    process.env.VIRALKIT_DEMO_ALICE_ENCRYPTED = await alice.encrypt(password);
    process.env.VIRALKIT_DEMO_BOB_ENCRYPTED = await bob.encrypt(password);
    fs.appendFileSync(
      envPath,
      `\nVIRALKIT_DEMO_ALICE_ENCRYPTED='${process.env.VIRALKIT_DEMO_ALICE_ENCRYPTED}'\nVIRALKIT_DEMO_BOB_ENCRYPTED='${process.env.VIRALKIT_DEMO_BOB_ENCRYPTED}'\n`,
    );
  }

  return { alice, bob };
}

function storeFrontendCampaignIds(newsletterId: bigint, eventId: bigint) {
  const envPath = path.resolve("../nextjs/.env.local");
  const current = fs.readFileSync(envPath, "utf8");
  const updates: Record<string, string> = {
    NEXT_PUBLIC_NEWSLETTER_CAMPAIGN_ID: newsletterId.toString(),
    NEXT_PUBLIC_EVENT_CAMPAIGN_ID: eventId.toString(),
  };
  let next = current;
  for (const [key, value] of Object.entries(updates)) {
    const line = new RegExp(`^${key}=.*$`, "m");
    if (line.test(next)) next = next.replace(line, `${key}=${value}`);
    else next = `${next.trimEnd()}\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, next);
}

async function main() {
  const password = process.env.VIRALKIT_DEMO_PASSWORD;
  ensure(password, "Set VIRALKIT_DEMO_PASSWORD from the Windows DPAPI-protected local password before running.");
  const encryptedDeployer = process.env.DEPLOYER_PRIVATE_KEY_ENCRYPTED;
  ensure(encryptedDeployer, "Missing encrypted merchant deployer in packages/hardhat/.env.");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  ensure(network.chainId === 10143n, `Expected Monad Testnet (10143); got ${network.chainId}.`);

  const merchant = (await ethers.Wallet.fromEncryptedJson(encryptedDeployer, password)).connect(provider);
  ensure(merchant.address.toLowerCase() === EXPECTED_DEPLOYER.toLowerCase(), "Unexpected merchant wallet address.");
  const { alice: aliceSigner, bob: bobSigner } = await loadOrCreateActors(password);
  const alice = aliceSigner.connect(provider);
  const bob = bobSigner.connect(provider);
  const hub = new ethers.Contract(HUB_ADDRESS, HUB_ABI, provider);
  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
  const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, provider);
  const decimals = Number(await token.decimals());
  ensure((await token.symbol()) === "AUSD", "Configured Agora token does not report AUSD.");
  const price = ethers.parseUnits("10", decimals);

  console.log(`Monad Testnet block: ${await provider.getBlockNumber()}`);
  console.log(`Merchant: ${merchant.address}`);
  console.log(`Alice referrer: ${alice.address}`);
  console.log(`Bob buyer: ${bob.address}`);
  console.log(`AUSD: ${await token.symbol()} (${decimals} decimals); each campaign price is 10 AUSD.`);

  // Give both demo actors a small amount of test MON for their own gas transactions.
  for (const [label, actor, minBalance, topUp] of [
    ["Alice", alice, ethers.parseEther("0.05"), ethers.parseEther("0.1")],
    ["Bob", bob, ethers.parseEther("0.75"), ethers.parseEther("0.75")],
  ] as const) {
    const balance = await provider.getBalance(actor.address);
    if (balance < minBalance) {
      await confirm(
        `${label} gas funding`,
        await merchant.sendTransaction({
          to: actor.address,
          value: topUp,
        }),
      );
    }
  }

  const currentReferrer = await hub.resolveReferralCode("ALICE");
  if (currentReferrer === ethers.ZeroAddress) {
    await confirm("Alice referral registration", await hub.connect(alice).getFunction("registerReferralCode")("ALICE"));
  } else {
    ensure(currentReferrer.toLowerCase() === alice.address.toLowerCase(), "ALICE is already owned by another wallet.");
    console.log("Alice referral registration: already confirmed onchain.");
  }

  const nextCampaignId = BigInt(await hub.nextCampaignId());
  let newsletterId: bigint;
  let eventId: bigint;
  if (nextCampaignId === 1n) {
    const newsletterReceipt = await confirm(
      "Newsletter campaign creation",
      await hub.connect(merchant).getFunction("createCampaign")(
        TOKEN_ADDRESS,
        price,
        2_000,
        "ViralKit newsletter access:v1",
      ),
    );
    const newsletterEvent = newsletterReceipt.logs
      .map((log: ethers.Log) => {
        try {
          return hub.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(log => log?.name === "CampaignCreated");
    ensure(newsletterEvent, "Newsletter CampaignCreated event missing from receipt.");
    newsletterId = newsletterEvent.args.campaignId;

    const eventReceipt = await confirm(
      "Event campaign creation",
      await hub.connect(merchant).getFunction("createCampaign")(TOKEN_ADDRESS, price, 2_000, "ViralKit event pass:v1"),
    );
    const event = eventReceipt.logs
      .map((log: ethers.Log) => {
        try {
          return hub.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(log => log?.name === "CampaignCreated");
    ensure(event, "Event CampaignCreated event missing from receipt.");
    eventId = event.args.campaignId;
  } else {
    ensure(nextCampaignId === 3n, `Expected no campaigns or exactly two; nextCampaignId is ${nextCampaignId}.`);
    newsletterId = 1n;
    eventId = 2n;
    const campaignOne = await hub.campaigns(newsletterId);
    const campaignTwo = await hub.campaigns(eventId);
    ensure(
      campaignOne.merchant.toLowerCase() === merchant.address.toLowerCase(),
      "Existing campaign #1 has another merchant.",
    );
    ensure(
      campaignTwo.merchant.toLowerCase() === merchant.address.toLowerCase(),
      "Existing campaign #2 has another merchant.",
    );
    console.log("Campaigns: IDs 1 and 2 already exist for the merchant.");
  }

  storeFrontendCampaignIds(newsletterId, eventId);
  const bobAusdBefore = BigInt(await token.balanceOf(bob.address));
  if (bobAusdBefore < price * 2n) {
    await confirm("Bob AUSD faucet request", await faucet.connect(bob).getFunction("requestFunds")(bob.address));
    await waitForMonadReserveWindow(provider);
  }
  ensure(
    BigInt(await token.balanceOf(bob.address)) >= price * 2n,
    "Bob has less than 20 AUSD after the Agora faucet request.",
  );

  const merchantBefore = BigInt(await token.balanceOf(merchant.address));
  const aliceBefore = BigInt(await token.balanceOf(alice.address));
  const campaignIds = [newsletterId, eventId];
  const purchases: Array<{ campaignId: string; hash: string; merchantAmount: string; referralAmount: string }> = [];
  for (const campaignId of campaignIds) {
    const purchased = await hub.hasPurchased(campaignId, bob.address);
    if (purchased) {
      console.log(`Purchase for campaign ${campaignId}: already confirmed onchain.`);
      continue;
    }
    const allowance = BigInt(await token.allowance(bob.address, HUB_ADDRESS));
    if (allowance < price) {
      await confirm(
        `Bob AUSD approval for campaign ${campaignId}`,
        await token.connect(bob).getFunction("approve")(HUB_ADDRESS, price),
      );
      await waitForMonadReserveWindow(provider);
    }
    let tx: ethers.TransactionResponse;
    try {
      tx = await hub.connect(bob).getFunction("purchaseWithReferral")(campaignId, "ALICE");
    } catch (sendError) {
      const payload = (sendError as { payload?: { params?: string[] } }).payload;
      const raw = payload?.params?.[0];
      if (raw) {
        const attempted = ethers.Transaction.from(raw);
        const senderBalance = attempted.from ? await provider.getBalance(attempted.from) : 0n;
        console.error("Rejected transaction diagnostics:", {
          sender: attempted.from,
          nonce: attempted.nonce,
          gasLimit: attempted.gasLimit.toString(),
          maxFeePerGas: attempted.maxFeePerGas?.toString(),
          maxGasCost: attempted.maxFeePerGas ? (attempted.gasLimit * attempted.maxFeePerGas).toString() : null,
          senderBalance: senderBalance.toString(),
        });
      }
      throw sendError;
    }
    const receipt = await tx.wait();
    ensure(receipt?.status === 1, `Campaign ${campaignId} purchase reverted.`);
    const purchaseEvent = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return hub.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((log: ethers.LogDescription | null) => log?.name === "PurchaseCompleted");
    ensure(purchaseEvent, `PurchaseCompleted event missing for campaign ${campaignId}.`);
    ensure(purchaseEvent.args.buyer.toLowerCase() === bob.address.toLowerCase(), "Unexpected buyer in purchase event.");
    ensure(
      purchaseEvent.args.referrer.toLowerCase() === alice.address.toLowerCase(),
      "Unexpected referrer in purchase event.",
    );
    ensure(purchaseEvent.args.price === price, "Unexpected purchase amount.");
    ensure(purchaseEvent.args.merchantAmount === (price * 80n) / 100n, "Merchant split is not 80%.");
    ensure(purchaseEvent.args.referralAmount === (price * 20n) / 100n, "Referral split is not 20%.");
    purchases.push({
      campaignId: campaignId.toString(),
      hash: tx.hash,
      merchantAmount: purchaseEvent.args.merchantAmount.toString(),
      referralAmount: purchaseEvent.args.referralAmount.toString(),
    });
    console.log(`Campaign ${campaignId} purchase: ${tx.hash} (${EXPLORER}${tx.hash})`);
    await waitForMonadReserveWindow(provider);
  }

  const [merchantAfter, aliceAfter, totalEarnings, aliceCode, accessOne, accessTwo] = await Promise.all([
    token.balanceOf(merchant.address),
    token.balanceOf(alice.address),
    hub.totalReferralEarnings(alice.address),
    hub.resolveReferralCode("alice"),
    hub.hasPurchased(newsletterId, bob.address),
    hub.hasPurchased(eventId, bob.address),
  ]);
  const merchantDelta = BigInt(merchantAfter) - merchantBefore;
  const aliceDelta = BigInt(aliceAfter) - aliceBefore;
  ensure(merchantDelta === (price * BigInt(purchases.length) * 80n) / 100n, "Unexpected merchant balance delta.");
  ensure(aliceDelta === (price * BigInt(purchases.length) * 20n) / 100n, "Unexpected referrer balance delta.");
  ensure(BigInt(totalEarnings) === (price * 2n * 20n) / 100n, "Unexpected totalReferralEarnings value.");
  ensure(aliceCode.toLowerCase() === alice.address.toLowerCase(), "Case-insensitive ALICE resolution failed.");
  ensure(accessOne && accessTwo, "Bob's paid access is not confirmed for both demo apps.");

  const block = await provider.getBlockNumber();
  console.log(
    JSON.stringify(
      {
        result: "verified",
        chainId: Number(network.chainId),
        verificationBlock: block,
        merchant: merchant.address,
        alice: alice.address,
        bob: bob.address,
        referralCode: "ALICE",
        campaigns: {
          newsletter: { id: newsletterId.toString(), price: "10 AUSD", commissionBps: 2_000 },
          event: { id: eventId.toString(), price: "10 AUSD", commissionBps: 2_000 },
        },
        purchases,
        payoutDeltas: {
          merchant: ethers.formatUnits(merchantDelta, decimals),
          alice: ethers.formatUnits(aliceDelta, decimals),
          expectedPerPurchase: { merchant: "8 AUSD", alice: "2 AUSD" },
        },
        aliceLifetimeReferralEarnings: ethers.formatUnits(BigInt(totalEarnings), decimals),
        bobAccess: { newsletter: accessOne, event: accessTwo },
      },
      null,
      2,
    ),
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
