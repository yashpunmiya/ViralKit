import { type Abi, parseAbi } from "viem";

export const REFERRAL_HUB_ABI = parseAbi([
  "function nextCampaignId() view returns (uint256)",
  "function referrerByCode(bytes32 codeHash) view returns (address)",
  "function codeHashByReferrer(address referrer) view returns (bytes32)",
  "function referralCodeByReferrer(address referrer) view returns (string)",
  "function totalReferralEarnings(address referrer) view returns (uint256)",
  "function campaignReferralEarnings(uint256 campaignId, address referrer) view returns (uint256)",
  "function campaignMerchantRevenue(uint256 campaignId) view returns (uint256)",
  "function campaignPurchaseCount(uint256 campaignId) view returns (uint256)",
  "function referralPurchaseCount(address referrer) view returns (uint256)",
  "function hasPurchased(uint256 campaignId, address buyer) view returns (bool)",
  "function resolveReferralCode(string code) view returns (address)",
  "function registerReferralCode(string code) returns (bytes32 codeHash)",
  "function createCampaign(address token, uint256 price, uint16 commissionBps, string metadata) returns (uint256 campaignId)",
  "function updateCampaign(uint256 campaignId, address token, uint256 price, uint16 commissionBps, bool active, string metadata)",
  "function purchaseWithReferral(uint256 campaignId, string code)",
  "function campaigns(uint256 campaignId) view returns (uint256 id, address merchant, address token, uint256 price, uint16 commissionBps, bool active, string metadata)",
  "event ReferralRegistered(address indexed referrer, bytes32 indexed codeHash, string code)",
  "event CampaignCreated(uint256 indexed campaignId, address indexed merchant, address indexed token, uint256 price, uint16 commissionBps, string metadata)",
  "event CampaignUpdated(uint256 indexed campaignId, address indexed merchant, address indexed token, uint256 price, uint16 commissionBps, bool active, string metadata)",
  "event PurchaseCompleted(uint256 indexed campaignId, address indexed buyer, address indexed referrer, address token, uint256 price, uint256 merchantAmount, uint256 referralAmount, bytes32 referralCodeHash)",
]) as Abi;

export const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
]) as Abi;
