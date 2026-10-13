import { ethers } from "ethers";

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const AUSD_ADDRESS = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const AUSD_FAUCET = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C";
const DEPLOYER = "0x5D92A004cB5a3D64597622883fC89520acA185db";
const ALICE = "0x56b1066f9be6Ec2A053C7F6F17001cdDc45E4681";
const BOB = "0x92AA16d24eabA77a57c080f9B81f961613977eef";
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];
const FAUCET_ABI = ["function requestFunds(address account)"];
const HUB_ABI = ["function purchaseWithReferral(uint256 campaignId,string code)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  const token = new ethers.Contract(AUSD_ADDRESS, ERC20_ABI, provider);
  const hub = new ethers.Contract("0xf8B23407977e7d741dD4cc8ed8De871117eA307a", HUB_ABI, provider);
  const decimals = Number(await token.decimals());
  const faucetCode = await provider.getCode(AUSD_FAUCET);
  const faucet = new ethers.Contract(AUSD_FAUCET, FAUCET_ABI, provider);
  let faucetSimulation: string;
  try {
    await faucet.requestFunds.staticCall(DEPLOYER, { from: DEPLOYER });
    faucetSimulation = "requestFunds would succeed for merchant";
  } catch (error) {
    faucetSimulation = error instanceof Error ? error.message.split("\n")[0] : "simulation reverted";
  }
  const deployerBalance = await provider.getBalance(DEPLOYER);
  const deployerAusd = await token.balanceOf(DEPLOYER);
  const [aliceMon, bobMon, aliceAusd, bobAusd, feeData, bobNonce, bobPendingNonce] = await Promise.all([
    provider.getBalance(ALICE),
    provider.getBalance(BOB),
    token.balanceOf(ALICE),
    token.balanceOf(BOB),
    provider.getFeeData(),
    provider.getTransactionCount(BOB),
    provider.getTransactionCount(BOB, "pending"),
  ]);
  let purchaseGasEstimate: string | null = null;
  try {
    purchaseGasEstimate = (
      await hub.getFunction("purchaseWithReferral").estimateGas(2, "ALICE", { from: BOB })
    ).toString();
  } catch {}

  console.log(
    JSON.stringify(
      {
        chainId: Number(network.chainId),
        latestBlock: await provider.getBlockNumber(),
        ausd: {
          address: AUSD_ADDRESS,
          symbol: await token.symbol(),
          decimals,
          deployerBalance: ethers.formatUnits(deployerAusd, decimals),
        },
        merchant: {
          address: DEPLOYER,
          monBalance: ethers.formatEther(deployerBalance),
        },
        demoActors: {
          alice: {
            address: ALICE,
            monBalance: ethers.formatEther(aliceMon),
            ausdBalance: ethers.formatUnits(aliceAusd, decimals),
          },
          bob: {
            address: BOB,
            monBalance: ethers.formatEther(bobMon),
            ausdBalance: ethers.formatUnits(bobAusd, decimals),
          },
        },
        fees: {
          gasPriceGwei: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : null,
          maxFeePerGasGwei: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : null,
          maxPriorityFeePerGasGwei: feeData.maxPriorityFeePerGas
            ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei")
            : null,
          purchaseGasEstimate,
          purchaseMaxCost:
            purchaseGasEstimate && feeData.maxFeePerGas
              ? ethers.formatEther(BigInt(purchaseGasEstimate) * feeData.maxFeePerGas)
              : null,
          bobNonce,
          bobPendingNonce,
        },
        faucet: {
          address: AUSD_FAUCET,
          hasCode: faucetCode !== "0x",
          codeBytes: (faucetCode.length - 2) / 2,
          simulation: faucetSimulation,
        },
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
