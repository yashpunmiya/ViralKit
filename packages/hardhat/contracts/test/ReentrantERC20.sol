// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local-only fixture that attempts a nested purchase from transferFrom.
contract ReentrantERC20 is ERC20 {
    address public target;
    uint256 public targetCampaign;
    bool public attackArmed;
    bool public reentryBlocked;

    constructor() ERC20("Reentrant Mock USD", "rUSD") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function armAttack(address targetAddress, uint256 campaignId) external {
        target = targetAddress;
        targetCampaign = campaignId;
        attackArmed = true;
        reentryBlocked = false;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool transferred = super.transferFrom(from, to, value);
        if (attackArmed) {
            attackArmed = false;
            (bool success, ) = target.call(
                abi.encodeWithSignature("purchaseWithReferral(uint256,string)", targetCampaign, "")
            );
            reentryBlocked = !success;
        }
        return transferred;
    }
}
