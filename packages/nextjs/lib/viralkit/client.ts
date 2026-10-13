import { ERC20_ABI, REFERRAL_HUB_ABI } from "./abi";
import { generateCampaignReferralLink } from "./links";
import { type Address, type PublicClient, type WalletClient, parseAbiItem } from "viem";

export const REFERRAL_HUB_ADDRESS = process.env.NEXT_PUBLIC_REFERRAL_HUB_ADDRESS as Address | undefined;
export const AUSD_ADDRESS = process.env.NEXT_PUBLIC_AUSD_ADDRESS as Address | undefined;
export const EXPLORER_URL = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL ?? "https://testnet.monadexplorer.com";
export const MONAD_TESTNET_ID = 10143;
const PURCHASE_COMPLETED_EVENT = parseAbiItem(
  "event PurchaseCompleted(uint256 indexed campaignId, address indexed buyer, address indexed referrer, address token, uint256 price, uint256 merchantAmount, uint256 referralAmount, bytes32 referralCodeHash)",
);

export function hasContractConfiguration() {
  return Boolean(REFERRAL_HUB_ADDRESS && AUSD_ADDRESS);
}

export function createViralKitClient({
  publicClient,
  walletClient,
  referralHubAddress = REFERRAL_HUB_ADDRESS,
}: {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  referralHubAddress?: Address;
}) {
  if (!referralHubAddress) throw new Error("Set NEXT_PUBLIC_REFERRAL_HUB_ADDRESS before using the ViralKit SDK.");

  const account = walletClient?.account?.address;
  const requireWallet = () => {
    if (!walletClient || !account) throw new Error("Connect a wallet to sign this transaction.");
    if (walletClient.chain?.id !== MONAD_TESTNET_ID)
      throw new Error("Switch your wallet to Monad Testnet (chain ID 10143).");
    return { walletClient, account };
  };

  return {
    address: referralHubAddress,
    generateCampaignReferralLink,
    async registerReferralCode(code: string) {
      const { walletClient: wallet, account: connectedAccount } = requireWallet();
      return wallet.writeContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "registerReferralCode",
        args: [code],
        account: connectedAccount,
        chain: null,
      });
    },
    resolveReferralCode(code: string) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "resolveReferralCode",
        args: [code],
      }) as Promise<Address>;
    },
    getCampaign(campaignId: bigint) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaigns",
        args: [campaignId],
      }) as Promise<readonly [bigint, Address, Address, bigint, number, boolean, string]>;
    },
    async createCampaign({
      token,
      price,
      commissionBps,
      metadata,
    }: {
      token: Address;
      price: bigint;
      commissionBps: number;
      metadata: string;
    }) {
      const { walletClient: wallet, account: connectedAccount } = requireWallet();
      return wallet.writeContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "createCampaign",
        args: [token, price, commissionBps, metadata],
        account: connectedAccount,
        chain: null,
      });
    },
    async updateCampaign(
      campaignId: bigint,
      {
        token,
        price,
        commissionBps,
        active,
        metadata,
      }: {
        token: Address;
        price: bigint;
        commissionBps: number;
        active: boolean;
        metadata: string;
      },
    ) {
      const { walletClient: wallet, account: connectedAccount } = requireWallet();
      const [currentCampaign, existingSales] = await Promise.all([
        publicClient.readContract({
          address: referralHubAddress,
          abi: REFERRAL_HUB_ABI,
          functionName: "campaigns",
          args: [campaignId],
        }) as Promise<readonly [bigint, Address, Address, bigint, number, boolean, string]>,
        publicClient.readContract({
          address: referralHubAddress,
          abi: REFERRAL_HUB_ABI,
          functionName: "campaignPurchaseCount",
          args: [campaignId],
        }) as Promise<bigint>,
      ]);
      if (currentCampaign[0] === 0n) throw new Error("This campaign does not exist.");
      if (existingSales > 0n && token.toLowerCase() !== currentCampaign[2].toLowerCase()) {
        throw new Error(
          "Payment token cannot be changed after the first sale because campaign revenue is tracked in one token.",
        );
      }
      return wallet.writeContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "updateCampaign",
        args: [campaignId, token, price, commissionBps, active, metadata],
        account: connectedAccount,
        chain: null,
      });
    },
    async purchaseWithReferral(campaignId: bigint, code: string, onApproval?: (hash: `0x${string}`) => void) {
      const { walletClient: wallet, account: connectedAccount } = requireWallet();
      const [campaignIdFromChain, , token, price, , active] = (await publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaigns",
        args: [campaignId],
      })) as unknown as readonly [bigint, Address, Address, bigint, number, boolean, string];
      if (campaignIdFromChain === 0n) throw new Error("This campaign is not available on the connected network.");
      if (!active) throw new Error("This campaign is currently paused.");

      const [allowance, balance] = (await Promise.all([
        publicClient.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [connectedAccount, referralHubAddress],
        }),
        publicClient.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [connectedAccount],
        }),
      ])) as unknown as [bigint, bigint];
      if (balance < price) throw new Error("Your payment token balance is too low for this purchase.");
      if (allowance < price) {
        const approvalHash = await wallet.writeContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [referralHubAddress, price],
          account: connectedAccount,
          chain: null,
        });
        const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        if (approvalReceipt.status !== "success")
          throw new Error("Payment token approval reverted. The purchase was not submitted.");
        onApproval?.(approvalHash);
      }

      return wallet.writeContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "purchaseWithReferral",
        args: [campaignId, code],
        account: connectedAccount,
        chain: null,
      });
    },
    hasPurchased(campaignId: bigint, buyer: Address) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "hasPurchased",
        args: [campaignId, buyer],
      }) as Promise<boolean>;
    },
    getReferralEarnings(referrer: Address) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "totalReferralEarnings",
        args: [referrer],
      }) as Promise<bigint>;
    },
    getCampaignSales(campaignId: bigint) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaignPurchaseCount",
        args: [campaignId],
      }) as Promise<bigint>;
    },
    getCampaignReferralEarnings(campaignId: bigint, referrer: Address) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaignReferralEarnings",
        args: [campaignId, referrer],
      }) as Promise<bigint>;
    },
    getCampaignMerchantRevenue(campaignId: bigint) {
      return publicClient.readContract({
        address: referralHubAddress,
        abi: REFERRAL_HUB_ABI,
        functionName: "campaignMerchantRevenue",
        args: [campaignId],
      }) as Promise<bigint>;
    },
    getCampaignPurchaseEvents(campaignId: bigint, fromBlock: bigint) {
      return publicClient.getLogs({
        address: referralHubAddress,
        event: PURCHASE_COMPLETED_EVENT,
        args: { campaignId },
        fromBlock,
        toBlock: "latest",
      });
    },
  };
}
