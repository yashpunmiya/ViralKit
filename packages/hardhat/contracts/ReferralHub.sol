// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ReferralHub
/// @notice Shared referral identities and atomic, single-level ERC-20 campaign payouts.
/// @dev Supports ordinary, non-rebasing ERC-20s that transfer the exact requested amount.
contract ReferralHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_COMMISSION_BPS = 2_500;
    uint256 public constant MIN_CODE_LENGTH = 3;
    uint256 public constant MAX_CODE_LENGTH = 24;
    uint256 public constant MAX_METADATA_LENGTH = 500;

    struct Campaign {
        uint256 id;
        address merchant;
        IERC20 token;
        uint256 price;
        uint16 commissionBps;
        bool active;
        string metadata;
    }

    uint256 public nextCampaignId = 1;
    mapping(uint256 campaignId => Campaign campaign) public campaigns;
    mapping(bytes32 codeHash => address owner) public referrerByCode;
    mapping(address referrer => bytes32 codeHash) public codeHashByReferrer;
    mapping(address referrer => string code) public referralCodeByReferrer;
    mapping(uint256 campaignId => mapping(address buyer => bool)) private _hasPurchased;
    mapping(address referrer => uint256 amount) public totalReferralEarnings;
    mapping(uint256 campaignId => mapping(address referrer => uint256 amount)) public campaignReferralEarnings;
    mapping(uint256 campaignId => uint256 amount) public campaignMerchantRevenue;
    mapping(uint256 campaignId => uint256 count) public campaignPurchaseCount;
    mapping(address referrer => uint256 count) public referralPurchaseCount;

    error InvalidReferralCode();
    error ReferralCodeAlreadyRegistered();
    error WalletAlreadyHasReferralCode();
    error InvalidCampaignConfiguration();
    error CampaignNotFound();
    error CampaignInactive();
    error NotCampaignMerchant();
    error AlreadyPurchased();
    error InvalidReferral();
    error UnsupportedTokenBehavior();

    event ReferralRegistered(address indexed referrer, bytes32 indexed codeHash, string code);
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed merchant,
        address indexed token,
        uint256 price,
        uint16 commissionBps,
        string metadata
    );
    event CampaignUpdated(
        uint256 indexed campaignId,
        address indexed merchant,
        address indexed token,
        uint256 price,
        uint16 commissionBps,
        bool active,
        string metadata
    );
    /// @dev The canonical purchase record for indexers; do not sum a second reward event.
    event PurchaseCompleted(
        uint256 indexed campaignId,
        address indexed buyer,
        address indexed referrer,
        address token,
        uint256 price,
        uint256 merchantAmount,
        uint256 referralAmount,
        bytes32 referralCodeHash
    );

    /// @notice Register one referral identity for this wallet. Codes are normalized to uppercase.
    function registerReferralCode(string calldata code) external returns (bytes32 codeHash) {
        (string memory normalized, bytes32 normalizedHash) = _normalizeCode(code);
        if (referrerByCode[normalizedHash] != address(0)) revert ReferralCodeAlreadyRegistered();
        if (codeHashByReferrer[msg.sender] != bytes32(0)) revert WalletAlreadyHasReferralCode();

        referrerByCode[normalizedHash] = msg.sender;
        codeHashByReferrer[msg.sender] = normalizedHash;
        referralCodeByReferrer[msg.sender] = normalized;
        emit ReferralRegistered(msg.sender, normalizedHash, normalized);
        return normalizedHash;
    }

    /// @notice Resolve a code case-insensitively; an unregistered code resolves to address(0).
    function resolveReferralCode(string calldata code) external view returns (address referrer) {
        if (bytes(code).length == 0) return address(0);
        (, bytes32 normalizedHash) = _normalizeCode(code);
        return referrerByCode[normalizedHash];
    }

    function getReferralCode(address referrer) external view returns (bytes32 codeHash) {
        return codeHashByReferrer[referrer];
    }

    function createCampaign(
        address token,
        uint256 price,
        uint16 commissionBps,
        string calldata metadata
    ) external returns (uint256 campaignId) {
        _validateCampaign(token, price, commissionBps, metadata);
        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            id: campaignId,
            merchant: msg.sender,
            token: IERC20(token),
            price: price,
            commissionBps: commissionBps,
            active: true,
            metadata: metadata
        });
        emit CampaignCreated(campaignId, msg.sender, token, price, commissionBps, metadata);
    }

    function updateCampaign(
        uint256 campaignId,
        address token,
        uint256 price,
        uint16 commissionBps,
        bool active,
        string calldata metadata
    ) external {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (campaign.merchant != msg.sender) revert NotCampaignMerchant();
        _validateCampaign(token, price, commissionBps, metadata);

        campaign.token = IERC20(token);
        campaign.price = price;
        campaign.commissionBps = commissionBps;
        campaign.active = active;
        campaign.metadata = metadata;
        emit CampaignUpdated(campaignId, msg.sender, token, price, commissionBps, active, metadata);
    }

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        Campaign memory campaign = campaigns[campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        return campaign;
    }

    function hasPurchased(uint256 campaignId, address buyer) external view returns (bool) {
        return _hasPurchased[campaignId][buyer];
    }

    /// @notice Purchase one-time access; payment splits atomically between merchant and referrer.
    function purchaseWithReferral(uint256 campaignId, string calldata code) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        if (campaign.id == 0) revert CampaignNotFound();
        if (!campaign.active) revert CampaignInactive();
        if (_hasPurchased[campaignId][msg.sender]) revert AlreadyPurchased();

        address referrer;
        bytes32 codeHash;
        if (bytes(code).length != 0) {
            (, codeHash) = _normalizeCode(code);
            referrer = referrerByCode[codeHash];
            if (referrer == address(0) || referrer == msg.sender) revert InvalidReferral();
        }

        uint256 referralAmount = referrer == address(0)
            ? 0
            : (campaign.price * campaign.commissionBps) / BPS_DENOMINATOR;
        uint256 merchantAmount = campaign.price - referralAmount;
        IERC20 token = campaign.token;

        // Effects before external calls; any failed transfer reverts the state updates as well.
        _hasPurchased[campaignId][msg.sender] = true;
        campaignPurchaseCount[campaignId] += 1;
        campaignMerchantRevenue[campaignId] += merchantAmount;
        if (referralAmount != 0) {
            totalReferralEarnings[referrer] += referralAmount;
            campaignReferralEarnings[campaignId][referrer] += referralAmount;
            referralPurchaseCount[referrer] += 1;
        }

        uint256 hubBalanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), campaign.price);
        if (token.balanceOf(address(this)) - hubBalanceBefore != campaign.price) {
            revert UnsupportedTokenBehavior();
        }

        _transferExact(token, campaign.merchant, merchantAmount);
        if (referralAmount != 0) _transferExact(token, referrer, referralAmount);

        emit PurchaseCompleted(
            campaignId,
            msg.sender,
            referrer,
            address(token),
            campaign.price,
            merchantAmount,
            referralAmount,
            codeHash
        );
    }

    function _transferExact(IERC20 token, address recipient, uint256 amount) private {
        if (amount == 0) return;
        uint256 balanceBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, amount);
        if (token.balanceOf(recipient) - balanceBefore != amount) revert UnsupportedTokenBehavior();
    }

    function _validateCampaign(address token, uint256 price, uint16 commissionBps, string calldata metadata)
        private
        view
    {
        if (
            token == address(0) ||
            token.code.length == 0 ||
            price == 0 ||
            commissionBps > MAX_COMMISSION_BPS ||
            bytes(metadata).length == 0 ||
            bytes(metadata).length > MAX_METADATA_LENGTH
        ) revert InvalidCampaignConfiguration();
    }

    function _normalizeCode(string memory code) private pure returns (string memory normalized, bytes32 codeHash) {
        bytes memory value = bytes(code);
        if (value.length < MIN_CODE_LENGTH || value.length > MAX_CODE_LENGTH) revert InvalidReferralCode();

        bytes memory uppercase = new bytes(value.length);
        for (uint256 i = 0; i < value.length; ++i) {
            uint8 char = uint8(value[i]);
            if (char >= 97 && char <= 122) char -= 32;
            if (!((char >= 65 && char <= 90) || (char >= 48 && char <= 57))) {
                revert InvalidReferralCode();
            }
            uppercase[i] = bytes1(char);
        }
        normalized = string(uppercase);
        codeHash = keccak256(uppercase);
    }
}
